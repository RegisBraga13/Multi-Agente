from datetime import UTC, datetime

import pytest

from app.contratos.base import ModeloApi
from app.motores.chamada import ErroPrivacidade, chamar_motor
from app.provedores.ia import PedidoIA
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import RelogioFixo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {
    "confianca": 0.8,
    "evidencias": [{"trecho": "pústulas", "origem": "exame"}],
    "avisos": [],
    "origem": "sugestão da IA",
}
BRUTO_VALIDO = {"resultado": {"nomes": ["Acne"]}, "meta": META}


class Hipoteses(ModeloApi):
    nomes: list[str]


def pedido(dados: dict | None = None) -> PedidoIA:
    return PedidoIA(
        motor="dd",
        versao_prompt="v1",
        instrucoes="INSTRUCOES-SECRETAS",
        dados=dados or {"historia": "Paciente, 34 anos, pústulas na face"},
    )


def chamar(resposta, dados=None, termos=()):
    falso = ProvedorIAFalso({"dd": resposta})
    registros: list = []
    proposta = chamar_motor(
        falso, pedido(dados), Hipoteses, 3, RelogioFixo(QUANDO), registros.append, termos_proibidos=termos
    )
    return proposta, registros, falso


def test_saida_valida_vai_ao_medico_e_e_registrada():
    proposta, registros, _ = chamar(BRUTO_VALIDO)
    assert proposta.acao == "HUMAN_REVIEW" and proposta.resultado is not None
    assert proposta.resultado.nomes == ["Acne"] and proposta.confianca == 0.8
    assert proposta.evidencias[0].trecho == "pústulas"
    [r] = registros
    assert (r.motor, r.modelo, r.versao_modelo, r.versao_esquema, r.versao_prompt) == ("dd", "falso", "0", 3, "v1")
    assert r.acao == "HUMAN_REVIEW" and r.confianca == 0.8 and r.quando == QUANDO


@pytest.mark.parametrize(
    "bruto",
    [
        {"resultado": {"nomes": ["Acne"], "x": 1}, "meta": META},  # campo a mais
        {"resultado": {"nomes": "Acne"}, "meta": META},  # tipo errado
        {"resultado": {"nomes": ["Acne"]}, "meta": {**META, "confianca": 1.5}},  # meta inválido
        {"resultado": {"nomes": ["Acne"]}},  # sem meta
    ],
)
def test_saida_invalida_e_rejeitada_sem_uso_parcial(bruto):
    proposta, registros, _ = chamar(bruto)
    assert proposta.acao == "REJECT" and proposta.resultado is None
    assert registros[0].acao == "REJECT" and registros[0].confianca is None


def test_erro_do_provedor_e_rejeitado():
    proposta, registros, _ = chamar("timeout")
    assert proposta.acao == "REJECT" and proposta.resultado is None and len(registros) == 1


def test_identidade_nos_dados_bloqueia_antes_do_provedor():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO})
    registros: list = []
    dados = {"falas": [{"quem": "Paciente", "texto": "Meu CPF é 123.456.789-09"}]}
    with pytest.raises(ErroPrivacidade, match="CPF"):
        chamar_motor(falso, pedido(dados), Hipoteses, 3, RelogioFixo(QUANDO), registros.append)
    assert falso.pedidos == [] and registros == []


def test_identidade_nas_instrucoes_tambem_bloqueia():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO})
    p = PedidoIA(motor="dd", versao_prompt="v1", instrucoes="ligue (11) 98765-4321", dados={})
    with pytest.raises(ErroPrivacidade):
        chamar_motor(falso, p, Hipoteses, 3, RelogioFixo(QUANDO), lambda r: None)
    assert falso.pedidos == []


def test_registro_nao_guarda_prompt_nem_dados():
    _, registros, _ = chamar(BRUTO_VALIDO)
    texto = registros[0].model_dump_json()
    assert "INSTRUCOES-SECRETAS" not in texto and "Paciente, 34 anos" not in texto


class Contagem(ModeloApi):
    quantidade: int


def test_texto_no_lugar_de_numero_e_rejeitado():
    falso = ProvedorIAFalso({"dd": {"resultado": {"quantidade": "3"}, "meta": META}})
    proposta = chamar_motor(falso, pedido(), Contagem, 1, RelogioFixo(QUANDO), lambda r: None)
    assert proposta.acao == "REJECT"


def test_chave_a_mais_no_envelope_e_rejeitada():
    proposta, _, _ = chamar({**BRUTO_VALIDO, "extra": 1})
    assert proposta.acao == "REJECT"


def test_resposta_que_nao_e_objeto_e_rejeitada_e_registrada():
    proposta, registros, _ = chamar([1, 2])  # type: ignore[arg-type]
    assert proposta.acao == "REJECT" and len(registros) == 1


def test_telefone_como_numero_nos_dados_bloqueia():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO})
    with pytest.raises(ErroPrivacidade):
        chamar_motor(falso, pedido({"contato": 11987654321}), Hipoteses, 3, RelogioFixo(QUANDO), lambda r: None)
    assert falso.pedidos == []


def test_termo_proibido_bloqueia_sem_diferenciar_acento_e_caixa():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO})
    with pytest.raises(ErroPrivacidade) as erro:
        chamar_motor(
            falso,
            pedido({"falas": ["Sou a MARIANA, tenho espinhas"]}),
            Hipoteses,
            3,
            RelogioFixo(QUANDO),
            lambda r: None,
            termos_proibidos=["Mariána"],
        )
    assert falso.pedidos == []
    assert "termo proibido do paciente" in str(erro.value) and "mari" not in str(erro.value).lower()


def test_termo_proibido_e_palavra_inteira():
    proposta, _, _ = chamar(BRUTO_VALIDO, {"t": "anamnese e banana"}, termos=["Ana"])
    assert proposta.acao == "HUMAN_REVIEW"


def test_termo_vazio_e_ignorado():
    proposta, _, _ = chamar(BRUTO_VALIDO, termos=["", "  "])
    assert proposta.acao == "HUMAN_REVIEW"


def test_pedido_tem_esforco_medio_por_padrao():
    assert pedido().esforco == "medium"


def test_evidencia_do_meta_inventada_e_descartada():
    meta = {**META, "evidencias": [{"trecho": "Paciente, 34", "origem": "x"}, {"trecho": "inventado", "origem": "x"}]}
    proposta, _, _ = chamar({"resultado": {"nomes": ["Acne"]}, "meta": meta})
    assert [e.trecho for e in proposta.evidencias] == ["Paciente, 34"]
    assert any("inventado" in a for a in proposta.avisos)
