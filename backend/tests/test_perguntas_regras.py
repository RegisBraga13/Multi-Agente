from app.consulta.perguntas import frases_da_hda, respostas_de_alerta, seguranca_com_respostas
from app.contratos.consulta_blocos import PerguntaContextual
from app.especialidades.pacote import carregar_sinais
from app.motores.diagnosticos import DadosSeguranca

CATALOGO = carregar_sinais("dermatologia")
SEM_SINAIS = DadosSeguranca(alergias=[], em_uso=[], sinais=[])


def pergunta(id_="p1", sinal_id=None, resposta=None, texto="Pergunta?"):
    return PerguntaContextual(
        id=id_, texto=texto, se_sim="Refere.", se_nao="Nega.", sinal_id=sinal_id, resposta=resposta
    )


def test_sim_em_sinal_do_catalogo_dispara_as_regras_dele():
    s = seguranca_com_respostas(SEM_SINAIS, [pergunta(sinal_id="angioedema", resposta="sim")], CATALOGO)
    [d] = s.sinais
    angio = next(x for x in CATALOGO if x.id == "angioedema")
    assert (d.id, d.origem, d.tipo, d.prazo, d.acao) == (
        "angioedema",
        "respondido",
        angio.tipo,
        angio.prazo,
        angio.acao,
    )


def test_sim_em_pergunta_livre_nao_dispara_sinal():
    assert seguranca_com_respostas(SEM_SINAIS, [pergunta(resposta="sim")], CATALOGO).sinais == []


def test_nao_e_sem_resposta_nao_disparam():
    perguntas = [pergunta("p1", "angioedema", "nao"), pergunta("p2", "virilizacao", None)]
    assert seguranca_com_respostas(SEM_SINAIS, perguntas, CATALOGO).sinais == []


def test_sinal_ja_disparado_nao_duplica():
    antes = seguranca_com_respostas(SEM_SINAIS, [pergunta(sinal_id="angioedema", resposta="sim")], CATALOGO)
    depois = seguranca_com_respostas(antes, [pergunta(sinal_id="angioedema", resposta="sim")], CATALOGO)
    assert [d.id for d in depois.sinais] == ["angioedema"]


def test_sinal_fora_do_catalogo_nao_dispara():
    assert seguranca_com_respostas(SEM_SINAIS, [pergunta(sinal_id="inventado", resposta="sim")], CATALOGO).sinais == []


def test_urgencia_vem_antes_de_prioridade():
    perguntas = [pergunta("p1", "lesao-sangra-facil", "sim"), pergunta("p2", "angioedema", "sim")]
    assert [d.id for d in seguranca_com_respostas(SEM_SINAIS, perguntas, CATALOGO).sinais] == [
        "angioedema",
        "lesao-sangra-facil",
    ]


def test_respostas_de_alerta_so_as_respondidas():
    r = respostas_de_alerta(
        [
            pergunta("p1", resposta="sim", texto="A?"),
            pergunta("p2", texto="B?"),
            pergunta("p3", resposta="nao", texto="C?"),
        ]
    )
    assert [(x.texto, x.resposta) for x in r] == [("A?", "sim"), ("C?", "nao")]


def _p(id_, resposta, sim="Refere sangramento ao toque leve.", nao="Nega febre."):
    return PerguntaContextual(id=id_, texto="x?", se_sim=sim, se_nao=nao, resposta=resposta)


def test_hda_recebe_as_frases_das_respondidas_na_ordem():
    assert frases_da_hda([_p("p1", "sim"), _p("p2", "nao")]) == "Refere sangramento ao toque leve. Nega febre."


def test_sem_resposta_nao_entra():
    assert frases_da_hda([_p("p1", None), _p("p2", "nao")]) == "Nega febre."


def test_frases_repetidas_entram_uma_vez_e_ganham_ponto_final():
    assert (
        frases_da_hda([_p("p1", "sim", sim="Refere prurido"), _p("p2", "sim", sim="Refere prurido.")])
        == "Refere prurido."
    )


def test_sem_perguntas_a_frase_e_vazia():
    assert frases_da_hda([]) == ""
