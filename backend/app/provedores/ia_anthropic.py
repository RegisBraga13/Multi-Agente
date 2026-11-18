"""Adaptador Anthropic (Claude) da interface ProvedorIA (desenho §7.4).

Trocar de modelo ou de fornecedor = trocar este arquivo. Saída estruturada pelo esquema do envelope, esforço por
motor, cache das instruções fixas e fallback de recusa no servidor. O adaptador devolve o JSON bruto; quem valida
é a chamada de motor. Erro de rede, de API, recusa ou saída cortada viram `RespostaIA.erro` (nunca exceção):
a política transforma em REJECT e o médico vê "a IA não conseguiu".
"""

import json
from collections.abc import Callable
from typing import Any

import anthropic
from pydantic import BaseModel

from app.provedores.esquema_saida import esquema_envelope
from app.provedores.ia import PedidoIA, RespostaIA

MODELO_PADRAO = "claude-opus-5-5"
BETA_FALLBACK = "server-side-fallback-2026-07-01"


class ProvedorAnthropic:
    def __init__(self, cliente: Any, modelo: str = MODELO_PADRAO, max_tokens: int = 16000) -> None:
        self.cliente = cliente
        self.modelo = modelo
        self.max_tokens = max_tokens

    def gerar(
        self, pedido: PedidoIA, esquema: type[BaseModel], ao_escrever: Callable[[str], None] | None = None
    ) -> RespostaIA:
        try:
            with self.cliente.beta.messages.stream(
                model=self.modelo,
                max_tokens=self.max_tokens,
                betas=[BETA_FALLBACK],
                fallbacks="default",
                output_config={
                    "effort": pedido.esforco,
                    "format": {"type": "json_schema", "schema": esquema_envelope(esquema)},
                },
                system=[{"type": "text", "text": pedido.instrucoes, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": json.dumps(pedido.dados, ensure_ascii=False, sort_keys=True)}],
            ) as fluxo:
                if ao_escrever is not None:
                    for evento in fluxo:  # escrita ao vivo: o texto acumulado de cada pedaço
                        if getattr(evento, "type", None) == "text":
                            ao_escrever(evento.snapshot)
                mensagem = fluxo.get_final_message()
        except (anthropic.APIStatusError, anthropic.APIConnectionError) as erro:
            return RespostaIA(None, self.modelo, self.modelo, 0, 0, type(erro).__name__)

        uso = mensagem.usage
        entrada = uso.input_tokens + (uso.cache_read_input_tokens or 0) + (uso.cache_creation_input_tokens or 0)

        def resposta(bruto: dict[str, Any] | None, erro: str | None) -> RespostaIA:
            return RespostaIA(bruto, mensagem.model, mensagem.model, entrada, uso.output_tokens, erro)

        if mensagem.stop_reason == "refusal":
            return resposta(None, "recusa")
        if mensagem.stop_reason == "max_tokens":
            return resposta(None, "saída cortada")
        texto = next((b.text for b in mensagem.content if b.type == "text"), "")
        try:
            bruto = json.loads(texto)
        except json.JSONDecodeError:
            return resposta(None, "resposta não é JSON")
        if not isinstance(bruto, dict):
            return resposta(None, "resposta não é JSON")
        return resposta(bruto, None)


def criar_provedor_anthropic() -> ProvedorAnthropic:
    """Credencial pelo ambiente (ANTHROPIC_API_KEY); nunca escrita no código."""
    return ProvedorAnthropic(anthropic.Anthropic())
