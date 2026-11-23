"""Abrir a consulta do pedido no Postgres: uma consulta e um paciente só, mesmo abrindo duas vezes."""

from datetime import UTC, date, datetime

import psycopg
import pytest

from app.agenda.repositorio_postgres import RepositorioAgendaPostgres
from app.agenda.servico import novo_token
from app.consulta.abertura import abrir_do_pedido
from app.consulta.repositorio_postgres import RepositorioConsultasPostgres
from app.contratos.agenda import DadosPessoais, FormularioRecebido, NovoPedido
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres
from tests.banco.conftest import MEDICO_A, MEDICO_B

pytestmark = pytest.mark.banco


def _pedido_com_ficha(agenda, inicio):
    p = agenda.criar_pedido(
        MEDICO_A,
        NovoPedido(
            modalidade="online",
            data=date(2027, 4, 5),
            inicio=inicio,
            nome="Maria Teste",
            whatsapp="5585999990000",
            pagamento="Particular",
            transcricao="aceita",
            forma="pagina",
        ),
        novo_token(),
    )
    dados = DadosPessoais(
        nome_completo="Abertura Banco da Silva",
        nascimento=date(1990, 5, 2),
        sexo="I",
        whatsapp="85",
        cidade="X",
        uf="CE",
        estado_civil="casado",
    )
    agenda.gravar_formulario(
        MEDICO_A,
        p.id,
        FormularioRecebido(dados=dados, respostas={}, fotos=[], recebido_em=datetime(2027, 4, 1, tzinfo=UTC)),
        {},
    )
    return p


def test_abrir_duas_vezes_e_mesma_pessoa_em_outro_pedido(url_banco):
    agenda = RepositorioAgendaPostgres(url_banco)
    pacientes = RepositorioPacientesPostgres(url_banco)
    consultas = RepositorioConsultasPostgres(url_banco)
    p1, p2 = _pedido_com_ficha(agenda, "09:00"), _pedido_com_ficha(agenda, "09:30")
    a = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, p1.id, "dermatologia")
    b = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, p1.id, "dermatologia")
    c = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, p2.id, "dermatologia")
    assert a.id == b.id and a.pedido_id == p1.id and c.id != a.id
    assert c.paciente_id == a.paciente_id
    assert pacientes.buscar(MEDICO_A, a.paciente_id).sexo == "I"
    with psycopg.connect(url_banco) as conn:
        assert (
            conn.execute("select count(*) from patients where full_name = 'Abertura Banco da Silva'").fetchone()[0] == 1
        )


def test_outro_medico_nao_acha_o_paciente_nem_a_consulta_do_pedido(url_banco):
    pacientes = RepositorioPacientesPostgres(url_banco)
    consultas = RepositorioConsultasPostgres(url_banco)
    agenda = RepositorioAgendaPostgres(url_banco)
    a = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, _pedido_com_ficha(agenda, "10:00").id, "dermatologia")
    assert pacientes.procurar(MEDICO_B, "Abertura Banco da Silva", date(1990, 5, 2)) is None
    assert consultas.do_pedido(MEDICO_B, a.pedido_id) is None


def test_dois_toques_ao_mesmo_tempo_no_mesmo_pedido_dao_a_mesma_consulta(url_banco):
    from app.contratos.consulta_blocos import NovaConsulta

    agenda = RepositorioAgendaPostgres(url_banco)
    pacientes = RepositorioPacientesPostgres(url_banco)
    consultas = RepositorioConsultasPostgres(url_banco)
    p = _pedido_com_ficha(agenda, "11:00")
    primeira = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, p.id, "dermatologia")
    nova = NovaConsulta(
        paciente_id=primeira.paciente_id, tipo="consulta", modalidade="online", agendada_para=primeira.agendada_para
    )
    # o segundo toque passou pela checagem antes do primeiro gravar: o banco recusa a duplicata e o repositório devolve a original
    assert consultas.criar(MEDICO_A, nova, p.id).id == primeira.id


def _cartao_de_retorno_no_banco(agenda, pacientes, consultas, inicio):
    from app.contratos.agenda import RetornoMarcado

    origem = abrir_do_pedido(agenda, pacientes, consultas, MEDICO_A, _pedido_com_ficha(agenda, inicio).id, "dermatologia")
    marcado = RetornoMarcado(data=date(2027, 4, 20), inicio=inicio, modalidade="presencial")
    return origem, agenda.criar_retorno(MEDICO_A, origem.paciente_id, "Maria Teste", origem.id, marcado)


def test_abrir_o_cartao_de_retorno_cria_uma_vez_e_o_outro_medico_nao_acha(url_banco):
    from app.agenda.repositorio import RetornoNaoEncontrado
    from app.consulta.abertura import abrir_do_retorno

    agenda = RepositorioAgendaPostgres(url_banco)
    pacientes = RepositorioPacientesPostgres(url_banco)
    consultas = RepositorioConsultasPostgres(url_banco)
    origem, cartao = _cartao_de_retorno_no_banco(agenda, pacientes, consultas, "14:00")
    a = abrir_do_retorno(agenda, consultas, MEDICO_A, cartao.id, "dermatologia")
    b = abrir_do_retorno(agenda, consultas, MEDICO_A, cartao.id, "dermatologia")
    assert a.id == b.id != origem.id
    assert (a.tipo, a.retorno_id, a.paciente_id, a.modalidade) == ("retorno", cartao.id, origem.paciente_id, "presencial")
    assert consultas.do_retorno(MEDICO_B, cartao.id) is None
    with pytest.raises(RetornoNaoEncontrado):
        agenda.retorno(MEDICO_B, cartao.id)


def test_dois_toques_ao_mesmo_tempo_no_mesmo_cartao_dao_o_mesmo_retorno(url_banco):
    from app.contratos.consulta_blocos import NovaConsulta

    agenda = RepositorioAgendaPostgres(url_banco)
    pacientes = RepositorioPacientesPostgres(url_banco)
    consultas = RepositorioConsultasPostgres(url_banco)
    origem, cartao = _cartao_de_retorno_no_banco(agenda, pacientes, consultas, "15:00")
    nova = NovaConsulta(
        paciente_id=origem.paciente_id, tipo="retorno", modalidade="presencial", agendada_para=origem.agendada_para
    )
    primeiro = consultas.criar(MEDICO_A, nova, retorno_id=cartao.id)
    assert consultas.criar(MEDICO_A, nova, retorno_id=cartao.id).id == primeiro.id
