import pytest
from conftest import caso_minimo
from pydantic import ValidationError

from casos_de_teste.formato import Caso, Diagnostico


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


def test_idade_fora_da_faixa():
    dados = caso_minimo()
    dados["entrada"]["paciente"]["idade"] = 121
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_versao_1_e_recusada():
    dados = caso_minimo()
    dados["versao_formato"] = 1
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_diagnostico_principal_exige_certeza():
    dados = caso_minimo()
    del dados["esperado"]["diagnosticos"]["principal"]["certeza"]
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_certeza_desconhecida_e_recusada():
    dados = caso_minimo()
    dados["esperado"]["diagnosticos"]["principal"]["certeza"] = "confirmado"
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_conduta_exige_urgencia():
    dados = caso_minimo()
    del dados["esperado"]["conduta"]["urgencia"]
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_historia_exige_ao_menos_um_fato():
    dados = caso_minimo()
    dados["esperado"]["historia"]["fatos"] = []
    with pytest.raises(ValidationError):
        Caso.model_validate(dados)


def test_criterios_completos_sao_aceitos():
    dados = caso_minimo()
    dados["esperado"]["historia"].update(negativas=["febre"], desconhecidos=["história familiar"])
    dados["esperado"]["diagnosticos"].update(
        aceitos=[{"nome": "Rosácea", "cid": "L71.9"}], rastrear=["Hiperandrogenismo: perguntar"]
    )
    dados["esperado"]["conduta"].update(proibidos=["Recomendar isotretinoína"], remedios_proibidos=["isotretinoína"])
    caso = Caso.model_validate(dados)
    assert caso.esperado.conduta.remedios_proibidos == ["isotretinoína"]


def test_perguntado_sem_resposta_e_separado_de_nao_perguntado():
    dados = caso_minimo()
    dados["esperado"]["historia"].update(sem_resposta=["duração"], desconhecidos=["sintomas"])
    h = Caso.model_validate(dados).esperado.historia
    assert h.sem_resposta == ["duração"] and h.desconhecidos == ["sintomas"]
