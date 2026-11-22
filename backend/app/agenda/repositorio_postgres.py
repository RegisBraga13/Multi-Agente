"""Agenda no Postgres. Tudo do médico roda sob a RLS dele (decisão 0003).

Três buscas rodam no papel do próprio servidor, porque o paciente não tem login: achar o médico pelo endereço
da página, o endereço pelo médico e o pedido pelo token do link. Elas só leem; toda escrita volta para a RLS.
"""

from datetime import date, timedelta
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.agenda.repositorio import FotoGuardada, HorarioOcupado, PedidoNaoEncontrado, horario, instante
from app.contratos.agenda import FormularioRecebido, Horario, NovoPedido, Pedido, Retorno, RetornoMarcado
from app.fuso import FUSO_CONSULTORIO
from app.pacientes.repositorio_postgres import transacao_do_medico

_COLUNAS = (
    "id, scheduled_at, modality, patient_name, whatsapp, payment, transcription, form_choice, form_token,"
    " form_status, form_answers, form_received_at, status, created_at"
)


def _pedido(linha: dict[str, Any]) -> Pedido:
    quando = horario(linha["scheduled_at"])
    respostas = linha["form_answers"]
    return Pedido(
        id=linha["id"],
        data=quando.data,
        inicio=quando.inicio,
        modalidade=linha["modality"],
        nome=linha["patient_name"],
        whatsapp=linha["whatsapp"],
        pagamento=linha["payment"],
        transcricao=linha["transcription"],
        forma=linha["form_choice"],
        token_formulario=linha["form_token"],
        situacao_ficha=linha["form_status"],
        status=linha["status"],
        criado_em=linha["created_at"],
        formulario=FormularioRecebido.model_validate({**respostas, "recebidoEm": linha["form_received_at"]})
        if respostas
        else None,
    )


def _travar_horario(conn: psycopg.Connection[dict[str, Any]], medico_id: UUID, quando: Any) -> None:
    """Pedido e retorno moram em tabelas diferentes: quem grava um horário trava o instante antes de conferir os dois."""
    conn.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))", (f"{medico_id}|{quando.isoformat()}",))


def _horario_tomado(conn: psycopg.Connection[dict[str, Any]], quando: Any, ignorar_origem: UUID | None = None) -> bool:
    """`ignorar_origem`: o retorno da própria consulta não conta (ele será substituído)."""
    achou = conn.execute(
        "select 1 from booking_requests where scheduled_at = %s and status <> 'cancelado'"
        " union all select 1 from return_bookings where scheduled_at = %s and origin_encounter_id is distinct from %s",
        (quando, quando, ignorar_origem),
    ).fetchone()
    return achou is not None


def _limites(de: date, ate: date) -> tuple[Any, Any]:
    return instante(de, "00:00"), instante(ate + timedelta(days=1), "00:00")


