import pytest
from pydantic import ValidationError

from casos_de_teste.formato import Caso, Diagnostico
from conftest import caso_minimo


def test_caso_minimo_e_valido():
    assert Caso.model_validate(caso_minimo()).id == "derm-001-teste"


def test_campo_desconhecido_e_recusado():
    dados = caso_minimo()
    dados["esperado"]["diagnostico"] = {}
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


@pytest.mark.parametrize("cid", ["L70", "L70.0", "C43.59"])
def test_cid_valido(cid):
    assert Diagnostico(nome="x", cid=cid).cid == cid


@pytest.mark.parametrize("cid", ["l70", "L7", "L70.", "L700", "L70.123"])
def test_cid_invalido(cid):
    with pytest.raises(ValidationError):
        Diagnostico(nome="x", cid=cid)


@pytest.mark.parametrize("id_", ["derm-1-acne", "DERM-001-acne", "derm-001-Acne", "derm-001-"])
def test_id_invalido(id_):
    dados = caso_minimo()
    dados["id"] = id_
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_falas_precisam_de_ao_menos_uma_do_paciente():
    dados = caso_minimo()
    dados["entrada"]["falas"] = [{"quem": "Médico", "texto": "Bom dia."}]
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_secao_nao_pode_ser_esperada_e_vazia_ao_mesmo_tempo():
    dados = caso_minimo()
    dados["esperado"]["historia"] = {"deve_conter": {"hf": ["mãe"]}, "vazias": ["hf"]}
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_idade_fora_da_faixa():
    dados = caso_minimo()
    dados["entrada"]["paciente"]["idade"] = 121
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)
