from datetime import date

from app.contratos.consulta import ExameComplementar, ItemComplementar
from app.contratos.consulta_blocos import Documento, ItemDD
from app.contratos.prontuario import Atestado, ItemReceita, Laudo, Quantidade
from app.prontuario.montar import dados_da_consulta, diagnosticos_do_prontuario
from tests.fabrica import EXAME, HISTORIA, conduta, diagnosticos, hipotese

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
                    itens=[ItemComplementar(nome="TSH", valor="2,1"), ItemComplementar(nome="Ferritina", valor=None)],
                )
            ]
        }
    )
    d = montar(exame=ex)
    assert [(e.nome, e.valor, e.status, e.data) for e in d.exames] == [
        ("TSH", "2,1", "PRESENT", "2026-11-01"),
        ("Ferritina", None, "MISSING", "2026-11-01"),
    ]
    assert d.fotos == []
