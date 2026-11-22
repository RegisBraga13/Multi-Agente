from datetime import date

from app.contratos.consulta import ExameComplementar, ItemComplementar
from app.contratos.consulta_blocos import Documento, HipoteseItem, ItemDD, PerguntaContextual
from app.contratos.prontuario import Atestado, ItemReceita, Laudo, Quantidade
from app.prontuario.montar import aplicar_edicoes_narrativas, dados_da_consulta, diagnosticos_do_prontuario
from tests.fabrica import DADOS_MINIMOS, EXAME, HISTORIA, conduta, diagnosticos, hipotese

ITEM = ItemReceita(
    nome="Ácido azelaico",
    forma="GEL",
    concentracao="15%",
    quantidade=Quantidade(n=1, unidade="bisn. 30g", feminino=True),
    via="topico",
    posologia="Aplicar 2 vezes ao dia.",
    duracao="8sem",
)
GRUPO4 = (
    "Não manipular lesões inflamatórias. Solicito exames de rotina: hemograma e TSH. Solicito perfil hormonal. "
    "Retorno em 8 semanas, em 08/01/2027. Encaminho para ginecologia e endocrinologia."
)


def item(nome, cid, pct, decisao):
    return ItemDD(hipotese=hipotese(nome, cid, pct), decisao=decisao, propria=False)


def test_diagnosticos_sempre_ate_3_assinalados_primeiro():
    itens = [
        item("A", "L70.0", 30, "pendente"),
        item("B", "L71.9", 90, "confirmada"),
        item("C", "L73.9", 50, "confirmada"),
        item("D", "L21.0", 80, "pendente"),
        item("E", "L20.9", 70, "pendente"),
    ]
    ds = diagnosticos_do_prontuario(itens)
    assert [(d.nome, d.situacao) for d in ds] == [("B", "assinalado"), ("C", "assinalado"), ("D", "sugerido")]


def test_mais_de_3_confirmados_ficam_os_de_maior_pct():
    itens = [item(n, "L70.0", p, "confirmada") for n, p in [("A", 10), ("B", 90), ("C", 50), ("D", 70)]]
    assert [d.nome for d in diagnosticos_do_prontuario(itens)] == ["B", "D", "C"]


def test_descartado_nunca_entra():
    itens = [item("A", "L70.0", 90, "descartada"), item("B", "L71.9", 40, "confirmada")]
    assert [d.nome for d in diagnosticos_do_prontuario(itens)] == ["B"]


def montar(textos=("Rotina para pele oleosa.", "Ácido azelaico.", "", GRUPO4), documentos=(), exame=EXAME):
    c = conduta(*textos).model_copy(update={"receita": [ITEM], "livres": ["Manipulado X"]})
    return dados_da_consulta(HISTORIA, diagnosticos("confirmada", "pendente"), c, exame, list(documentos))


def test_secoes_da_historia():
    d = montar()
    assert d.qp == "Espinhas no rosto." and d.exame_fisico == "Pápulas e pústulas em face." and d.hf == ""


def test_grupo_4_separado_em_solicitado_encaminhado_retorno_orientacoes():
    d = montar()
    assert d.solicitado == ["exames de rotina", "perfil hormonal"]
    assert d.encaminhado == ["ginecologia e endocrinologia"]
    assert d.retorno == "em 8 semanas, em 08/01/2027."
    assert d.orientacoes == "Não manipular lesões inflamatórias."
    assert d.conduta_texto == "Rotina para pele oleosa. Ácido azelaico."


def test_receita_so_com_documento_enviado():
    assert montar().receita is None
    rascunho = Documento(tipo="receita", estado="assinado", texto="Receita.", registro=None)
    assert montar(documentos=[rascunho]).receita is None
    enviado = Documento(tipo="receita", estado="enviado", texto="1. Ácido azelaico 15% GEL", registro=None)
    r = montar(documentos=[enviado]).receita
    assert r.itens == [ITEM] and r.livres == ["Manipulado X"] and r.texto == "1. Ácido azelaico 15% GEL"


def test_atestado_e_laudo_em_uma_linha():
    at = Documento(
        tipo="atestado",
        estado="enviado",
        texto="...",
        registro=Atestado(tipo="atestado", de="2026-11-13", ate="2026-11-15", resumo="de 13/11 a 15/11/2026."),
    )
    la = Documento(
        tipo="laudo",
        estado="enviado",
        texto="...",
        registro=Laudo(tipo="laudo", finalidade="para o INSS", resumo="para o INSS."),
    )
    nao = Documento(
        tipo="laudo", estado="rascunho", texto="...", registro=Laudo(tipo="laudo", finalidade="x", resumo="x.")
    )
    assert [x.resumo for x in montar(documentos=[at, la]).documentos] == ["de 13/11 a 15/11/2026.", "para o INSS."]
    assert montar(documentos=[nao]).documentos == []


