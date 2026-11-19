"""Agenda no Postgres: as mesmas regras do repositório em memória, mais a RLS e o horário único."""

from datetime import UTC, date, datetime

import pytest

from app.agenda.repositorio import FotoGuardada, HorarioOcupado, PedidoNaoEncontrado
from app.agenda.repositorio_postgres import RepositorioAgendaPostgres
from app.agenda.servico import novo_token
from app.contratos.agenda import DadosPessoais, FormularioRecebido, Horario, NovoPedido
from tests.banco.conftest import MEDICO_A, MEDICO_B

pytestmark = pytest.mark.banco


def pedido(dia: int, inicio: str = "10:00", **mudar: object) -> NovoPedido:
    base = {
        "modalidade": "presencial",
        "data": date(2027, 3, dia),
        "inicio": inicio,
        "nome": "Maria Teste",
        "whatsapp": "5585999990000",
        "pagamento": "Unimed",
        "transcricao": "aceita",
        "forma": "pagina",
    }
    return NovoPedido.model_validate({**base, **mudar})


def test_pagina_do_medico_local_vem_da_semente(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    assert repo.medico_da_pagina("ana-souza") == MEDICO_A
    assert repo.slug_do_medico(MEDICO_A) == "ana-souza"
    assert repo.medico_da_pagina("ninguem") is None


def test_pedido_gravado_volta_com_a_hora_do_consultorio(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    criado = repo.criar_pedido(MEDICO_A, pedido(1, "08:30"), novo_token())
    assert (criado.data, criado.inicio, criado.situacao_ficha, criado.status) == (
        date(2027, 3, 1),
        "08:30",
        "sem-ficha",
        "novo",
    )
    assert [p.id for p in repo.pedidos(MEDICO_A, date(2027, 3, 1), date(2027, 3, 1))] == [criado.id]
    assert repo.ocupados(MEDICO_A, date(2027, 3, 1), date(2027, 3, 1)) == [
        Horario(data=date(2027, 3, 1), inicio="08:30")
    ]
    assert repo.pedido_do_token(criado.token_formulario) == (MEDICO_A, criado)


def test_mesmo_horario_duas_vezes_vira_horario_ocupado(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    repo.criar_pedido(MEDICO_A, pedido(2), novo_token())
    with pytest.raises(HorarioOcupado):
        repo.criar_pedido(MEDICO_A, pedido(2, modalidade="online", nome="Outra"), novo_token())


def test_outro_medico_nao_ve_nem_altera(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    criado = repo.criar_pedido(MEDICO_A, pedido(3), novo_token())
    assert repo.pedidos(MEDICO_B, date(2027, 3, 3), date(2027, 3, 3)) == []
    assert repo.pedido(MEDICO_A, criado.id) == criado
    with pytest.raises(PedidoNaoEncontrado):
        repo.pedido(MEDICO_B, criado.id)
    with pytest.raises(PedidoNaoEncontrado):
        repo.marcar_link_enviado(MEDICO_B, criado.id)


def test_formulario_e_foto_gravados(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    criado = repo.criar_pedido(MEDICO_A, pedido(4), novo_token())
    assert repo.marcar_link_enviado(MEDICO_A, criado.id).situacao_ficha == "link-enviado"
    dados = DadosPessoais(
        nome_completo="Maria Teste",
        nascimento=date(1990, 5, 2),
        sexo="F",
        whatsapp="85999990000",
        cidade="Fortaleza",
        uf="CE",
    )
    recebido = FormularioRecebido(
        dados=dados,
        respostas={"alergias": "dipirona"},
        fotos=["foto_perto"],
        recebido_em=datetime(2027, 2, 28, 13, tzinfo=UTC),
    )
    foto = FotoGuardada(tipo="image/jpeg", conteudo=b"\xff\xd8jpeg")
    gravado = repo.gravar_formulario(MEDICO_A, criado.id, recebido, {"foto_perto": foto})
    assert gravado.situacao_ficha == "pronta" and gravado.formulario == recebido
    assert repo.foto(MEDICO_A, criado.id, "foto_perto") == foto
    assert repo.foto(MEDICO_A, criado.id, "foto_longe") is None
    with pytest.raises(PedidoNaoEncontrado):
        repo.foto(MEDICO_B, criado.id, "foto_perto")
    # mandar o link de novo não desfaz a ficha pronta
    assert repo.marcar_link_enviado(MEDICO_A, criado.id).situacao_ficha == "pronta"
