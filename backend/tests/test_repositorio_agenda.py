"""Retorno marcado na agenda (repositório em memória): vira cartão, ocupa o horário e some ao desfazer."""

from datetime import date
from uuid import uuid4

import pytest

from app.agenda.repositorio import HorarioOcupado, RepositorioAgendaMemoria
from app.contratos.agenda import NovoPedido, RetornoMarcado

MEDICO = uuid4()
OUTRO = uuid4()
PACIENTE = uuid4()
DIA = date(2027, 3, 5)


def marcado(inicio: str = "14:00", modalidade: str = "presencial") -> RetornoMarcado:
    return RetornoMarcado(data=DIA, inicio=inicio, modalidade=modalidade)


def pedido(inicio: str) -> NovoPedido:
    return NovoPedido(
        data=DIA,
        inicio=inicio,
        modalidade="presencial",
        nome="Maria Teste",
        whatsapp="5585999990000",
        pagamento="Particular",
        transcricao="aceita",
        forma="pagina",
    )


def novo_repo() -> RepositorioAgendaMemoria:
    return RepositorioAgendaMemoria({"ana": MEDICO})


def test_criar_retorno_aparece_em_retornos_e_em_ocupados():
    repo = novo_repo()
    origem = uuid4()
    r = repo.criar_retorno(MEDICO, PACIENTE, "João Lima", origem, marcado())
    assert (r.paciente_id, r.paciente_nome, r.consulta_origem_id, r.inicio) == (PACIENTE, "João Lima", origem, "14:00")
    assert repo.retornos(MEDICO, DIA, DIA) == [r]
    assert [(h.data, h.inicio) for h in repo.ocupados(MEDICO, DIA, DIA)] == [(DIA, "14:00")]


def test_retorno_no_horario_de_pedido_levanta_horario_ocupado():
    repo = novo_repo()
    repo.criar_pedido(MEDICO, pedido("14:00"), "t" * 32)
    with pytest.raises(HorarioOcupado):
        repo.criar_retorno(MEDICO, PACIENTE, "João", uuid4(), marcado("14:00"))


def test_pedido_no_horario_de_retorno_levanta_horario_ocupado():
    repo = novo_repo()
    repo.criar_retorno(MEDICO, PACIENTE, "João", uuid4(), marcado("14:00"))
    with pytest.raises(HorarioOcupado):
        repo.criar_pedido(MEDICO, pedido("14:00"), "t" * 32)


def test_dois_retornos_no_mesmo_horario_levantam_horario_ocupado():
    repo = novo_repo()
    repo.criar_retorno(MEDICO, PACIENTE, "João", uuid4(), marcado("14:00"))
    with pytest.raises(HorarioOcupado):
        repo.criar_retorno(MEDICO, uuid4(), "Ana", uuid4(), marcado("14:00"))


def test_desfazer_retorno_libera_o_horario():
    repo = novo_repo()
    origem = uuid4()
    repo.criar_retorno(MEDICO, PACIENTE, "João", origem, marcado("14:00"))
    repo.desfazer_retorno(MEDICO, origem)
    assert repo.retornos(MEDICO, DIA, DIA) == [] and repo.ocupados(MEDICO, DIA, DIA) == []
    repo.criar_retorno(MEDICO, PACIENTE, "João", uuid4(), marcado("14:00"))


def test_retornos_so_do_medico_dono():
    repo = novo_repo()
    repo.criar_retorno(MEDICO, PACIENTE, "João", uuid4(), marcado())
    assert repo.retornos(OUTRO, DIA, DIA) == []
    assert repo.ocupados(OUTRO, DIA, DIA) == []
