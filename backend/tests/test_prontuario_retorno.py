"""Registro do retorno: só o que mudou desde a consulta de origem (regra 14.8)."""

from app.contratos.prontuario import DiagnosticoRegistro, ItemReceita, Quantidade, ReceitaRegistro
from app.prontuario.retorno import comparar_com_origem
from tests.fabrica import DADOS_MINIMOS


def dx(nome, cid, pct, situacao="assinalado"):
    return DiagnosticoRegistro(nome=nome, cid=cid, pct=pct, situacao=situacao)


def remedio(nome, concentracao="0,1%", posologia="Aplicar à noite.", duracao="8sem"):
    return ItemReceita(
        nome=nome,
        forma="GEL",
        concentracao=concentracao,
        quantidade=Quantidade(n=1, unidade="bisn. 30g", feminino=True),
        via="topico",
        posologia=posologia,
        duracao=duracao,
    )


def dados(diagnosticos=(), itens=(), livres=(), orientacoes="", conduta_texto=""):
    receita = ReceitaRegistro(itens=list(itens), livres=list(livres), texto="x") if itens or livres else None
    return DADOS_MINIMOS.model_copy(
        update={
            "diagnosticos": list(diagnosticos),
            "receita": receita,
            "orientacoes": orientacoes,
            "conduta_texto": conduta_texto,
        }
    )


ACNE = dx("Acne vulgar", "L70.0", 85)


def test_diagnostico_assinalado_de_novo_e_confirmado_sem_pct_e_sugeridos_somem():
    antes = dados([ACNE, dx("Dermatite seborreica", "L21.9", 15, "sugerido")])
    hoje = dados([dx("Acne vulgar", "L70.0", 90), dx("Dermatite seborreica", "L21.9", 15, "sugerido")])
    c = comparar_com_origem(hoje, antes, "Consulta 1")
    assert [(d.nome, d.pct) for d in c.confirmados] == [("Acne vulgar", None)]
    assert c.novas_hipoteses == [] and c.referencia == "Consulta 1"


def test_diagnostico_novo_e_nova_hipotese_com_pct():
    c = comparar_com_origem(dados([ACNE, dx("Tinha do corpo", "B35.4", 30)]), dados([ACNE]), "Consulta 1")
    assert [(d.nome, d.pct) for d in c.novas_hipoteses] == [("Tinha do corpo", 30)]


def test_nada_assinalado_fica_sem_confirmados_nem_novas():
    c = comparar_com_origem(dados([dx("Acne vulgar", "L70.0", 80, "sugerido")]), dados([ACNE]), "Consulta 1")
    assert (c.confirmados, c.novas_hipoteses) == ([], [])


def test_conduta_igual_e_mantida():
    itens = [remedio("Adapaleno")]
    assert comparar_com_origem(dados(itens=itens), dados(itens=itens), "Consulta 1").conduta == []


def test_conduta_iniciado_suspenso_e_ajustado():
    antes = dados(itens=[remedio("Adapaleno"), remedio("Limeciclina")])
    hoje = dados(
        itens=[remedio("Adapaleno", concentracao="0,3%"), remedio("Peróxido de benzoíla")], livres=["Hidratante"]
    )
    c = comparar_com_origem(hoje, antes, "Consulta 1").conduta
    assert [(m.tipo, m.texto) for m in c] == [
        ("iniciado", "Peróxido de benzoíla 0,1% GEL — Aplicar à noite — 8sem"),
        ("iniciado", "Hidratante"),
        ("suspenso", "Limeciclina"),
        ("ajustado", "Adapaleno: 0,1% → 0,3%"),
    ]


def test_conduta_sem_receita_compara_o_texto():
    assert comparar_com_origem(dados(conduta_texto="Rotina."), dados(conduta_texto="Rotina."), "C").conduta == []
    [m] = comparar_com_origem(dados(conduta_texto="Outra."), dados(conduta_texto="Rotina."), "C").conduta
    assert (m.tipo, m.texto) == ("ajustado", "Outra.")


def test_orientacoes_so_as_novas():
    antes = dados(orientacoes="Não manipular lesões. Usar protetor solar.")
    hoje = dados(orientacoes="Não manipular lesões. Evitar sol entre 10h e 16h.")
    assert comparar_com_origem(hoje, antes, "C").orientacoes == "Evitar sol entre 10h e 16h."
