from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.agenda.repositorio import PedidoNaoEncontrado, RepositorioAgendaMemoria
from app.consulta.abertura import abrir_do_pedido
from app.consulta.repositorio import RepositorioConsultasMemoria
from app.consulta.servico import ErroEtapa
from app.contratos.agenda import DadosPessoais, FormularioRecebido, NovoPedido
from app.pacientes.repositorio import RepositorioPacientesMemoria
from tests.fabrica import DADOS_MINIMOS

MEDICO = uuid4()
AGORA = datetime(2026, 11, 19, 12, 0, tzinfo=UTC)


def dados(nome="Maria Teste da Silva", nascimento=date(1990, 5, 2), sexo="F"):
    return DadosPessoais(
        nome_completo=nome,
        nascimento=nascimento,
        sexo=sexo,
        whatsapp="(85) 99999-0000",
        cidade="Fortaleza",
        uf="CE",
        estado_civil="casado",
        profissao="professora",
    )


@pytest.fixture
def mundo():
    pacientes = RepositorioPacientesMemoria()
    return RepositorioAgendaMemoria(), pacientes, RepositorioConsultasMemoria(pacientes)


def pedido(agenda, inicio="10:00", formulario=None, medico=MEDICO, modalidade="online"):
    p = agenda.criar_pedido(
        medico,
        NovoPedido(
            modalidade=modalidade,
            data=date(2026, 11, 20),
            inicio=inicio,
            nome="Maria Teste",
            whatsapp="5585999990000",
            pagamento="Particular",
            transcricao="aceita",
            forma="whatsapp",
        ),
        f"token-{inicio}",
    )
    if formulario is not None:
        agenda.gravar_formulario(
            medico, p.id, FormularioRecebido(dados=formulario, respostas={}, fotos=[], recebido_em=AGORA), {}
        )
    return p


def abrir(mundo, p, medico=MEDICO, especialidade="dermatologia"):
    agenda, pacientes, consultas = mundo
    return abrir_do_pedido(agenda, pacientes, consultas, medico, p.id, especialidade)


def test_abre_cria_paciente_e_consulta_com_modalidade_e_hora_do_pedido(mundo):
    c = abrir(mundo, pedido(mundo[0], formulario=dados()))
    paciente = mundo[1].buscar(MEDICO, c.paciente_id)
    assert (paciente.nome, paciente.nascimento, paciente.sexo) == ("Maria Teste da Silva", date(1990, 5, 2), "F")
    assert (paciente.estado_civil, paciente.profissao) == ("casado", "professora")
    assert (c.tipo, c.modalidade, c.especialidade) == ("consulta", "online", "dermatologia")
    assert c.agendada_para == datetime(2026, 11, 20, 13, 0, tzinfo=UTC)  # 10:00 no consultório (UTC-3)


def test_abrir_duas_vezes_devolve_a_mesma_consulta(mundo):
    p = pedido(mundo[0], formulario=dados())
    a, b = abrir(mundo, p), abrir(mundo, p)
    assert a.id == b.id and a.pedido_id == p.id
    assert len(mundo[2]._dados) == 1 and len(mundo[1]._dados) == 1


def test_pedido_sem_formulario_e_recusado_com_mensagem_clara(mundo):
    with pytest.raises(ErroEtapa, match="Identificação"):
        abrir(mundo, pedido(mundo[0]))


def test_mesma_pessoa_em_outro_pedido_reaproveita_o_paciente(mundo):
    a = abrir(mundo, pedido(mundo[0], "10:00", dados()))
    b = abrir(mundo, pedido(mundo[0], "11:00", dados()))
    assert a.paciente_id == b.paciente_id and a.id != b.id
    assert len(mundo[1]._dados) == 1


def test_pessoa_diferente_com_o_mesmo_nome_e_outro_nascimento_e_outro_paciente(mundo):
    a = abrir(mundo, pedido(mundo[0], "10:00", dados()))
    b = abrir(mundo, pedido(mundo[0], "11:00", dados(nascimento=date(1991, 5, 2))))
    assert a.paciente_id != b.paciente_id


