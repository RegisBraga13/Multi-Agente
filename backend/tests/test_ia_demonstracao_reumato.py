from pydantic import BaseModel

from app.provedores.ia import PedidoIA
from app.provedores.ia_demonstracao import ProvedorDemonstracao


class _Qualquer(BaseModel):
    pass


def _gerar(motor: str, versao: str, dados: dict) -> dict:
    r = ProvedorDemonstracao().gerar(PedidoIA(motor=motor, versao_prompt=versao, instrucoes="", dados=dados), _Qualquer)
    assert r.bruto is not None
    return r.bruto["resultado"]


def test_reumatologia_tem_respostas_fixas_proprias():
    dd = _gerar("diagnosticos", "diagnosticos-reumato-1", {"historia": {"hda": "Dor nas mãos."}})
    assert dd["hipoteses"][0]["nome"] == "Artrite reumatoide"
    conduta = _gerar("conduta", "conduta-reumato-2", {})
    vias = [i["via"] for g in conduta["grupos"] for o in g["opcoes"] for i in o["receita"]]
    assert "injetavel" in vias


def test_historia_de_reumatologia_leva_o_exame_salvo():
    h = _gerar("historia", "historia-reumato-2", {"consulta": {"exame": {"GALS": "Marcha claudicante.", "IPAM": None}}})
    assert h["exameFisico"] == "GALS: Marcha claudicante."


def test_dermatologia_continua_igual():
    dd = _gerar("diagnosticos", "diagnosticos-derm-2", {"historia": {"hda": "x"}})
    assert dd["hipoteses"][0]["nome"] == "Psoríase vulgar"
