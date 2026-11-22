"""Retorno marcado na agenda, no Postgres: as regras do repositório em memória, mais a RLS e o horário dividido
entre pedidos e retornos."""

from datetime import UTC, date, datetime

import pytest

from app.agenda.repositorio import HorarioOcupado
from app.agenda.repositorio_postgres import RepositorioAgendaPostgres
from app.agenda.servico import novo_token
from app.consulta.repositorio_postgres import RepositorioConsultasPostgres
from app.contratos.agenda import NovoPedido, RetornoMarcado
from app.contratos.consulta_blocos import NovaConsulta
from app.contratos.paciente import NovoPaciente
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres
from tests.banco.conftest import MEDICO_A, MEDICO_B

pytestmark = pytest.mark.banco


def pedido(dia: int, inicio: str) -> NovoPedido:
    return NovoPedido(
        data=date(2027, 4, dia),
        inicio=inicio,
        modalidade="presencial",
        nome="Maria Teste",
        whatsapp="5585999990000",
        pagamento="Particular",
        transcricao="aceita",
        forma="pagina",
    )


def marcado(dia: int, inicio: str = "14:00") -> RetornoMarcado:
    return RetornoMarcado(data=date(2027, 4, dia), inicio=inicio, modalidade="online")


def paciente_e_consulta(url_banco):
    paciente = RepositorioPacientesPostgres(url_banco).criar(
        MEDICO_A, NovoPaciente(nome="João Lima", nascimento=date(1970, 5, 1), sexo="M")
    )
    consulta = RepositorioConsultasPostgres(url_banco).criar(
        MEDICO_A,
        NovaConsulta(
            paciente_id=paciente.id,
            tipo="consulta",
            modalidade="presencial",
            agendada_para=datetime(2027, 2, 1, 11, tzinfo=UTC),
        ),
    )
    return paciente.id, consulta.id


def test_retorno_aparece_em_retornos_e_ocupa_o_horario(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    paciente, consulta = paciente_e_consulta(url_banco)
    r = repo.criar_retorno(MEDICO_A, paciente, "João Lima", consulta, marcado(15))
    assert (r.paciente_nome, r.inicio, r.modalidade, r.consulta_origem_id) == ("João Lima", "14:00", "online", consulta)
    assert repo.retornos(MEDICO_A, date(2027, 4, 15), date(2027, 4, 15)) == [r]
    assert repo.retornos(MEDICO_B, date(2027, 4, 15), date(2027, 4, 15)) == []
    assert [h.inicio for h in repo.ocupados(MEDICO_A, date(2027, 4, 15), date(2027, 4, 15))] == ["14:00"]


def test_retorno_e_pedido_nao_dividem_o_horario(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    paciente, consulta = paciente_e_consulta(url_banco)
    repo.criar_pedido(MEDICO_A, pedido(16, "09:00"), novo_token())
    with pytest.raises(HorarioOcupado):
        repo.criar_retorno(MEDICO_A, paciente, "João Lima", consulta, marcado(16, "09:00"))
    repo.criar_retorno(MEDICO_A, paciente, "João Lima", consulta, marcado(16, "10:00"))
    with pytest.raises(HorarioOcupado):
        repo.criar_pedido(MEDICO_A, pedido(16, "10:00"), novo_token())


def test_desfazer_retorno_libera_o_horario(url_banco):
    repo = RepositorioAgendaPostgres(url_banco)
    paciente, consulta = paciente_e_consulta(url_banco)
    repo.criar_retorno(MEDICO_A, paciente, "João Lima", consulta, marcado(17))
    repo.desfazer_retorno(MEDICO_A, consulta)
    assert repo.retornos(MEDICO_A, date(2027, 4, 17), date(2027, 4, 17)) == []
    repo.criar_pedido(MEDICO_A, pedido(17, "14:00"), novo_token())