class RepositorioAgendaPostgres:
    def __init__(self, url: str) -> None:
        self.url = url

    def _servidor(self) -> psycopg.Connection[dict[str, Any]]:
        return psycopg.connect(self.url, row_factory=dict_row)

    def medico_da_pagina(self, slug: str) -> UUID | None:
        with self._servidor() as conn:
            linha = conn.execute("select id from doctors where page_slug = %s", (slug,)).fetchone()
        return linha["id"] if linha else None

    def slug_do_medico(self, medico_id: UUID) -> str | None:
        with self._servidor() as conn:
            linha = conn.execute("select page_slug from doctors where id = %s", (medico_id,)).fetchone()
        return linha["page_slug"] if linha else None

    def pedido_do_token(self, token: str) -> tuple[UUID, Pedido] | None:
        with self._servidor() as conn:
            linha = conn.execute(
                f"select doctor_id, {_COLUNAS} from booking_requests where form_token = %s", (token,)
            ).fetchone()
        return (linha["doctor_id"], _pedido(linha)) if linha else None

    def ocupados(self, medico_id: UUID, de: date, ate: date) -> list[Horario]:
        with transacao_do_medico(self.url, medico_id) as conn:
            linhas = conn.execute(
                "select scheduled_at from booking_requests"
                " where status <> 'cancelado' and scheduled_at >= %s and scheduled_at < %s"
                " union all select scheduled_at from return_bookings where scheduled_at >= %s and scheduled_at < %s"
                " order by scheduled_at",
                (*_limites(de, ate), *_limites(de, ate)),
            ).fetchall()
        return [horario(linha["scheduled_at"]) for linha in linhas]

    def criar_pedido(self, medico_id: UUID, novo: NovoPedido, token: str) -> Pedido:
        valores = (
            medico_id,
            instante(novo.data, novo.inicio),
            novo.modalidade,
            novo.nome,
            novo.whatsapp,
            novo.pagamento,
            novo.transcricao,
            novo.forma,
            token,
        )
        try:
            with transacao_do_medico(self.url, medico_id) as conn:
                _travar_horario(conn, medico_id, valores[1])
                if _horario_tomado(conn, valores[1]):
                    raise HorarioOcupado
                linha = conn.execute(
                    "insert into booking_requests (doctor_id, scheduled_at, modality, patient_name, whatsapp, payment,"
                    " transcription, form_choice, form_token) values (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
                    f" returning {_COLUNAS}",
                    valores,
                ).fetchone()
        except psycopg.errors.UniqueViolation as erro:
            raise HorarioOcupado from erro
        if linha is None:
            raise RuntimeError("o banco não devolveu o pedido criado")
        return _pedido(linha)

    def pedidos(self, medico_id: UUID, de: date, ate: date) -> list[Pedido]:
        with transacao_do_medico(self.url, medico_id) as conn:
            linhas = conn.execute(
                f"select {_COLUNAS} from booking_requests"
                " where scheduled_at >= %s and scheduled_at < %s order by scheduled_at",
                _limites(de, ate),
            ).fetchall()
        return [_pedido(linha) for linha in linhas]

    def pedido(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        with transacao_do_medico(self.url, medico_id) as conn:
            linha = conn.execute(f"select {_COLUNAS} from booking_requests where id = %s", (pedido_id,)).fetchone()
        if linha is None:
            raise PedidoNaoEncontrado
        return _pedido(linha)

    def marcar_link_enviado(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        with transacao_do_medico(self.url, medico_id) as conn:
            conn.execute(
                "update booking_requests set form_status = 'link-enviado' where id = %s and form_status = 'sem-ficha'",
                (pedido_id,),
            )
            linha = conn.execute(f"select {_COLUNAS} from booking_requests where id = %s", (pedido_id,)).fetchone()
        if linha is None:
            raise PedidoNaoEncontrado
        return _pedido(linha)

    def confirmar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        with transacao_do_medico(self.url, medico_id) as conn:
            conn.execute(
                "update booking_requests set status = 'confirmado' where id = %s and status = 'novo'", (pedido_id,)
            )
            linha = conn.execute(f"select {_COLUNAS} from booking_requests where id = %s", (pedido_id,)).fetchone()
        if linha is None:
            raise PedidoNaoEncontrado
        return _pedido(linha)

    def cancelar(self, medico_id: UUID, pedido_id: UUID) -> Pedido:
        with transacao_do_medico(self.url, medico_id) as conn:
            linha = conn.execute(
                f"update booking_requests set status = 'cancelado' where id = %s returning {_COLUNAS}", (pedido_id,)
            ).fetchone()
        if linha is None:
            raise PedidoNaoEncontrado
        return _pedido(linha)

    def gravar_formulario(
        self, medico_id: UUID, pedido_id: UUID, recebido: FormularioRecebido, fotos: dict[str, FotoGuardada]
    ) -> Pedido:
        conteudo = recebido.model_dump(mode="json", by_alias=True, exclude={"recebido_em"})
        with transacao_do_medico(self.url, medico_id) as conn:
            linha = conn.execute(
                "update booking_requests set form_status = 'pronta', form_answers = %s, form_received_at = %s"
                f" where id = %s returning {_COLUNAS}",
                (Jsonb(conteudo), recebido.recebido_em.astimezone(FUSO_CONSULTORIO), pedido_id),
            ).fetchone()
            if linha is None:
                raise PedidoNaoEncontrado
            conn.execute("delete from booking_form_photos where request_id = %s", (pedido_id,))
            for pergunta, foto in fotos.items():
                conn.execute(
                    "insert into booking_form_photos (doctor_id, request_id, question_id, content_type, data)"
                    " values (%s, %s, %s, %s, %s)",
                    (medico_id, pedido_id, pergunta, foto.tipo, foto.conteudo),
                )
        return _pedido(linha)

    def foto(self, medico_id: UUID, pedido_id: UUID, pergunta: str) -> FotoGuardada | None:
        with transacao_do_medico(self.url, medico_id) as conn:
            if conn.execute("select 1 from booking_requests where id = %s", (pedido_id,)).fetchone() is None:
                raise PedidoNaoEncontrado
            linha = conn.execute(
                "select content_type, data from booking_form_photos where request_id = %s and question_id = %s",
                (pedido_id, pergunta),
            ).fetchone()
        return FotoGuardada(tipo=linha["content_type"], conteudo=bytes(linha["data"])) if linha else None

    def criar_retorno(
        self, medico_id: UUID, paciente_id: UUID, paciente_nome: str, consulta_origem_id: UUID, marcado: RetornoMarcado
    ) -> Retorno:
        quando = instante(marcado.data, marcado.inicio)
        try:
            with transacao_do_medico(self.url, medico_id) as conn:
                _travar_horario(conn, medico_id, quando)
                if _horario_tomado(conn, quando, consulta_origem_id):
                    raise HorarioOcupado
                conn.execute("delete from return_bookings where origin_encounter_id = %s", (consulta_origem_id,))
                linha = conn.execute(
                    "insert into return_bookings (doctor_id, patient_id, origin_encounter_id, scheduled_at, modality)"
                    " values (%s, %s, %s, %s, %s) returning id",
                    (medico_id, paciente_id, consulta_origem_id, quando, marcado.modalidade),
                ).fetchone()
        except psycopg.errors.UniqueViolation as erro:
            if erro.diag.constraint_name == "return_bookings_horario_unico":
                raise HorarioOcupado from erro
            raise
        if linha is None:
            raise RuntimeError("o banco não devolveu o retorno criado")
        return Retorno(
            id=linha["id"],
            paciente_id=paciente_id,
            paciente_nome=paciente_nome,
            consulta_origem_id=consulta_origem_id,
            **marcado.model_dump(),
        )

    def retornos(self, medico_id: UUID, de: date, ate: date) -> list[Retorno]:
        with transacao_do_medico(self.url, medico_id) as conn:
            linhas = conn.execute(
                "select r.id, r.patient_id, p.full_name, r.origin_encounter_id, r.scheduled_at, r.modality"
                " from return_bookings r join patients p on p.id = r.patient_id"
                " where r.scheduled_at >= %s and r.scheduled_at < %s order by r.scheduled_at",
                _limites(de, ate),
            ).fetchall()
        saida = []
        for x in linhas:
            quando = horario(x["scheduled_at"])
            saida.append(
                Retorno(
                    id=x["id"],
                    paciente_id=x["patient_id"],
                    paciente_nome=x["full_name"],
                    consulta_origem_id=x["origin_encounter_id"],
                    data=quando.data,
                    inicio=quando.inicio,
                    modalidade=x["modality"],
                )
            )
        return saida

    def desfazer_retorno(self, medico_id: UUID, consulta_origem_id: UUID) -> None:
        with transacao_do_medico(self.url, medico_id) as conn:
            conn.execute("delete from return_bookings where origin_encounter_id = %s", (consulta_origem_id,))
