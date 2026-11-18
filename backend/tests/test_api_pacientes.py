from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.aplicacao import Dependencias, criar_app
from app.identidade import MedicoLocal
from app.pacientes.repositorio import RepositorioPacientesMemoria

MEDICO_A = UUID("00000000-0000-4000-8000-000000000001")
MEDICO_B = UUID("00000000-0000-4000-8000-000000000002")
ANA = {"nome": "Ana Teste", "nascimento": "1992-03-14", "sexo": "F", "estadoCivil": "solteira"}


@pytest.fixture
def repo():
    return RepositorioPacientesMemoria()


def cliente(repo, medico=MEDICO_A):
    return TestClient(criar_app(Dependencias(identidade=MedicoLocal(medico), pacientes=repo)))


def test_saude(repo):
    assert cliente(repo).get("/saude").json() == {"ok": True}


def test_cria_paciente_com_id_proprio(repo):
    r = cliente(repo).post("/pacientes", json=ANA)
    assert r.status_code == 201
    assert UUID(r.json()["id"]) and r.json()["nome"] == "Ana Teste"


def test_busca_o_paciente_criado(repo):
    c = cliente(repo)
    pid = c.post("/pacientes", json=ANA).json()["id"]
    r = c.get(f"/pacientes/{pid}")
    assert r.status_code == 200 and r.json()["id"] == pid


def test_paciente_de_outro_medico_e_404(repo):
    pid = cliente(repo, MEDICO_A).post("/pacientes", json=ANA).json()["id"]
    r = cliente(repo, MEDICO_B).get(f"/pacientes/{pid}")
    assert r.status_code == 404
    assert r.json() == {"detail": "paciente não encontrado"}


def test_id_que_nao_e_uuid_e_422(repo):
    assert cliente(repo).get("/pacientes/abc").status_code == 422


def test_corpo_invalido_e_422(repo):
    assert cliente(repo).post("/pacientes", json={**ANA, "sexo": "X"}).status_code == 422


def test_campo_desconhecido_e_422(repo):
    assert cliente(repo).post("/pacientes", json={**ANA, "apelido": "Aninha"}).status_code == 422


def test_json_em_camel_case(repo):
    corpo = cliente(repo).post("/pacientes", json=ANA).json()
    assert "estadoCivil" in corpo and "criadoEm" in corpo and "estado_civil" not in corpo


def test_cpf_repetido_e_409(repo):
    c = cliente(repo)
    assert c.post("/pacientes", json={**ANA, "cpf": "12345678901"}).status_code == 201
    r = c.post("/pacientes", json={**ANA, "cpf": "12345678901"})
    assert r.status_code == 409 and r.json() == {"detail": "já existe paciente com este CPF"}


def test_mesmo_cpf_em_outro_medico_e_permitido(repo):
    assert cliente(repo, MEDICO_A).post("/pacientes", json={**ANA, "cpf": "12345678901"}).status_code == 201
    assert cliente(repo, MEDICO_B).post("/pacientes", json={**ANA, "cpf": "12345678901"}).status_code == 201


def test_cpf_com_digitos_unicode_e_422(repo):
    assert cliente(repo).post("/pacientes", json={**ANA, "cpf": "١٢٣٤٥٦٧٨٩٠١"}).status_code == 422
