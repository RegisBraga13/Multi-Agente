"""Provedor de IA falso e determinístico, para testes de código sem chave (desenho §7.4)."""

from typing import Any

from pydantic import BaseModel

from app.provedores.ia import PedidoIA, RespostaIA


class ProvedorIAFalso:
    """`respostas[motor]`: dict = JSON devolvido; str = erro do provedor."""

    def __init__(self, respostas: dict[str, dict[str, Any] | str]) -> None:
        self.respostas = respostas
        self.pedidos: list[PedidoIA] = []

    def gerar(self, pedido: PedidoIA, esquema: type[BaseModel]) -> RespostaIA:
        self.pedidos.append(pedido)
        resposta = self.respostas.get(pedido.motor, f"sem resposta programada para {pedido.motor!r}")
        if isinstance(resposta, str):
            return RespostaIA(None, "falso", "0", 0, 0, resposta)
        return RespostaIA(resposta, "falso", "0", 0, 0, None)
