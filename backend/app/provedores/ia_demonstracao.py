"""Provedor de demonstração: saídas fixas e válidas, sem chave e sem custo.

Serve para o servidor rodar sem a chave da Anthropic (IA_PROVEDOR=demonstracao) e para testar o fio da medição
(`medir --falso`). Não mede nada clínico. Também escreve "ao vivo", em pedaços, como o modelo.
"""

import json
from collections.abc import Callable
from typing import Any

from pydantic import BaseModel

from app.provedores.ia import PedidoIA, RespostaIA


class ProvedorDemonstracao:
    """Saídas fixas e válidas para testar o fio da medição sem gastar (`medir --falso`). Não mede nada clínico."""

    HDA = "Quadro em avaliação."

    def gerar(
        self, pedido: PedidoIA, esquema: type[BaseModel], ao_escrever: Callable[[str], None] | None = None
    ) -> RespostaIA:
        meta = {"confianca": 0.5, "evidencias": [], "avisos": [], "origem": "demonstração"}
        resultado: dict[str, Any]
        if pedido.motor == "historia":
            resultado = {k: "" for k in ["qp", "ap", "hp", "hf", "exameFisico", "examesTexto"]} | {"hda": self.HDA}
        elif pedido.motor == "sinais":
            resultado = {"detectados": [], "extras": []}
        elif pedido.motor == "diagnosticos":
            ev = {"lado": "favor", "texto": "demonstração", "secao": "hda", "trecho": self.HDA}
            hip = {"nome": "Demonstração", "cid": "L98.9", "certeza": "hipotese", "pct": 50, "evidencias": [ev]}
            resultado = {"hipoteses": [hip], "naoPodePerder": None, "rastrear": []}
        elif pedido.motor == "conduta":
            resultado = {"grupos": []}
        elif pedido.motor == "perguntas":
            resultado = {
                "perguntas": [
                    {
                        "texto": "Tem coceira nas lesões?",
                        "seSim": "Refere prurido nas lesões.",
                        "seNao": "Nega prurido.",
                        "sinalId": None,
                    },
                    {
                        "texto": "A lesão sangra ao toque leve?",
                        "seSim": "Refere sangramento ao toque leve.",
                        "seNao": "Nega sangramento ao toque.",
                        "sinalId": "lesao-sangra-facil",
                    },
                    {
                        "texto": "Teve inchaço de lábios, língua ou falta de ar?",
                        "seSim": "Refere inchaço de lábios ou língua, ou falta de ar.",
                        "seNao": "Nega inchaço de lábios, língua e falta de ar.",
                        "sinalId": "angioedema",
                    },
                ]
            }
        else:  # avaliadora: tudo em dúvida
            resultado = {
                "vereditos": [
                    {"n": c["n"], "veredito": "duvida", "trecho": None, "justificativa": "demonstração"}
                    for c in pedido.dados["criterios"]
                ]
            }
        bruto = {"resultado": resultado, "meta": meta}
        if ao_escrever is not None:  # escrita ao vivo também na demonstração
            texto = json.dumps(bruto, ensure_ascii=False)
            for fim in range(40, len(texto), 40):
                ao_escrever(texto[:fim])
            ao_escrever(texto)
        return RespostaIA(bruto, "demonstracao", "0", 0, 0, None)
