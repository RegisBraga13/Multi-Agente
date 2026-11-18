import json
from contextlib import contextmanager
from types import SimpleNamespace

import anthropic
import httpx2 as httpx
import pytest

from app.contratos.base import ModeloApi
from app.provedores.ia import PedidoIA
from app.provedores.ia_anthropic import ProvedorAnthropic

BRUTO = {"resultado": {"nomes": ["Acne"]}, "meta": {"confianca": 0.8, "evidencias": [], "avisos": [], "origem": "IA"}}


class Hipoteses(ModeloApi):
    nomes: list[str]


def mensagem(texto: str = json.dumps(BRUTO), stop_reason: str = "end_turn", model: str = "claude-opus-5-5"):
    return SimpleNamespace(
        content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=texto)],
        stop_reason=stop_reason,
        model=model,
        usage=SimpleNamespace(
            input_tokens=100, output_tokens=50, cache_read_input_tokens=1000, cache_creation_input_tokens=10
        ),
    )


class Fluxo:
    def __init__(self, resposta, eventos):
        self.resposta, self.eventos = resposta, eventos

    def __iter__(self):
        return iter(self.eventos)

    def get_final_message(self):
        return self.resposta


class ClienteFalso:
    def __init__(self, resposta=None, erro: Exception | None = None, eventos=()):
        self.resposta = resposta if resposta is not None else mensagem()
        self.erro = erro
        self.eventos = list(eventos)
        self.ultima_chamada: dict = {}
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    @contextmanager
    def _stream(self, **kw):
        self.ultima_chamada = kw
        if self.erro:
            raise self.erro
        yield Fluxo(self.resposta, self.eventos)


def pedido(esforco="high") -> PedidoIA:
    return PedidoIA(motor="dd", versao_prompt="v1", instrucoes="INSTR", dados={"b": 1, "a": "é"}, esforco=esforco)


def gerar(cliente):
    return ProvedorAnthropic(cliente).gerar(pedido(), Hipoteses)


def test_json_valido_vira_bruto():
    r = gerar(ClienteFalso())
    assert r.bruto == BRUTO and r.erro is None
    assert (r.modelo, r.versao_modelo) == ("claude-opus-5-5", "claude-opus-5-5")


def test_modelo_registrado_e_o_que_respondeu():
    r = gerar(ClienteFalso(mensagem(model="claude-opus-4-8")))
    assert r.modelo == "claude-opus-4-8"


def test_pedido_leva_esforco_esquema_fallback_e_cache():
    cliente = ClienteFalso()
    gerar(cliente)
    kw = cliente.ultima_chamada
    assert kw["model"] == "claude-opus-5-5" and kw["max_tokens"] == 16000
    assert kw["output_config"]["effort"] == "high"
    assert kw["output_config"]["format"]["type"] == "json_schema"
    assert set(kw["output_config"]["format"]["schema"]["properties"]) == {"resultado", "meta"}
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert kw["system"] == [{"type": "text", "text": "INSTR", "cache_control": {"type": "ephemeral"}}]
    assert kw["messages"] == [{"role": "user", "content": '{"a": "é", "b": 1}'}]
    assert "thinking" not in kw and "temperature" not in kw


def test_recusa_vira_erro():
    r = gerar(ClienteFalso(mensagem(stop_reason="refusal")))
    assert r.bruto is None and r.erro == "recusa"


def test_saida_cortada_vira_erro():
    r = gerar(ClienteFalso(mensagem(stop_reason="max_tokens")))
    assert r.bruto is None and r.erro == "saída cortada"


def test_texto_que_nao_e_json_vira_erro():
    r = gerar(ClienteFalso(mensagem(texto="não é json")))
    assert r.bruto is None and r.erro == "resposta não é JSON"


def test_json_que_nao_e_objeto_vira_erro():
    r = gerar(ClienteFalso(mensagem(texto="[1, 2]")))
    assert r.bruto is None and r.erro == "resposta não é JSON"


def test_erro_de_conexao_nao_levanta():
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    r = gerar(ClienteFalso(erro=anthropic.APIConnectionError(request=req)))
    assert r.bruto is None and r.erro == "APIConnectionError" and r.tokens_entrada == 0


def test_tokens_somam_cache():
    r = gerar(ClienteFalso())
    assert (r.tokens_entrada, r.tokens_saida) == (1110, 50)


@pytest.mark.parametrize("esforco", ["low", "medium"])
def test_esforco_vem_do_pedido(esforco):
    cliente = ClienteFalso()
    ProvedorAnthropic(cliente).gerar(pedido(esforco), Hipoteses)
    assert cliente.ultima_chamada["output_config"]["effort"] == esforco


def test_ao_escrever_recebe_texto_acumulado():
    eventos = [
        SimpleNamespace(type="thinking", snapshot="pensando"),
        SimpleNamespace(type="text", snapshot='{"resul'),
        SimpleNamespace(type="text", snapshot='{"resultado": {"no'),
    ]
    recebidos: list[str] = []
    r = ProvedorAnthropic(ClienteFalso(eventos=eventos)).gerar(pedido(), Hipoteses, ao_escrever=recebidos.append)
    assert recebidos == ['{"resul', '{"resultado": {"no'] and r.bruto == BRUTO


def test_sem_ao_escrever_nao_le_os_eventos():
    r = gerar(ClienteFalso(eventos=[SimpleNamespace(type="text", snapshot="x")]))
    assert r.bruto == BRUTO
