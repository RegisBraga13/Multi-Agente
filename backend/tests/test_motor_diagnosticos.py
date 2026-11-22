from datetime import UTC, datetime

from app.contratos.consulta import Alergia
from app.motores.diagnosticos import DadosSeguranca, motor_diagnosticos
from app.motores.historia import HistoriaClinica
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.8, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
HISTORIA = HistoriaClinica(
    qp="Espinhas no rosto.",
    hda="Paciente, 34 anos, feminino, refere espinhas no rosto há 6 meses, com piora antes da menstruação.",
    ap="Nega comorbidades.",
    hp="",
    hf="",
    exame_fisico="Pápulas, pústulas e comedões em região mandibular.",
    exames_texto="",
)
SEGURANCA = DadosSeguranca(alergias=[Alergia(substancia="Dipirona", reacao="urticária")], em_uso=[], sinais=[])


def ev(trecho: str, lado: str = "favor", secao: str = "exameFisico") -> dict:
    return {"lado": lado, "texto": "achado", "secao": secao, "trecho": trecho}


def hip(nome: str, cid: str, pct: int, evidencias: list[dict], certeza: str = "clinico") -> dict:
    return {"nome": nome, "cid": cid, "certeza": certeza, "pct": pct, "evidencias": evidencias}


def rodar(hipoteses: list[dict], nao_pode_perder=None):
    bruto = {"resultado": {"hipoteses": hipoteses, "naoPodePerder": nao_pode_perder, "rastrear": []}, "meta": META}
    falso = ProvedorIAFalso({"diagnosticos": bruto})
    registros: list = []
    proposta = motor_diagnosticos(falso, HISTORIA, SEGURANCA, RelogioFixo(QUANDO), registros.append)
    return proposta, registros, falso


ACNE = hip("Acne vulgar", "L70.0", 85, [ev("Pápulas, pústulas e comedões")])


def test_hipotese_valida_vai_ao_medico():
    proposta, registros, _ = rodar([ACNE])
    assert proposta.acao == "HUMAN_REVIEW" and proposta.resultado.hipoteses[0].cid == "L70.0"
    assert registros[0].acao == "HUMAN_REVIEW"


def test_trecho_inventado_e_descartado():
    h = hip("Acne vulgar", "L70.0", 85, [ev("Pápulas, pústulas e comedões"), ev("cicatrizes atróficas", "contra")])
    proposta, _, _ = rodar([h])
    assert [e.trecho for e in proposta.resultado.hipoteses[0].evidencias] == ["Pápulas, pústulas e comedões"]
    assert any("cicatrizes atróficas" in a for a in proposta.avisos)


def test_trecho_tem_de_estar_na_secao_citada():
    h = hip("Rosácea", "L71.9", 20, [ev("Pápulas, pústulas e comedões", secao="hda")])
    proposta, _, _ = rodar([ACNE, h])
    assert [x.cid for x in proposta.resultado.hipoteses] == ["L70.0"]


def test_hipotese_sem_evidencia_a_favor_sai():
    h = hip("Foliculite", "L73.9", 30, [ev("piora antes da menstruação", "contra", "hda")])
    proposta, _, _ = rodar([ACNE, h])
    assert [x.nome for x in proposta.resultado.hipoteses] == ["Acne vulgar"]
    assert any("Foliculite" in a for a in proposta.avisos)


def test_nenhuma_hipotese_restante_rejeita_e_registra():
    proposta, registros, _ = rodar([hip("Foliculite", "L73.9", 30, [ev("pelos encravados")])])
    assert proposta.acao == "REJECT" and proposta.resultado is None
    assert any("nenhuma hipótese com evidência" in m for m in proposta.motivos)
    assert registros[0].acao == "REJECT"


def test_cid_invalido_rejeita():
    proposta, _, _ = rodar([hip("Acne vulgar", "L70", 85, [ev("Pápulas, pústulas e comedões")])])
    assert proposta.acao == "HUMAN_REVIEW"  # "L70" é válido (sem subcategoria)
    proposta, _, _ = rodar([hip("Acne vulgar", "l70.0", 85, [ev("Pápulas, pústulas e comedões")])])
    assert proposta.acao == "REJECT"


def test_ordena_por_pct():
    r = hip("Rosácea", "L71.9", 90, [ev("Pápulas, pústulas e comedões")])
    proposta, _, _ = rodar([ACNE, r])
    assert [x.pct for x in proposta.resultado.hipoteses] == [90, 85]


def test_pedido_leva_so_historia_e_seguranca():
    _, _, falso = rodar([ACNE])
    [p] = falso.pedidos
    assert sorted(p.dados) == ["historia", "seguranca"]
    assert (p.motor, p.esforco, p.versao_prompt) == ("diagnosticos", "high", "diagnosticos-derm-2")
    assert p.dados["seguranca"]["alergias"][0]["substancia"] == "Dipirona"