def test_paciente_que_ja_finalizou_uma_consulta_volta_em_nova_consulta_nunca_retorno(mundo):
    primeira = abrir(mundo, pedido(mundo[0], "10:00", dados()))
    assert primeira.tipo == "consulta"
    mundo[2].finalizar(MEDICO, primeira.id, DADOS_MINIMOS, {}, AGORA)
    assert abrir(mundo, pedido(mundo[0], "11:00", dados())).tipo == "consulta"


def test_pedido_de_outro_medico_nao_existe(mundo):
    p = pedido(mundo[0], formulario=dados())
    with pytest.raises(PedidoNaoEncontrado):
        abrir(mundo, p, medico=uuid4())


def test_sexo_intersexo_do_formulario_e_aceito(mundo):
    c = abrir(mundo, pedido(mundo[0], formulario=dados(sexo="I")))
    assert mundo[1].buscar(MEDICO, c.paciente_id).sexo == "I"


# ---- abrir o cartão "Retorno" da agenda ----

from app.agenda.repositorio import RetornoNaoEncontrado  # noqa: E402
from app.consulta.abertura import abrir_do_retorno  # noqa: E402
from app.contratos.agenda import RetornoMarcado  # noqa: E402


def cartao_de_retorno(mundo, medico=MEDICO):
    """Consulta de origem finalizada + cartão de retorno marcado para 25/11 às 14:00 (online)."""
    origem = abrir(mundo, pedido(mundo[0], "10:00", dados()))
    mundo[2].finalizar(medico, origem.id, DADOS_MINIMOS, {}, AGORA)
    marcado = RetornoMarcado(data=date(2026, 11, 25), inicio="14:00", modalidade="online")
    cartao = mundo[0].criar_retorno(medico, origem.paciente_id, "Maria Teste da Silva", origem.id, marcado)
    return origem, cartao


def abrir_retorno(mundo, cartao, medico=MEDICO, especialidade="dermatologia"):
    agenda, _, consultas = mundo
    return abrir_do_retorno(agenda, consultas, medico, cartao.id, especialidade)


def test_abrir_o_cartao_cria_o_retorno_do_mesmo_paciente_com_hora_e_modalidade_do_cartao(mundo):
    origem, cartao = cartao_de_retorno(mundo)
    r = abrir_retorno(mundo, cartao)
    assert (r.tipo, r.paciente_id, r.modalidade, r.retorno_id) == ("retorno", origem.paciente_id, "online", cartao.id)
    assert r.agendada_para == datetime(2026, 11, 25, 17, 0, tzinfo=UTC)  # 14:00 no consultório (UTC-3)
    assert r.finalizada_em is None and r.id != origem.id


def test_abrir_o_cartao_duas_vezes_devolve_o_mesmo_retorno(mundo):
    _, cartao = cartao_de_retorno(mundo)
    a, b = abrir_retorno(mundo, cartao), abrir_retorno(mundo, cartao)
    assert a.id == b.id
    assert sum(c.consulta.tipo == "retorno" for c in mundo[2]._dados.values()) == 1


def test_retorno_ja_finalizado_volta_finalizado_e_nao_abre_outro(mundo):
    _, cartao = cartao_de_retorno(mundo)
    r = abrir_retorno(mundo, cartao)
    mundo[2].finalizar(MEDICO, r.id, DADOS_MINIMOS, {}, AGORA)
    de_novo = abrir_retorno(mundo, cartao)
    assert de_novo.id == r.id and de_novo.finalizada_em is not None


def test_cartao_de_outro_medico_ou_inexistente_nao_abre(mundo):
    _, cartao = cartao_de_retorno(mundo)
    with pytest.raises(RetornoNaoEncontrado):
        abrir_retorno(mundo, cartao, medico=uuid4())
    with pytest.raises(RetornoNaoEncontrado):
        abrir_do_retorno(mundo[0], mundo[2], MEDICO, uuid4(), "dermatologia")


def test_depois_do_retorno_a_proxima_vez_do_paciente_e_consulta_2(mundo):
    _, cartao = cartao_de_retorno(mundo)
    r = abrir_retorno(mundo, cartao)
    mundo[2].finalizar(MEDICO, r.id, DADOS_MINIMOS, {}, AGORA)
    proxima = abrir(mundo, pedido(mundo[0], "11:00", dados()))
    assert proxima.tipo == "consulta" and proxima.paciente_id == r.paciente_id
