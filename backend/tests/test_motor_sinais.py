from datetime import UTC, datetime

from app.contratos.consulta import EntradaConsulta, ExameDerm, Fala, SinalRespondido
from app.especialidades.pacote import carregar_sinais
from app.motores.sinais import motor_sinais, sinais_respondidos
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
LISTA = carregar_sinais("dermatologia")


def entrada(sinais=(), falas=("Manchas pelo corpo e tive febre ontem.",)) -> EntradaConsulta:
    return EntradaConsulta(
        paciente="Paciente, 40 anos, masculino",
        em_uso=[],
        antecedentes=[],
        alergias=[],
        falas=[Fala(quem="Paciente", texto=t) for t in falas],
        sinais=list(sinais),
        exame=ExameDerm(
            morfologia="Máculas eritematosas",
            localizacao="Tronco",
            extensao=None,
            gravidade=None,
            achados="Lábios edemaciados",
        ),
        complementares=[],
    )


def sim(id_: str) -> SinalRespondido:
    return SinalRespondido(id=id_, texto=next(s.texto for s in LISTA if s.id == id_), resposta="sim")


def nao(id_: str) -> SinalRespondido:
    return SinalRespondido(id=id_, texto=next(s.texto for s in LISTA if s.id == id_), resposta="nao")


def ia(detectados=(), extras=()):
    return {
        "resultado": {"detectados": [{"id": i, "trecho": t} for i, t in detectados], "extras": list(extras)},
        "meta": META,
    }


def rodar(e, resposta):
    falso = ProvedorIAFalso({"sinais": resposta})
    registros: list = []
    return motor_sinais(falso, e, LISTA, RelogioFixo(QUANDO), registros.append), falso, registros


def test_respondido_sim_dispara_sem_ia():
    r, _, registros = rodar(entrada([sim("angioedema")]), "timeout")
    [d] = r.disparados
    assert (d.id, d.origem, d.tipo, d.prazo) == ("angioedema", "respondido", "urgencia_imediata", "imediato")
    assert d.acao == next(s.acao for s in LISTA if s.id == "angioedema")
    assert any("só a lista respondida" in a for a in r.avisos) and registros[0].acao == "REJECT"


def test_sinais_respondidos_sem_ia():
    assert [d.id for d in sinais_respondidos(entrada([sim("virilizacao"), nao("angioedema")]), LISTA)] == [
        "virilizacao"
    ]


def test_ia_acrescenta_sinal_com_trecho_literal():
    r, falso, _ = rodar(entrada(), ia([("febre-erupcao-difusa", "tive febre ontem")]))
    [d] = r.disparados
    assert (d.id, d.origem, d.trecho) == ("febre-erupcao-difusa", "ia", "tive febre ontem")
    [p] = falso.pedidos
    assert (p.motor, p.esforco, p.versao_prompt) == ("sinais", "low", "sinais-derm-1")
    assert {s["id"] for s in p.dados["lista"]} == {s.id for s in LISTA}


def test_trecho_no_exame_tambem_vale():
    r, _, _ = rodar(entrada(), ia([("angioedema", "Lábios edemaciados")]))
    assert [d.id for d in r.disparados] == ["angioedema"]


def test_id_fora_da_lista_vira_aviso():
    r, _, _ = rodar(entrada(), ia([("inventado", "febre")]))
    assert r.disparados == [] and any("inventado" in a for a in r.avisos)


def test_trecho_que_nao_esta_na_entrada_vira_aviso():
    r, _, _ = rodar(entrada(), ia([("febre-erupcao-difusa", "febre alta de 40 graus")]))
    assert r.disparados == [] and any("febre-erupcao-difusa" in a for a in r.avisos)


def test_respondido_nao_pelo_medico_vira_aviso():
    r, _, _ = rodar(entrada([nao("febre-erupcao-difusa")]), ia([("febre-erupcao-difusa", "tive febre ontem")]))
    assert r.disparados == [] and any("respondido não" in a for a in r.avisos)


def test_nao_repete_sinal_respondido_e_detectado():
    r, _, _ = rodar(entrada([sim("angioedema")]), ia([("angioedema", "Lábios edemaciados")]))
    assert [(d.id, d.origem) for d in r.disparados] == [("angioedema", "respondido")]


def test_ordem_por_tipo():
    e = entrada([sim("gestacao-ou-plano"), sim("virilizacao"), sim("angioedema")])
    r, _, _ = rodar(e, ia())
    assert [d.tipo for d in r.disparados] == ["urgencia_imediata", "prioridade", "muda_tratamento"]


def test_extras_da_ia_passam_marcados():
    r, _, _ = rodar(entrada(), ia(extras=["Febre com lesões em alvo"]))
    assert r.extras_ia == ["Febre com lesões em alvo"]