def test_exames_missing():
    ex = EXAME.model_copy(
        update={
            "complementares": [
                ExameComplementar(
                    exame="Laboratório",
                    data=date(2026, 11, 1),
                    origem="laudo-lab-0111.pdf",
                    itens=[
                        ItemComplementar(nome="TSH", valor="2,1", status="PRESENT", aviso=None, evidencia=None),
                        ItemComplementar(nome="Ferritina", valor=None, status="MISSING", aviso=None, evidencia=None),
                        ItemComplementar(
                            nome="Glicemia",
                            valor="98",
                            status="INFERRED",
                            aviso="foto borrada",
                            evidencia="Glic... 98 mg/dL",
                        ),
                    ],
                )
            ]
        }
    )
    d = montar(exame=ex)
    assert [(e.nome, e.valor, e.status, e.data, e.origem) for e in d.exames] == [
        ("TSH", "2,1", "PRESENT", "01/11/2026", "laudo-lab-0111.pdf"),
        ("Ferritina", None, "MISSING", "01/11/2026", "laudo-lab-0111.pdf"),
        ("Glicemia", "98", "INFERRED", "01/11/2026", "laudo-lab-0111.pdf"),
    ]
    assert d.fotos == []


def test_item_complementar_segue_present_inferred_missing():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):  # MISSING tem de ser null
        ItemComplementar(nome="TSH", valor="2", status="MISSING", aviso=None, evidencia=None)
    with pytest.raises(ValidationError):  # valor null tem de ser MISSING
        ItemComplementar(nome="TSH", valor=None, status="PRESENT", aviso=None, evidencia=None)
    with pytest.raises(ValidationError):  # INFERRED exige aviso e evidência
        ItemComplementar(nome="TSH", valor="2", status="INFERRED", aviso=None, evidencia="x")


def _hda_com(perguntas, hda="Paciente, 34 anos, feminino, refere espinhas no rosto há 6 meses."):
    h = HISTORIA.model_copy(
        update={"perguntas": perguntas, "historia": HISTORIA.historia.model_copy(update={"hda": hda})}
    )
    return dados_da_consulta(h, diagnosticos("confirmada"), conduta(), EXAME, []).hda


def _q(resposta):
    return PerguntaContextual(id="p1", texto="x?", se_sim="Refere prurido.", se_nao="Nega prurido.", resposta=resposta)


def test_hda_do_prontuario_recebe_as_respostas_depois_do_texto_da_historia():
    assert _hda_com([_q("sim")]).endswith("há 6 meses. Refere prurido.")


def test_sem_perguntas_respondidas_a_hda_fica_exatamente_como_estava():
    assert _hda_com([]) == HISTORIA.historia.hda and _hda_com([_q(None)]) == HISTORIA.historia.hda


def test_hda_vazia_com_respostas_nao_comeca_com_espaco():
    assert _hda_com([_q("nao")], hda="") == "Nega prurido."


def test_diagnostico_do_medico_sem_pct_vai_para_o_fim_dos_assinalados():
    meu = ItemDD(
        hipotese=HipoteseItem(nome="Meu", cid="", certeza="clinico", pct=None, evidencias=[]),
        decisao="confirmada",
        propria=True,
    )
    ds = diagnosticos_do_prontuario([meu, item("B", "L71.9", 90, "confirmada")])
    assert [(d.nome, d.pct) for d in ds] == [("B", 90), ("Meu", None)]


def test_edicao_narrativa_vai_para_o_dado_e_sai_das_edicoes():
    dados, resto = aplicar_edicoes_narrativas(
        DADOS_MINIMOS, {"S.hda": " HDA nova. ", "O.exame": "Exame novo.", "P.orientacoes": "Proteger do sol."}
    )
    assert (dados.hda, dados.exame_fisico, dados.orientacoes) == (
        "HDA nova.",
        "Exame novo.",
        "Proteger do sol.",
    ) and resto == {}


def test_linha_estruturada_fica_em_edicoes_e_os_dados_nao_mudam():
    dados, resto = aplicar_edicoes_narrativas(DADOS_MINIMOS, {"A.hd": "Meu texto do HD", "P.conduta": "Minha conduta"})
    assert resto == {"A.hd": "Meu texto do HD", "P.conduta": "Minha conduta"} and dados == DADOS_MINIMOS


def test_texto_vazio_apaga_a_narrativa():
    dados, resto = aplicar_edicoes_narrativas(DADOS_MINIMOS.model_copy(update={"ap": "Hipertensão."}), {"S.ap": "   "})
    assert dados.ap == "" and resto == {}


def test_chave_desconhecida_fica_em_edicoes():
    assert aplicar_edicoes_narrativas(DADOS_MINIMOS, {"hda": "x", "S.evolucao": "y"})[1] == {
        "hda": "x",
        "S.evolucao": "y",
    }


def test_nao_muda_o_objeto_original():
    antes = DADOS_MINIMOS.model_copy(deep=True)
    aplicar_edicoes_narrativas(DADOS_MINIMOS, {"S.qp": "Outra queixa."})
    assert DADOS_MINIMOS == antes
