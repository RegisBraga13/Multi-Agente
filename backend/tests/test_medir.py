from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.contratos.motor import RegistroDecisao
from app.especialidades.condutas import carregar_protocolos
from app.especialidades.pacote import carregar_sinais
from app.provedores.ia import PedidoIA, RespostaIA
from app.provedores.relogio import RelogioFixo
from casos_de_teste.__main__ import main
from casos_de_teste.formato import Caso
from casos_de_teste.medir import custo_usd, medir, medir_caso
from tests.conftest import caso_minimo

QUANDO = datetime(2026, 11, 18, 12, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
LISTA = carregar_sinais("dermatologia")
PROTOCOLOS = carregar_protocolos("dermatologia")
HDA = "Paciente, 34 anos, feminino, refere Espinhas no rosto há 6 meses."


def historia(**mudar):
    h = {
        "qp": "Espinhas.",
        "hda": HDA,
        "ap": "",
        "hp": "",
        "hf": "",
        "exameFisico": "Pápulas e pústulas em face.",
        "examesTexto": "",
    }
    return {"resultado": h | mudar, "meta": META}


def dd(nome="Acne vulgar", cid="L70.0", certeza="clinico"):
    h = {
        "nome": nome,
        "cid": cid,
        "certeza": certeza,
        "pct": 80,
        "evidencias": [{"lado": "favor", "texto": "x", "secao": "hda", "trecho": "Espinhas no rosto"}],
    }
    return {"resultado": {"hipoteses": [h], "naoPodePerder": None, "rastrear": []}, "meta": META}


def avaliadora_cumpre(pedido: PedidoIA):
    texto = pedido.dados["texto"]
    vs = [
        {"n": c["n"], "veredito": "cumprido", "trecho": texto[:10], "justificativa": "ok"}
        for c in pedido.dados["criterios"]
    ]
    return {"resultado": {"vereditos": vs}, "meta": META}


PADRAO = {
    "sinais": lambda p: {"resultado": {"detectados": [], "extras": []}, "meta": META},
    "historia": lambda p: historia(),
    "diagnosticos": lambda p: dd(),
    "conduta-complemento": lambda p: {"resultado": {"orientacoes": [], "alertas": []}, "meta": META},
    "conduta": lambda p: {"resultado": {"grupos": [], "alertas": []}, "meta": META},
    "avaliadora": avaliadora_cumpre,
}


class Roteiro:
    def __init__(self, **trocas):
        self.respostas = PADRAO | trocas
        self.pedidos: list[PedidoIA] = []

    def gerar(self, pedido, esquema):
        self.pedidos.append(pedido)
        r = self.respostas[pedido.motor](pedido)
        if isinstance(r, str):
            return RespostaIA(None, "claude-opus-5-5", "claude-opus-5-5", 10, 5, r)
        return RespostaIA(r, "claude-opus-5-5", "claude-opus-5-5", 10, 5, None)


def caso(**esperado) -> Caso:
    dados = caso_minimo()
    for etapa, valores in esperado.items():
        dados["esperado"][etapa].update(valores)
    return Caso.model_validate(dados)


def medir1(c, provedor=None):
    return medir_caso(provedor or Roteiro(), c, LISTA, PROTOCOLOS, RelogioFixo(QUANDO))


def test_caso_perfeito_passa_tudo():
    r = medir1(caso())
    assert r.erro is None and r.rejeitados == []
    assert [c.resultado for c in r.criterios if c.resultado != "passou"] == []
    assert {c.etapa for c in r.criterios} == {"historia", "diagnosticos", "conduta"}
    assert any(c.como == "regra" and c.criterio.startswith("vazia") for c in r.criterios)


def test_secao_que_devia_estar_vazia_falha():
    r = medir1(caso(), Roteiro(historia=lambda p: historia(hf="Mãe com acne.")))
    [c] = [c for c in r.criterios if c.criterio == "vazia: hf"]
    assert c.resultado == "falhou"


def test_sinal_perdido_conta_no_resumo():
    c = caso(sinais={"disparados": ["angioedema"]}, conduta={"urgencia": "imediata"})
    rel = medir(Roteiro(), [c], LISTA, PROTOCOLOS, RelogioFixo(QUANDO), so_aprovados=False)
    [perdido] = [x for x in rel.casos[0].criterios if x.etapa == "sinais"]
    assert perdido.resultado == "falhou" and "PERDIDO" in perdido.nota
    assert rel.resumo["sinais_perdidos"] == 1


def test_remedio_proibido_na_receita_falha():
    r = medir1(caso(conduta={"remedios_proibidos": ["isotretinoína"]}))
    [c] = [c for c in r.criterios if c.criterio.startswith("remédio proibido")]
    assert c.resultado == "falhou" and "Isotretinoína" in c.nota


def test_principal_fora_das_3_falha():
    r = medir1(caso(), Roteiro(diagnosticos=lambda p: dd("Rosácea", "L71.9")))
    [c] = [c for c in r.criterios if c.criterio.startswith("principal")]
    assert c.resultado == "falhou"


def test_mesma_categoria_de_cid_vira_duvida():
    r = medir1(caso(), Roteiro(diagnosticos=lambda p: dd("Acne conglobata", "L70.1")))
    [c] = [c for c in r.criterios if c.criterio.startswith("principal")]
    assert c.resultado == "duvida"


def test_motor_rejeitado_nao_para_a_medicao():
    r = medir1(caso(), Roteiro(historia=lambda p: "timeout"))
    assert r.rejeitados == ["historia"] and r.erro is None
    assert all(c.resultado == "falhou" for c in r.criterios if c.etapa in {"historia", "diagnosticos"})
    assert any(c.etapa == "conduta" and c.resultado == "passou" for c in r.criterios)


def test_excecao_num_caso_nao_para_os_outros():
    class Quebra(Roteiro):
        def gerar(self, pedido, esquema):
            if not self.pedidos:
                self.pedidos.append(pedido)
                raise RuntimeError("falha de rede")
            return super().gerar(pedido, esquema)

    c1, c2 = caso(), caso()
    rel = medir(Quebra(), [c1, c2], LISTA, PROTOCOLOS, RelogioFixo(QUANDO), so_aprovados=False)
    assert "falha de rede" in rel.casos[0].erro and rel.casos[1].erro is None
    assert rel.resumo["casos_com_erro"] == 1


def test_conduta_usa_diagnostico_esperado():
    roteiro = Roteiro(diagnosticos=lambda p: dd("Rosácea", "L71.9"))
    medir1(caso(), roteiro)
    [p] = [p for p in roteiro.pedidos if p.motor.startswith("conduta")]
    assert p.dados["diagnostico"]["cid"] == "L70.0" and p.motor == "conduta-complemento"


def test_custo_pelo_preco_do_modelo():
    def reg(modelo, entrada, saida):
        return RegistroDecisao(
            decision_id=uuid4(),
            motor="x",
            modelo=modelo,
            versao_modelo=modelo,
            versao_esquema=1,
            versao_prompt="v",
            confianca=None,
            acao="REJECT",
            tokens_entrada=entrada,
            tokens_saida=saida,
            quando=QUANDO,
        )

    custo, notas = custo_usd([reg("claude-opus-5-5", 1_000_000, 100_000), reg("outro", 5, 5)])
    assert custo == pytest.approx(4.0 + 2.0) and notas == ["preço desconhecido: outro"]


def test_so_casos_aprovados():
    pendente = caso()
    aprovado = Caso.model_validate(caso_minimo() | {"revisao": {"situacao": "aprovado"}})
    rel = medir(Roteiro(), [pendente, aprovado], LISTA, PROTOCOLOS, RelogioFixo(QUANDO))
    assert len(rel.casos) == 1 and rel.resumo["casos"] == 1


def test_resumo_tem_as_metricas():
    rel = medir(Roteiro(), [caso()], LISTA, PROTOCOLOS, RelogioFixo(QUANDO), so_aprovados=False)
    for chave in [
        "historia_pct",
        "diagnosticos_pct",
        "conduta_pct",
        "sinais_perdidos",
        "principal_entre_3_pct",
        "conduta_da_tabela_pct",
        "saidas_invalidas",
        "duvidas",
        "custo_total_usd",
        "segundos_medio",
    ]:
        assert chave in rel.resumo
    assert rel.resumo["principal_entre_3_pct"] == 100 and rel.resumo["conduta_da_tabela_pct"] == 100
    assert rel.versoes_prompt["historia"] == "historia-derm-1"


def test_sem_chave_sai_1(monkeypatch, capsys):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert main(["medir"]) == 1
    assert "falta a chave da Anthropic (ANTHROPIC_API_KEY)" in capsys.readouterr().out


def test_medir_falso_grava_relatorio(tmp_path, capsys):
    assert main(["medir", "--falso", "--caso", "derm-001-acne-papulopustulosa", "--pasta", str(tmp_path)]) == 0
    [arquivo] = list(tmp_path.glob("*.json"))
    assert "derm-001-acne-papulopustulosa" in arquivo.read_text(encoding="utf-8")
    assert "casos: 1" in capsys.readouterr().out


def test_caso_inexistente_sai_1(capsys):
    assert main(["medir", "--falso", "--caso", "derm-999-nada"]) == 1


def test_caso_que_quebra_cedo_conta_os_criterios_que_faltam_como_falhou():
    class QuebraNosSinais(Roteiro):
        def gerar(self, pedido, esquema):
            raise RuntimeError("falha de rede")

    r = medir1(caso(), QuebraNosSinais())
    assert "falha de rede" in r.erro
    etapas = {c.etapa for c in r.criterios}
    assert {"historia", "diagnosticos", "conduta"} <= etapas
    assert all(c.resultado == "falhou" for c in r.criterios)


def test_conduta_rejeitada_nao_passa_proibidos_de_graca():
    c = Caso.model_validate(caso_minimo())
    dados = caso_minimo()
    dados["esperado"]["diagnosticos"]["principal"] = {"nome": "Urticária aguda", "cid": "L50.0", "certeza": "hipotese"}
    dados["esperado"]["conduta"] |= {"protocolo": None, "proibidos": ["Corticoide"], "remedios_proibidos": ["dipirona"]}
    c = Caso.model_validate(dados)
    r = medir1(c, Roteiro(conduta=lambda p: "timeout"))
    assert "conduta" in r.rejeitados
    for x in r.criterios:
        if x.criterio.startswith(("remédio proibido", "proibido")):
            assert x.resultado == "duvida", x
    assert any(x.criterio == "conduta produzida" and x.resultado == "falhou" for x in r.criterios)


def test_complemento_e_avaliadora_rejeitados_entram_em_rejeitados():
    r = medir1(caso(), Roteiro(**{"conduta-complemento": lambda p: "timeout", "avaliadora": lambda p: "timeout"}))
    assert "conduta-complemento" in r.rejeitados and "avaliadora" in r.rejeitados


def test_modelo_do_relatorio_vem_das_chamadas_e_demo_e_marcada(tmp_path, capsys):
    rel = medir(Roteiro(), [caso()], LISTA, PROTOCOLOS, RelogioFixo(QUANDO), so_aprovados=False)
    assert rel.modelo == "claude-opus-5-5" and rel.falso is False
    assert main(["medir", "--falso", "--caso", "derm-001-acne-papulopustulosa", "--pasta", str(tmp_path)]) == 0
    [arquivo] = list(tmp_path.glob("*.json"))
    assert "demonstracao" in arquivo.name
    saida = capsys.readouterr().out
    assert "DEMONSTRAÇÃO" in saida and "custo parcial" in saida


def test_conflito_de_sinal_vai_para_as_notas():
    dados = caso_minimo()
    dados["entrada"]["sinais"] = [{"sinal": "angioedema", "resposta": "f"}]
    dados["entrada"]["exame"]["achados"] = "Lábios edemaciados"
    det = {
        "resultado": {"detectados": [{"id": "angioedema", "trecho": "Lábios edemaciados"}], "extras": []},
        "meta": META,
    }
    r = medir1(Caso.model_validate(dados), Roteiro(sinais=lambda p: det))
    assert any("CONFLITO" in n and "angioedema" in n for n in r.notas)
