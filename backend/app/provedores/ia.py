"""Interface nossa para provedores de IA (desenho §7.4): trocar de modelo/fornecedor = trocar o adaptador.

O provedor devolve o JSON bruto; quem valida contra o esquema é a chamada de motor (app/motores/chamada.py).
"""

from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class PedidoIA:
    motor: str
    versao_prompt: str
    instrucoes: str
    dados: dict[str, Any]
    esforco: Literal["low", "medium", "high"] = "medium"


@dataclass(frozen=True)
class RespostaIA:
    bruto: dict[str, Any] | None
    modelo: str
    versao_modelo: str
    tokens_entrada: int
    tokens_saida: int
    erro: str | None


class ProvedorIA(Protocol):
    def gerar(self, pedido: PedidoIA, esquema: type[BaseModel]) -> RespostaIA: ...
