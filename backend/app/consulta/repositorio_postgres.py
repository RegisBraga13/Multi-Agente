"""Consulta no Postgres, sempre sob a RLS do médico (decisão 0003; tabelas da 0007/0008).

Etapa → tabela: anamnese `transcripts`, exame `clinical_facts`, história `clinical_histories`, diagnósticos
`diagnostic_hypotheses`, conduta `care_plans`. Prontuário em `encounters.record` ({"dados", "edicoes"}).
As regras de consulta aberta/finalizada são conferidas aqui antes de escrever; os gatilhos do banco são a
segunda barreira (e o erro deles também vira exceção de domínio).
"""

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from app.consulta.repositorio import (
    ConsultaAberta,
    ConsultaFinalizada,
    ConsultaNaoEncontrada,
    ResultadoRascunho,
    montar_entradas,
)
from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import (
    ETAPAS,
    VERSAO_ESQUEMA_BLOCO,
    Bloco,
    Consulta,
    Documento,
    EstadoBloco,
    Etapa,
    NovaConsulta,
)
from app.contratos.motor import RegistroDecisao
from app.contratos.prontuario import SCHEMA_VERSION_PRONTUARIO, Adendo, DadosEntrada, EntradaProntuario
from app.fuso import data_hora_br
from app.pacientes.repositorio_postgres import transacao_do_medico

TABELA: dict[str, str] = {
    "anamnese": "transcripts",
    "exame": "clinical_facts",
    "historia": "clinical_histories",
    "diagnosticos": "diagnostic_hypotheses",
    "conduta": "care_plans",
}
_COLUNAS_CONSULTA = "id, patient_id, kind, modality, scheduled_at, finalized_at, specialty_slug, booking_request_id, return_booking_id"


def _consulta(linha: dict[str, Any], blocos: list[Bloco]) -> Consulta:
    return Consulta(
        id=linha["id"],
        paciente_id=linha["patient_id"],
        tipo=linha["kind"],
        modalidade=linha["modality"],
        especialidade=linha["specialty_slug"],
        pedido_id=linha["booking_request_id"],
        retorno_id=linha["return_booking_id"],
        agendada_para=linha["scheduled_at"],
        finalizada_em=linha["finalized_at"],
        blocos=blocos,
    )


