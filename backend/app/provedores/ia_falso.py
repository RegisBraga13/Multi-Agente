"""Provedor de IA falso e determinístico, para testes de código sem chave (desenho §7.4)."""

import json
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from app.provedores.ia import PedidoIA, RespostaIA


class ProvedorIAFalso:
    """`respostas[motor]`: dict = JSON devolvido; str = erro do provedor."""

    def __init__(self, respostas: dict[str, dict[str, Any] | str]) -> None:
        self.respostas = respostas
        self.pedidos: list[PedidoIA] = []

    def gerar(
        self, pedido: PedidoIA, esquema: type[BaseModel], ao_escrever: Callable[[str], None] | None = None
    ) -> RespostaIA:
        self.pedidos.append(pedido)
        resposta = self.respostas.get(pedido.motor, f"sem resposta programada para {pedido.motor!r}")
        if isinstance(resposta, str):
            return RespostaIA(None, "falso", "0", 0, 0, resposta)
        if ao_escrever is not None:  # entrega o JSON em 3 pedaços, como chegaria do modelo
            texto = json.dumps(resposta, ensure_ascii=False)
            for fim in (len(texto) // 3, 2 * len(texto) // 3, len(texto)):
                ao_escrever(texto[:fim])
        return RespostaIA(resposta, "falso", "0", 0, 0, None)
