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

    @staticmethod
    def _item(nome: str, forma: str, concentracao: str, via: str, posologia: str, duracao: str) -> dict[str, Any]:
        return {
            "nome": nome,
            "forma": forma,
            "concentracao": concentracao,
            "quantidade": {"n": 1, "unidade": "bisn. 30g" if via == "topico" else "cx.", "feminino": True},
            "via": via,
            "posologia": posologia,
            "duracao": duracao,
        }

    @staticmethod
    def _opcao(rotulo: str, texto: str, *receita: dict[str, Any]) -> dict[str, Any]:
        return {"rotulo": rotulo, "texto": texto, "receita": list(receita)}

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
            hipoteses = [
                ("Psoríase vulgar", "L40.0", 70),
                ("Dermatite seborreica", "L21.9", 15),
                ("Eczema numular", "L30.0", 10),
                ("Tinha do corpo", "B35.4", 5),
            ]
            resultado = {
                "hipoteses": [
                    {"nome": n, "cid": c, "certeza": "hipotese", "pct": pct, "evidencias": [ev]}
                    for n, c, pct in hipoteses
                ],
                "naoPodePerder": {
                    "nome": "Linfoma cutâneo de células T",
                    "cid": "C84.0",
                    "porque": "Pode imitar placas de psoríase e eczema.",
                    "como": "Biópsia se não houver resposta ao tratamento.",
                },
                "rastrear": [],
            }
        elif pedido.motor == "conduta":
            resultado = {
                "grupos": [
                    {
                        "id": "cuidados",
                        "opcoes": [self._opcao("Rotina de cuidados com a pele", "Rotina de cuidados com a pele.")],
                    },
                    {
                        "id": "topico",
                        "opcoes": [
                            self._opcao(
                                "Corticoide tópico",
                                "Corticoide tópico nas placas.",
                                self._item(
                                    "Propionato de clobetasol",
                                    "CREM",
                                    "0,05%",
                                    "topico",
                                    "Aplicar fina camada nas placas 1 vez ao dia, à noite.",
                                    "4sem",
                                ),
                            ),
                            self._opcao(
                                "Calcipotriol",
                                "Calcipotriol nas placas.",
                                self._item(
                                    "Calcipotriol",
                                    "POM",
                                    "0,005%",
                                    "topico",
                                    "Aplicar nas placas 1 vez ao dia.",
                                    "8sem",
                                ),
                            ),
                        ],
                    },
                    {
                        "id": "sistemico",
                        "opcoes": [
                            self._opcao(
                                "Anti-histamínico",
                                "Anti-histamínico oral.",
                                self._item(
                                    "Loratadina", "COMP", "10 mg", "oral", "Tomar 1 COMP VO 1 vez ao dia.", "14 dias"
                                ),
                            )
                        ],
                    },
                    {"id": "orientacoes", "opcoes": [self._opcao("Fotoproteção", "Fotoproteção diária.")]},
                ]
            }
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
