from datetime import UTC, datetime

from app.especialidades.condutas import carregar_protocolos
from app.especialidades.pacote import carregar_sinais
from app.motores.conduta import DiagnosticoConfirmado, motor_conduta, remedios_da_conduta, texto_da_conduta
from app.motores.diagnosticos import DadosSeguranca
from app.motores.sinais import SinalDisparado
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.7, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
LISTA = {s.id: s for s in carregar_sinais("dermatologia")}
PROTOCOLOS = carregar_protocolos("dermatologia")
ACNE = DiagnosticoConfirmado(nome="Acne vulgar", cid="L70.0", certeza="clinico")
URTICARIA = DiagnosticoConfirmado(nome="Urticária aguda", cid="L50.0", certeza="hipotese")

COMPLEMENTO = {"resultado": {"orientacoes": ["Conversar sobre o plano de gestação"], "alertas": []}, "meta": META}
ITEM = {
    "nome": "Bilastina",
    "forma": "COMP",
    "concentracao": "20mg",
    "quantidade": {"n": 30, "unidade": "COMP", "feminino": False},
    "via": "oral",
    "posologia": "Tomar 1 COMP VO, 1 vez ao dia.",
    "duracao": "30 dias",
    "controlado": None,
}
CONDUTA_IA = {
    "resultado": {
        "grupos": [
            {
                "id": "sistemico",
                "opcoes": [{"rotulo": "Anti-histamínico", "texto": "Anti-histamínico oral.", "receita": [ITEM]}],
            },
        ],
        "alertas": ["Avaliar via aérea"],
    },
    "meta": META,
}


def sinal(id_: str) -> SinalDisparado:
    s = LISTA[id_]
    return SinalDisparado(
        id=s.id, texto=s.texto, tipo=s.tipo, acao=s.acao, prazo=s.prazo, origem="respondido", trecho=None
    )


def seguranca(*ids: str) -> DadosSeguranca:
    return DadosSeguranca(alergias=[], em_uso=[], sinais=[sinal(i) for i in ids])


def rodar(dx, seg, respostas):
    falso = ProvedorIAFalso(respostas)
    registros: list = []
    c = motor_conduta(falso, dx, seg, PROTOCOLOS, RelogioFixo(QUANDO), registros.append)
    return c, falso, registros


def test_com_tabela_ia_so_complementa():
    c, falso, _ = rodar(ACNE, seguranca("gestacao-ou-plano"), {"conduta-complemento": COMPLEMENTO})
    [p] = falso.pedidos
    assert (p.motor, p.esforco, p.versao_prompt) == ("conduta-complemento", "medium", "conduta-derm-1")
    assert c.origem == "protocolo acne v1" and c.ia is None and c.acao == "HUMAN_REVIEW"
    assert c.complemento.orientacoes == ["Conversar sobre o plano de gestação"]
    remedios = remedios_da_conduta(c)
    assert "Ácido azelaico" in remedios and "Isotretinoína" not in remedios
    assert p.dados["tabela"]["chave"] == "acne"


def test_sem_tabela_ia_propoe_marcada():
    c, falso, _ = rodar(URTICARIA, seguranca(), {"conduta": CONDUTA_IA})
    assert falso.pedidos[0].motor == "conduta"
    assert c.origem == "sugestão da IA" and c.tabela is None and c.ia is not None
    assert remedios_da_conduta(c) == ["Bilastina"] and c.urgencia == "rotina"


def test_emergencia_entra_mesmo_com_ia_rejeitada():
    c, _, _ = rodar(URTICARIA, seguranca("angioedema"), {"conduta": "timeout"})
    assert c.urgencia == "imediata" and c.emergencia == LISTA["angioedema"].acao
    assert any("A IA não conseguiu" in a for a in c.avisos)


def test_sem_tabela_e_ia_rejeitada_e_reject():
    c, _, registros = rodar(URTICARIA, seguranca(), {"conduta": "timeout"})
    assert c.acao == "REJECT" and registros[0].acao == "REJECT"


def test_com_tabela_e_ia_rejeitada_continua_com_a_tabela():
    c, _, _ = rodar(ACNE, seguranca(), {"conduta-complemento": "timeout"})
    assert c.acao == "HUMAN_REVIEW" and c.tabela is not None and c.complemento is None
    assert any("A IA não conseguiu" in a for a in c.avisos)


def test_texto_cita_bloqueadas_com_motivo():
    c, _, _ = rodar(ACNE, seguranca("gestacao-ou-plano"), {"conduta-complemento": COMPLEMENTO})
    texto = texto_da_conduta(c)
    assert "Não indicado: Isotretinoína oral — incompatível com gestação ou tentativa de gravidez" in texto
    assert "Ácido azelaico" in texto and "Urgência: rotina" in texto
    assert "Conversar sobre o plano de gestação" in texto


def test_texto_traz_a_emergencia():
    c, _, _ = rodar(URTICARIA, seguranca("angioedema"), {"conduta": CONDUTA_IA})
    texto = texto_da_conduta(c)
    assert "Urgência: imediata" in texto and LISTA["angioedema"].acao[0] in texto and "Bilastina" in texto


def test_pedido_nao_leva_historia():
    _, falso, _ = rodar(URTICARIA, seguranca("angioedema"), {"conduta": CONDUTA_IA})
    [p] = falso.pedidos
    assert sorted(p.dados) == ["diagnostico", "emergencia", "seguranca"]
