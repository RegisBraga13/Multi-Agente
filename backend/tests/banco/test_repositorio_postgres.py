from datetime import date

import pytest

from app.contratos.paciente import NovoPaciente
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres
from tests.banco.conftest import MEDICO_A, MEDICO_B

pytestmark = pytest.mark.banco

ANA = NovoPaciente(nome="Ana Teste", nascimento=date(1992, 3, 14), sexo="F", estado_civil="solteira", cpf="12345678901")


def test_cria_e_busca_no_postgres(url_banco):
    repo = RepositorioPacientesPostgres(url_banco)
    criado = repo.criar(MEDICO_A, ANA)
    assert repo.buscar(MEDICO_A, criado.id) == criado
    assert criado.estado_civil == "solteira" and criado.nascimento == date(1992, 3, 14)


def test_postgres_nao_devolve_paciente_de_outro_medico(url_banco):
    repo = RepositorioPacientesPostgres(url_banco)
    criado = repo.criar(MEDICO_A, ANA.model_copy(update={"cpf": None}))
    assert repo.buscar(MEDICO_B, criado.id) is None
