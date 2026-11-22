import json
from datetime import UTC, datetime

import pytest

from app.contratos.consulta import EntradaConsulta, ExameDerm, Fala
from app.especialidades.guias import carregar_guias
from app.especialidades.pacote import carregar_sinais
from app.motores.chamada import ErroPrivacidade
from app.motores.historia import HistoriaClinica
from app.motores.perguntas import motor_perguntas
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 21, 12, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
CATALOGO = carregar_sinais("dermatologia")
GUIAS = carregar_guias("dermatologia")
ENTRADA = EntradaConsulta(
    paciente="Paciente, 73 anos, masculino",
    em_uso=["AAS 100 mg"],
    antecedentes=[],
    alergias=[],
    falas=[Fala(quem="Paciente", texto="Tenho uma ferida no nariz há 3 meses.")],
    sinais=[],
    exame=ExameDerm(morfologia="Pápula perolada", localizacao="Asa nasal", extensao=None, gravidade=None, achados=None),
    complementares=[],
)
HISTORIA = HistoriaClinica(
    qp="Ferida no nariz.",
    hda="Paciente, 73 anos, refere ferida na asa nasal há 3 meses.",
    ap="",
    hp="",
    hf="",
    exame_fisico="Pápula perolada na asa nasal.",
    exames_texto="",
)


def pergunta(
    texto="A ferida sangra ao toque leve?",
    sinal_id=None,
    sim="Refere sangramento ao toque.",
    nao="Nega sangramento ao toque.",
):
    return {"texto": texto, "seSim": sim, "seNao": nao, "sinalId": sinal_id}


def ia(*perguntas):
    return {"resultado": {"perguntas": list(perguntas)}, "meta": META}


def rodar(resposta, historia=HISTORIA, termos=()):
    falso = ProvedorIAFalso({"perguntas": resposta})
    registros: list = []
    r = motor_perguntas(falso, ENTRADA, historia, CATALOGO, GUIAS, RelogioFixo(QUANDO), registros.append, termos)
    return r, falso, registros


def test_pergunta_com_sinal_do_catalogo_mantem_o_id_e_nasce_sem_resposta():
    r, _, _ = rodar(
        ia(
            pergunta(sinal_id="lesao-sangra-facil"),
            pergunta("Toma anticoagulante?", None, "Usa anticoagulante.", "Nega anticoagulante."),
        )
    )
    assert [(p.id, p.sinal_id, p.resposta) for p in r.perguntas] == [
        ("p1", "lesao-sangra-facil", None),
        ("p2", None, None),
    ]
    assert r.perguntas[0].se_sim == "Refere sangramento ao toque." and r.avisos == [] and not r.ia_falhou


def test_sinal_id_inexistente_vira_pergunta_livre_com_aviso():
    r, _, _ = rodar(ia(pergunta(sinal_id="sinal-inventado")))
    assert r.perguntas[0].sinal_id is None
    assert any("sinal-inventado" in a for a in r.avisos)


def test_ia_falhou_devolve_lista_vazia_com_aviso():
    r, _, registros = rodar("timeout")
    assert r.perguntas == [] and r.ia_falhou and r.avisos and registros[0].acao == "REJECT"


def test_resposta_vazia_devolve_lista_vazia_sem_falha():
    r, _, _ = rodar(ia())
    assert r.perguntas == [] and not r.ia_falhou


def test_pedido_leva_a_historia_o_catalogo_e_os_guias_e_nao_leva_nome():
    _, falso, _ = rodar(ia(pergunta()))
    dados = falso.pedidos[0].dados
    assert {"consulta", "historia", "catalogo", "guias"} <= set(dados)
    assert len(dados["catalogo"]) == len(CATALOGO) and len(dados["guias"]) == len(GUIAS)
    assert "Maria" not in json.dumps(dados, ensure_ascii=False)


def test_nome_do_paciente_na_historia_bloqueia_o_pedido():
    com_nome = HISTORIA.model_copy(update={"hda": "Paciente Joaquim refere ferida."})
    falso = ProvedorIAFalso({"perguntas": ia(pergunta())})
    with pytest.raises(ErroPrivacidade):
        motor_perguntas(falso, ENTRADA, com_nome, CATALOGO, GUIAS, RelogioFixo(QUANDO), lambda r: None, ["Joaquim"])
    assert falso.pedidos == []


def test_mais_de_15_perguntas_e_resposta_invalida():
    r, _, _ = rodar(ia(*[pergunta(f"Pergunta {i}?") for i in range(16)]))
    assert r.perguntas == [] and r.ia_falhou
