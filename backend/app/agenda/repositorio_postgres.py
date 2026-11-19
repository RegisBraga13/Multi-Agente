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
from app.contratos.agenda import FormularioRecebido, Horario, NovoPedido, Pedido
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
                " where status <> 'cancelado' and scheduled_at >= %s and scheduled_at < %s order by scheduled_at",
                _limites(de, ate),
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
