from datetime import UTC, datetime

from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo
from casos_de_teste.avaliadora import Criterio, avaliar, calibrar, carregar_calibracao

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "avaliadora"}
TEXTO = "Paciente refere espinhas no rosto há 6 meses. Nega febre. Isotretinoína contraindicada pela gestação."
CRITERIOS = [
    Criterio(n=1, tipo="fato", texto="Espinhas no rosto há 6 meses"),
    Criterio(n=2, tipo="proibido", texto="Prescrever isotretinoína"),
]


def v(n, veredito, trecho, justificativa="ok"):
    return {"n": n, "veredito": veredito, "trecho": trecho, "justificativa": justificativa}


def rodar(vereditos, criterios=CRITERIOS):
    falso = ProvedorIAFalso({"avaliadora": {"resultado": {"vereditos": vereditos}, "meta": META}})
    registros: list = []
    return avaliar(falso, TEXTO, criterios, RelogioFixo(QUANDO), registros.append), falso


def test_vereditos_validos_passam():
    r, falso = rodar([v(1, "cumprido", "espinhas no rosto há 6 meses"), v(2, "cumprido", None)])
    assert [x.veredito for x in r] == ["cumprido", "cumprido"]
    [p] = falso.pedidos
    assert (p.motor, p.esforco, p.versao_prompt) == ("avaliadora", "medium", "avaliadora-1")
    assert p.dados["texto"] == TEXTO and len(p.dados["criterios"]) == 2


def test_cumprido_sem_trecho_vira_duvida():
    r, _ = rodar([v(1, "cumprido", None), v(2, "cumprido", None)])
    assert r[0].veredito == "duvida" and r[1].veredito == "cumprido"


def test_trecho_que_nao_esta_no_texto_vira_duvida():
    r, _ = rodar([v(1, "cumprido", "espinhas há seis meses"), v(2, "cumprido", None)])
    assert r[0].veredito == "duvida"


def test_violado_em_proibido_exige_trecho():
    r, _ = rodar([v(1, "cumprido", "espinhas no rosto há 6 meses"), v(2, "violado", None)])
    assert r[1].veredito == "duvida"
    r, _ = rodar([v(1, "cumprido", "espinhas no rosto há 6 meses"), v(2, "violado", "Isotretinoína")])
    assert r[1].veredito == "violado"


def test_violado_em_fato_nao_exige_trecho():
    r, _ = rodar([v(1, "violado", None), v(2, "cumprido", None)])
    assert r[0].veredito == "violado"


def test_criterio_sem_veredito_vira_duvida():
    r, _ = rodar([v(2, "cumprido", None)])
    assert [(x.n, x.veredito) for x in r] == [(1, "duvida"), (2, "cumprido")]


def test_veredito_repetido_vira_duvida():
    r, _ = rodar(
        [v(1, "cumprido", "espinhas no rosto há 6 meses"), v(2, "cumprido", None), v(2, "violado", "Isotretinoína")]
    )
    assert [(x.n, x.veredito) for x in r] == [(1, "cumprido"), (2, "duvida")]


def test_ia_rejeitada_tudo_duvida():
    falso = ProvedorIAFalso({"avaliadora": "timeout"})
    r = avaliar(falso, TEXTO, CRITERIOS, RelogioFixo(QUANDO), lambda x: None)
    assert [x.veredito for x in r] == ["duvida", "duvida"]


def test_sem_criterios_nao_chama_a_ia():
    falso = ProvedorIAFalso({})
    assert avaliar(falso, TEXTO, [], RelogioFixo(QUANDO), lambda x: None) == [] and falso.pedidos == []


def test_calibracao_carrega_8_pares():
    pares = carregar_calibracao()
    assert len(pares) == 8 and {p.esperado for p in pares} == {"cumprido", "violado"}
    assert all(
        p.criterio.tipo in {"fato", "negativa", "sem_resposta", "desconhecido", "obrigatorio", "proibido"}
        for p in pares
    )


def test_calibrar_conta_acertos_e_discordancias():
    pares = carregar_calibracao()

    class Sempre:
        def __init__(self):
            self.pedidos = []

        def gerar(self, pedido, esquema):
            from app.provedores.ia import RespostaIA

            self.pedidos.append(pedido)
            texto = pedido.dados["texto"]
            vereditos = [
                {"n": c["n"], "veredito": "violado", "trecho": texto[:5], "justificativa": "x"}
                for c in pedido.dados["criterios"]
            ]
            return RespostaIA({"resultado": {"vereditos": vereditos}, "meta": META}, "falso", "0", 0, 0, None)

    acertos, total, discordancias = calibrar(Sempre(), RelogioFixo(QUANDO))
    violados = sum(p.esperado == "violado" for p in pares)
    assert (acertos, total) == (violados, 8) and len(discordancias) == 8 - violados