class RepositorioConsultasPostgres:
    def __init__(self, url: str) -> None:
        self.url = url

    @contextmanager
    def _transacao(self, medico_id: UUID) -> Iterator[psycopg.Connection[dict[str, Any]]]:
        try:
            with transacao_do_medico(self.url, medico_id) as conn:
                yield conn
        except psycopg.errors.RaiseException as erro:  # gatilhos da 0007/0008
            if "adendo só em consulta finalizada" in str(erro):
                raise ConsultaAberta from erro
            if "consulta finalizada" in str(erro):
                raise ConsultaFinalizada from erro
            raise

    def _linha(self, conn: psycopg.Connection[dict[str, Any]], consulta_id: UUID) -> dict[str, Any]:
        linha = conn.execute(f"select {_COLUNAS_CONSULTA} from encounters where id = %s", (consulta_id,)).fetchone()
        if linha is None:
            raise ConsultaNaoEncontrada
        return linha

    def _aberta(self, conn: psycopg.Connection[dict[str, Any]], consulta_id: UUID) -> None:
        if self._linha(conn, consulta_id)["finalized_at"] is not None:
            raise ConsultaFinalizada

    def criar(
        self, medico_id: UUID, nova: NovaConsulta, pedido_id: UUID | None = None, retorno_id: UUID | None = None
    ) -> Consulta:
        try:
            return self._criar(medico_id, nova, pedido_id, retorno_id)
        except psycopg.errors.UniqueViolation:
            # dois toques em "Abrir consulta" ao mesmo tempo: o banco guardou o primeiro, devolvemos esse
            existente = None
            if pedido_id:
                existente = self.do_pedido(medico_id, pedido_id)
            elif retorno_id:
                existente = self.do_retorno(medico_id, retorno_id)
            if existente is None:
                raise
            return existente

    def _criar(
        self, medico_id: UUID, nova: NovaConsulta, pedido_id: UUID | None, retorno_id: UUID | None
    ) -> Consulta:
        with self._transacao(medico_id) as conn:
            if conn.execute("select 1 from patients where id = %s", (nova.paciente_id,)).fetchone() is None:
                raise ConsultaNaoEncontrada
            linha = conn.execute(
                "insert into encounters (doctor_id, patient_id, kind, modality, scheduled_at, specialty_slug,"
                " booking_request_id, return_booking_id) values (%s, %s, %s, %s, %s, %s, %s, %s)"
                f" returning {_COLUNAS_CONSULTA}",
                (
                    medico_id,
                    nova.paciente_id,
                    nova.tipo,
                    nova.modalidade,
                    nova.agendada_para,
                    nova.especialidade,
                    pedido_id,
                    retorno_id,
                ),
            ).fetchone()
        assert linha is not None
        return _consulta(linha, [])

    def do_pedido(self, medico_id: UUID, pedido_id: UUID) -> Consulta | None:
        with self._transacao(medico_id) as conn:
            linha = conn.execute(
                f"select {_COLUNAS_CONSULTA} from encounters where booking_request_id = %s", (pedido_id,)
            ).fetchone()
        return None if linha is None else self.buscar(medico_id, linha["id"])

    def do_retorno(self, medico_id: UUID, retorno_id: UUID) -> Consulta | None:
        with self._transacao(medico_id) as conn:
            linha = conn.execute(
                f"select {_COLUNAS_CONSULTA} from encounters where return_booking_id = %s", (retorno_id,)
            ).fetchone()
        return None if linha is None else self.buscar(medico_id, linha["id"])

    def buscar(self, medico_id: UUID, consulta_id: UUID) -> Consulta:
        with self._transacao(medico_id) as conn:
            linha = self._linha(conn, consulta_id)
            blocos = []
            for etapa in ETAPAS:
                b = conn.execute(
                    f"select status, stale, content, officialized_at from {TABELA[etapa]} where encounter_id = %s",
                    (consulta_id,),
                ).fetchone()
                if b is not None:
                    blocos.append(
                        Bloco(
                            etapa=etapa,
                            estado=b["status"],
                            desatualizado=b["stale"],
                            conteudo=b["content"],
                            oficializado_em=b["officialized_at"],
                        )
                    )
        return _consulta(linha, blocos)

    def gravar_bloco(
        self,
        medico_id: UUID,
        consulta_id: UUID,
        etapa: Etapa,
        estado: EstadoBloco,
        conteudo: ModeloApi,
        oficializado_em: datetime | None,
        desatualizar: Sequence[Etapa] = (),
    ) -> None:
        with self._transacao(medico_id) as conn:
            self._aberta(conn, consulta_id)
            self._upsert(conn, medico_id, consulta_id, etapa, estado, conteudo, oficializado_em)
            for seguinte in desatualizar:
                conn.execute(f"update {TABELA[seguinte]} set stale = true where encounter_id = %s", (consulta_id,))

    def gravar_rascunho_ia(
        self,
        medico_id: UUID,
        consulta_id: UUID,
        etapa: Etapa,
        conteudo: ModeloApi,
        anterior: Etapa,
        anterior_oficializada_em: datetime | None,
    ) -> ResultadoRascunho:
        with self._transacao(medico_id) as conn:
            # trava a consulta: edição e geração da mesma consulta passam uma de cada vez
            conn.execute("select id from encounters where id = %s for update", (consulta_id,))
            self._aberta(conn, consulta_id)
            a = conn.execute(
                f"select status, stale, officialized_at from {TABELA[anterior]} where encounter_id = %s",
                (consulta_id,),
            ).fetchone()
            if (
                a is None
                or a["status"] != "oficializado"
                or a["stale"]
                or a["officialized_at"] != anterior_oficializada_em
            ):
                return "mudou"
            atual = conn.execute(
                f"select status from {TABELA[etapa]} where encounter_id = %s", (consulta_id,)
            ).fetchone()
            if atual is not None and atual["status"] != "rascunho_ia":
                return "revisado"
            self._upsert(conn, medico_id, consulta_id, etapa, "rascunho_ia", conteudo, None)
            return "gravado"

    def _upsert(
        self,
        conn: psycopg.Connection[dict[str, Any]],
        medico_id: UUID,
        consulta_id: UUID,
        etapa: Etapa,
        estado: EstadoBloco,
        conteudo: ModeloApi,
        oficializado_em: datetime | None,
    ) -> None:
        conn.execute(
            f"insert into {TABELA[etapa]}"
            " (doctor_id, encounter_id, status, content, schema_version, stale, officialized_at)"
            " values (%s, %s, %s, %s, %s, false, %s)"
            " on conflict (encounter_id) do update set status = excluded.status, content = excluded.content,"
            " schema_version = excluded.schema_version, stale = false, officialized_at = excluded.officialized_at",
            (
                medico_id,
                consulta_id,
                estado,
                Jsonb(conteudo.model_dump(by_alias=True, mode="json")),
                VERSAO_ESQUEMA_BLOCO,
                oficializado_em,
            ),
        )

    def desatualizar(self, medico_id: UUID, consulta_id: UUID, etapas: list[Etapa]) -> None:
        with self._transacao(medico_id) as conn:
            self._aberta(conn, consulta_id)
            for etapa in etapas:
                conn.execute(f"update {TABELA[etapa]} set stale = true where encounter_id = %s", (consulta_id,))

    def registrar_proposta(
        self, medico_id: UUID, consulta_id: UUID, registro: RegistroDecisao, conteudo: dict[str, Any] | None
    ) -> None:
        with self._transacao(medico_id) as conn:
            self._aberta(conn, consulta_id)  # ai_proposals não tem gatilho de consulta aberta
            conn.execute(
                "insert into ai_proposals (decision_id, doctor_id, encounter_id, motor, model, model_version,"
                " schema_version, prompt_version, confidence, action, tokens_in, tokens_out, content, created_at)"
                " values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    registro.decision_id,
                    medico_id,
                    consulta_id,
                    registro.motor,
                    registro.modelo,
                    registro.versao_modelo,
                    registro.versao_esquema,
                    registro.versao_prompt,
                    registro.confianca,
                    registro.acao,
                    registro.tokens_entrada,
                    registro.tokens_saida,
                    Jsonb(conteudo) if conteudo is not None else None,
                    registro.quando,
                ),
            )

    def gravar_documento(self, medico_id: UUID, consulta_id: UUID, documento: Documento) -> None:
        conteudo = Jsonb(documento.model_dump(by_alias=True, mode="json"))
        with self._transacao(medico_id) as conn:
            self._aberta(conn, consulta_id)
            atualizado = conn.execute(
                "update documents set status = %s, content = %s where encounter_id = %s and kind = %s returning id",
                (documento.estado, conteudo, consulta_id, documento.tipo),
            ).fetchone()
            if atualizado is None:
                conn.execute(
                    "insert into documents (doctor_id, encounter_id, kind, status, content) values (%s, %s, %s, %s, %s)",
                    (medico_id, consulta_id, documento.tipo, documento.estado, conteudo),
                )

    def documentos(self, medico_id: UUID, consulta_id: UUID) -> list[Documento]:
        with self._transacao(medico_id) as conn:
            self._linha(conn, consulta_id)
            linhas = conn.execute(
                "select content from documents where encounter_id = %s order by created_at", (consulta_id,)
            ).fetchall()
        return [Documento.model_validate(x["content"]) for x in linhas]

    def finalizar(
        self, medico_id: UUID, consulta_id: UUID, dados: DadosEntrada, edicoes: dict[str, str], quando: datetime
    ) -> None:
        registro = {"dados": dados.model_dump(by_alias=True, mode="json"), "edicoes": edicoes}
        with self._transacao(medico_id) as conn:
            self._aberta(conn, consulta_id)
            conn.execute(
                "update encounters set finalized_at = %s, record = %s, record_schema_version = %s where id = %s",
                (quando, Jsonb(registro), SCHEMA_VERSION_PRONTUARIO, consulta_id),
            )

    def adicionar_adendo(self, medico_id: UUID, consulta_id: UUID, texto: str, motivo: str, quando: datetime) -> None:
        with self._transacao(medico_id) as conn:
            if self._linha(conn, consulta_id)["finalized_at"] is None:
                raise ConsultaAberta
            conn.execute(
                "insert into addenda (doctor_id, encounter_id, text, reason, created_at) values (%s, %s, %s, %s, %s)",
                (medico_id, consulta_id, texto, motivo, quando),
            )

    def pacientes_com_prontuario(self, medico_id: UUID) -> list[UUID]:
        with self._transacao(medico_id) as conn:
            linhas = conn.execute(
                "select distinct patient_id from encounters where finalized_at is not null"
            ).fetchall()
        return [x["patient_id"] for x in linhas]

    def prontuario(self, medico_id: UUID, paciente_id: UUID) -> list[EntradaProntuario]:
        with self._transacao(medico_id) as conn:
            linhas = conn.execute(
                f"select {_COLUNAS_CONSULTA}, record from encounters"
                " where patient_id = %s and finalized_at is not null",
                (paciente_id,),
            ).fetchall()
            adendos: dict[UUID, list[Adendo]] = {}
            for a in conn.execute(
                "select encounter_id, text, created_at from addenda where encounter_id = any(%s) order by created_at",
                ([x["id"] for x in linhas],),
            ).fetchall():
                adendos.setdefault(a["encounter_id"], []).append(
                    Adendo(quando=data_hora_br(a["created_at"]), texto=a["text"])
                )
        return montar_entradas(
            [
                (
                    _consulta(x, []),
                    DadosEntrada.model_validate(x["record"]["dados"]),
                    dict(x["record"]["edicoes"]),
                    adendos.get(x["id"], []),
                )
                for x in linhas
            ]
        )
