import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contratos.motor import PropostaIA
from app.contratos.paciente import NovoPaciente
from app.contratos.prontuario import EntradaProntuario

BRUTO = json.loads(Path("tests/dados/entrada_joao.json").read_text(encoding="utf-8"))


def copia() -> dict:
    return json.loads(json.dumps(BRUTO))


def test_entrada_do_frontend_valida_sem_perda():
    entrada = EntradaProntuario.model_validate(BRUTO)
    assert entrada.dados.exame_fisico.startswith("Placas")
    assert entrada.model_dump(by_alias=True, mode="json", exclude_none=True) == _sem_nulos(BRUTO)


def _sem_nulos(x):
    if isinstance(x, dict):
        return {k: _sem_nulos(v) for k, v in x.items() if v is not None}
    if isinstance(x, list):
        return [_sem_nulos(v) for v in x]
    return x


def test_mais_de_3_diagnosticos_e_recusado():
    d = copia()
    d["dados"]["diagnosticos"].append({"nome": "Outro", "cid": "L30.9", "pct": 1, "situacao": "sugerido"})
    with pytest.raises(ValidationError):
        EntradaProntuario.model_validate(d)


def test_campo_desconhecido_no_prontuario_e_recusado():
    d = copia()
    d["dados"]["extra"] = "x"
    with pytest.raises(ValidationError):
        EntradaProntuario.model_validate(d)


def test_atestado_e_laudo_sao_uniao_discriminada():
    d = copia()
    d["dados"]["documentos"] = [
        {"tipo": "atestado", "de": "2026-11-13", "ate": "2026-11-15", "resumo": "de 13/11 a 15/11/2026"},
        {"tipo": "laudo", "finalidade": "INSS", "resumo": "para o INSS"},
    ]
    entrada = EntradaProntuario.model_validate(d)
    assert [x.tipo for x in entrada.dados.documentos] == ["atestado", "laudo"]
    d["dados"]["documentos"] = [{"tipo": "laudo", "de": "x", "resumo": "y"}]
    with pytest.raises(ValidationError):
        EntradaProntuario.model_validate(d)


def proposta(**mudar: object) -> dict:
    base: dict = {
        "resultado": None,
        "confianca": 0.5,
        "evidencias": [],
        "avisos": [],
        "origem": "sugestão da IA",
        "acao": "HUMAN_REVIEW",
        "motivos": [],
    }
    base.update(mudar)
    return base


def test_confianca_fora_de_0_1_e_recusada():
    with pytest.raises(ValidationError):
        PropostaIA[dict].model_validate(proposta(confianca=1.2))


def test_auto_execute_nao_existe():
    with pytest.raises(ValidationError):
        PropostaIA[dict].model_validate(proposta(acao="AUTO_EXECUTE"))


def test_cpf_com_letras_e_recusado():
    with pytest.raises(ValidationError):
        NovoPaciente(nome="Ana Teste", nascimento="1992-03-14", sexo="F", cpf="123abc")


def test_cpf_e_opcional():
    assert NovoPaciente(nome="Ana Teste", nascimento="1992-03-14", sexo="F").cpf is None
