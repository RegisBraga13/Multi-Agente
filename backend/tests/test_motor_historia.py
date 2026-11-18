from datetime import UTC, datetime

from app.contratos.consulta import EntradaConsulta, ExameDerm, Fala
from app.motores.historia import VERSAO_ESQUEMA_HISTORIA, motor_historia
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
HISTORIA = {
    "qp": "Espinhas no rosto.",
    "hda": "Paciente, 34 anos, feminino, refere espinhas no rosto há 6 meses.",
    "ap": "Nega comorbidades.",
    "hp": "",
    "hf": "",
    "exameFisico": "Pápulas e pústulas em face.",
    "examesTexto": "",
}

ENTRADA = EntradaConsulta(
    paciente="Paciente, 34 anos, feminino",
    em_uso=[],
    antecedentes=[],
    alergias=[],
    falas=[Fala(quem="Paciente", texto="Espinhas no rosto há 6 meses.")],
    sinais=[],
    exame=ExameDerm(morfologia="Pápulas e pústulas", localizacao="Face", extensao=None, gravidade=None, achados=None),
    complementares=[],
)


def rodar(resposta):
    falso = ProvedorIAFalso({"historia": resposta})
    registros: list = []
    proposta = motor_historia(falso, ENTRADA, RelogioFixo(QUANDO), registros.append)
    return proposta, registros, falso


def test_pedido_da_historia_e_desidentificado_e_versionado():
    _, registros, falso = rodar({"resultado": HISTORIA, "meta": META})
    [p] = falso.pedidos
    assert (p.motor, p.versao_prompt, p.esforco) == ("historia", "historia-derm-1", "medium")
    assert list(p.dados) == ["consulta"] and p.dados["consulta"]["paciente"] == "Paciente, 34 anos, feminino"
    assert p.dados["consulta"]["exame"]["extensao"] is None
    assert registros[0].versao_esquema == VERSAO_ESQUEMA_HISTORIA


def test_historia_valida_vai_ao_medico():
    proposta, _, _ = rodar({"resultado": HISTORIA, "meta": META})
    assert proposta.acao == "HUMAN_REVIEW" and proposta.resultado is not None
    assert proposta.resultado.exame_fisico == "Pápulas e pústulas em face."


def test_historia_com_campo_faltando_e_rejeitada():
    sem_hf = {k: v for k, v in HISTORIA.items() if k != "hf"}
    proposta, _, _ = rodar({"resultado": sem_hf, "meta": META})
    assert proposta.acao == "REJECT" and proposta.resultado is None


def test_termos_proibidos_chegam_a_chamada():
    falso = ProvedorIAFalso({"historia": {"resultado": HISTORIA, "meta": META}})
    import pytest

    from app.motores.chamada import ErroPrivacidade

    with pytest.raises(ErroPrivacidade):
        motor_historia(falso, ENTRADA, RelogioFixo(QUANDO), lambda r: None, termos_proibidos=["espinhas"])


def test_historia_transmite_parciais():
    falso = ProvedorIAFalso({"historia": {"resultado": HISTORIA, "meta": META}})
    parciais: list = []
    proposta = motor_historia(falso, ENTRADA, RelogioFixo(QUANDO), lambda r: None, ao_escrever=parciais.append)
    assert proposta.acao == "HUMAN_REVIEW" and parciais[-1]["exameFisico"] == "Pápulas e pústulas em face."
