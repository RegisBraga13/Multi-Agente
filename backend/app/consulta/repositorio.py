"""Repositório da consulta atrás de interface (Postgres sob RLS em produção; memória nos testes).

As regras dos gatilhos do banco (0007/0008) valem nos dois: consulta finalizada não recebe escrita; adendo só
em consulta finalizada; propostas da IA e adendos só crescem. Consulta ou paciente de outro médico não existe.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal, Protocol
from uuid import UUID, uuid4

from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import ETAPAS, Bloco, Consulta, Documento, EstadoBloco, Etapa, NovaConsulta
from app.contratos.motor import RegistroDecisao
from app.contratos.prontuario import Adendo, DadosEntrada, EntradaProntuario
from app.fuso import no_consultorio
from app.pacientes.repositorio import RepositorioPacientes
from app.prontuario.titulo import titulo_nova_entrada

ResultadoRascunho = Literal["gravado", "revisado", "mudou"]


class ConsultaNaoEncontrada(Exception):
    pass


class ConsultaFinalizada(Exception):
    """Consulta finalizada não muda; correção só por adendo."""


class ConsultaAberta(Exception):
    """Adendo só em consulta finalizada."""


class RepositorioConsultas(Protocol):
    def criar(self, medico_id: UUID, nova: NovaConsulta) -> Consulta: ...

    def buscar(self, medico_id: UUID, consulta_id: UUID) -> Consulta: ...

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
        """Grava o bloco e, na mesma gravação, marca `desatualizar` como desatualizadas."""
        ...

    def gravar_rascunho_ia(
        self,
        medico_id: UUID,
        consulta_id: UUID,
        etapa: Etapa,
        conteudo: ModeloApi,
        anterior: Etapa,
        anterior_oficializada_em: datetime | None,
    ) -> ResultadoRascunho:
        """Numa gravação só: grava o rascunho da IA se a etapa anterior continua oficializada como estava
        (senão "mudou") e se a etapa ainda não foi mexida pelo médico (senão "revisado")."""
        ...

    def desatualizar(self, medico_id: UUID, consulta_id: UUID, etapas: list[Etapa]) -> None: ...

    def registrar_proposta(
        self, medico_id: UUID, consulta_id: UUID, registro: RegistroDecisao, conteudo: dict[str, Any] | None
    ) -> None: ...

    def gravar_documento(self, medico_id: UUID, consulta_id: UUID, documento: Documento) -> None: ...

    def documentos(self, medico_id: UUID, consulta_id: UUID) -> list[Documento]: ...

    def finalizar(
        self, medico_id: UUID, consulta_id: UUID, dados: DadosEntrada, edicoes: dict[str, str], quando: datetime
    ) -> None: ...

    def adicionar_adendo(
        self, medico_id: UUID, consulta_id: UUID, texto: str, motivo: str, quando: datetime
    ) -> None: ...

    def prontuario(self, medico_id: UUID, paciente_id: UUID) -> list[EntradaProntuario]: ...


def montar_entradas(
    finalizadas: list[tuple[Consulta, DadosEntrada, dict[str, str], list[Adendo]]],
) -> list[EntradaProntuario]:
    """Entradas do prontuário (mais recente no topo), com o título calculado pelas anteriores."""
    locais = [no_consultorio(c.agendada_para) for c, *_ in finalizadas]
    chave = [
        (c.tipo, x.strftime("%Y-%m-%d"), x.strftime("%H:%M")) for (c, *_), x in zip(finalizadas, locais, strict=True)
    ]
    entradas = []
    for (c, dados, edicoes, adendos), (tipo, data, hora) in zip(finalizadas, chave, strict=True):
        antes = [k for k in chave if f"{k[1]} {k[2]}" < f"{data} {hora}"]
        entradas.append(
            EntradaProntuario(
                id=c.id,
                paciente_id=c.paciente_id,
                titulo=titulo_nova_entrada(antes, tipo),
                tipo=c.tipo,
                modalidade=c.modalidade,
                data=date.fromisoformat(data),
                hora=hora,
                dados=dados,
                edicoes=edicoes,
                adendos=adendos,
            )
        )
    return sorted(entradas, key=lambda e: f"{e.data} {e.hora}", reverse=True)


@dataclass
class _Registro:
    medico_id: UUID
    consulta: Consulta
    propostas: list[tuple[RegistroDecisao, dict[str, Any] | None]] = field(default_factory=list)
    documentos: dict[str, Documento] = field(default_factory=dict)
    adendos: list[Adendo] = field(default_factory=list)
    registro: tuple[DadosEntrada, dict[str, str]] | None = None


class RepositorioConsultasMemoria:
    def __init__(self, pacientes: RepositorioPacientes) -> None:
        self.pacientes = pacientes
        self._dados: dict[UUID, _Registro] = {}

    def _achar(self, medico_id: UUID, consulta_id: UUID) -> _Registro:
        r = self._dados.get(consulta_id)
        if r is None or r.medico_id != medico_id:
            raise ConsultaNaoEncontrada
        return r

    def _aberta(self, medico_id: UUID, consulta_id: UUID) -> _Registro:
        r = self._achar(medico_id, consulta_id)
        if r.consulta.finalizada_em is not None:
            raise ConsultaFinalizada
        return r

    def criar(self, medico_id: UUID, nova: NovaConsulta) -> Consulta:
        if self.pacientes.buscar(medico_id, nova.paciente_id) is None:
            raise ConsultaNaoEncontrada
        consulta = Consulta(**nova.model_dump(), id=uuid4(), finalizada_em=None, blocos=[])
        self._dados[consulta.id] = _Registro(medico_id, consulta)
        return consulta.model_copy(deep=True)

    def buscar(self, medico_id: UUID, consulta_id: UUID) -> Consulta:
        return self._achar(medico_id, consulta_id).consulta.model_copy(deep=True)

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
        r = self._aberta(medico_id, consulta_id)
        novo = Bloco(
            etapa=etapa,
            estado=estado,
            desatualizado=False,
            conteudo=conteudo.model_dump(by_alias=True, mode="json"),
            oficializado_em=oficializado_em,
        )
        outros = [b for b in r.consulta.blocos if b.etapa != etapa]
        r.consulta.blocos = sorted([*outros, novo], key=lambda b: ETAPAS.index(b.etapa))
        for b in r.consulta.blocos:
            if b.etapa in desatualizar:
                b.desatualizado = True

    def gravar_rascunho_ia(
        self,
        medico_id: UUID,
        consulta_id: UUID,
        etapa: Etapa,
        conteudo: ModeloApi,
        anterior: Etapa,
        anterior_oficializada_em: datetime | None,
    ) -> ResultadoRascunho:
        r = self._aberta(medico_id, consulta_id)
        a = r.consulta.bloco(anterior)
        if a is None or a.estado != "oficializado" or a.desatualizado or a.oficializado_em != anterior_oficializada_em:
            return "mudou"
        atual = r.consulta.bloco(etapa)
        if atual is not None and atual.estado != "rascunho_ia":
            return "revisado"
        self.gravar_bloco(medico_id, consulta_id, etapa, "rascunho_ia", conteudo, None)
        return "gravado"

    def desatualizar(self, medico_id: UUID, consulta_id: UUID, etapas: list[Etapa]) -> None:
        r = self._aberta(medico_id, consulta_id)
        for b in r.consulta.blocos:
            if b.etapa in etapas:
                b.desatualizado = True

    def registrar_proposta(
        self, medico_id: UUID, consulta_id: UUID, registro: RegistroDecisao, conteudo: dict[str, Any] | None
    ) -> None:
        self._aberta(medico_id, consulta_id).propostas.append((registro, conteudo))

    def gravar_documento(self, medico_id: UUID, consulta_id: UUID, documento: Documento) -> None:
        self._aberta(medico_id, consulta_id).documentos[documento.tipo] = documento.model_copy(deep=True)

    def documentos(self, medico_id: UUID, consulta_id: UUID) -> list[Documento]:
        return [d.model_copy(deep=True) for d in self._achar(medico_id, consulta_id).documentos.values()]

    def finalizar(
        self, medico_id: UUID, consulta_id: UUID, dados: DadosEntrada, edicoes: dict[str, str], quando: datetime
    ) -> None:
        r = self._aberta(medico_id, consulta_id)
        r.registro = (dados.model_copy(deep=True), dict(edicoes))
        r.consulta.finalizada_em = quando

    def adicionar_adendo(self, medico_id: UUID, consulta_id: UUID, texto: str, motivo: str, quando: datetime) -> None:
        r = self._achar(medico_id, consulta_id)
        if r.consulta.finalizada_em is None:
            raise ConsultaAberta
        r.adendos.append(Adendo(quando=no_consultorio(quando).isoformat(timespec="minutes"), texto=texto))

    def prontuario(self, medico_id: UUID, paciente_id: UUID) -> list[EntradaProntuario]:
        finalizadas = [
            (r.consulta, r.registro[0], r.registro[1], list(r.adendos))
            for r in self._dados.values()
            if r.medico_id == medico_id and r.consulta.paciente_id == paciente_id and r.registro is not None
        ]
        return montar_entradas(finalizadas)
