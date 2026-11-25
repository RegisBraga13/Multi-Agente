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

    def _reumatologia(self, pedido: PedidoIA) -> dict[str, Any]:
        """Saídas fixas de Reumatologia (demonstração): o exame físico salvo entra no texto, o resto é fixo."""
        if pedido.motor == "historia":
            exame = pedido.dados.get("consulta", {}).get("exame") or {}
            texto = " ".join(f"{k}: {v}" for k, v in exame.items() if v) if isinstance(exame, dict) else ""
            vazio = {k: "" for k in ["qp", "ap", "hp", "hf", "examesTexto"]}
            return vazio | {"hda": self.HDA, "exameFisico": texto}
        if pedido.motor == "diagnosticos":
            hda = str(pedido.dados.get("historia", {}).get("hda", "")).strip() or self.HDA
            ev = {"lado": "favor", "texto": "demonstração", "secao": "hda", "trecho": hda}
            hipoteses = [
                ("Artrite reumatoide", "M06.9", 60),
                ("Lúpus eritematoso sistêmico", "M32.9", 15),
                ("Artrite psoriásica", "L40.5", 15),
                ("Osteoartrite das mãos", "M15.9", 10),
            ]
            return {
                "hipoteses": [
                    {"nome": n, "cid": c, "certeza": "hipotese", "pct": pct, "evidencias": [ev]}
                    for n, c, pct in hipoteses
                ],
                "naoPodePerder": {
                    "nome": "Artrite séptica",
                    "cid": "M00.9",
                    "porque": "Junta quente com febre exige afastar infecção.",
                    "como": "Punção articular com cultura se houver monoartrite febril.",
                },
                "rastrear": ["Rastrear psoríase: placas no couro cabeludo, unhas e sulco interglúteo"],
            }
        if pedido.motor == "conduta":
            return {
                "grupos": [
                    {
                        "id": "cuidados",
                        "opcoes": [
                            self._opcao("Fisioterapia", "Fisioterapia para mãos e punhos."),
                            self._opcao("Exercício", "Exercício físico regular, de baixo impacto."),
                        ],
                    },
                    {
                        "id": "topico",
                        "opcoes": [
                            self._opcao(
                                "Diclofenaco gel",
                                "Diclofenaco gel nas articulações dolorosas.",
                                self._item(
                                    "Diclofenaco dietilamônio",
                                    "GEL",
                                    "1%",
                                    "topico",
                                    "Aplicar nas articulações dolorosas 3 vezes ao dia.",
                                    "14 dias",
                                ),
                            )
                        ],
                    },
                    {
                        "id": "sistemico",
                        "opcoes": [
                            self._opcao(
                                "Prednisona",
                                "Prednisona em dose baixa como ponte.",
                                self._item(
                                    "Prednisona", "COMP", "5mg", "oral", "Tomar 1 COMP VO pela manhã.", "30 dias"
                                ),
                            ),
                            self._opcao(
                                "Metotrexato",
                                "Metotrexato semanal com ácido fólico.",
                                self._item(
                                    "Metotrexato",
                                    "SOL INJ",
                                    "25mg/mL",
                                    "injetavel",
                                    "Aplicar 0,6 mL SC, 1 vez por semana.",
                                    "uso contínuo",
                                ),
                                self._item(
                                    "Ácido fólico",
                                    "COMP",
                                    "5mg",
                                    "oral",
                                    "Tomar 1 COMP VO 1 vez por semana, 24 h após o metotrexato.",
                                    "uso contínuo",
                                ),
                            ),
                        ],
                    },
                    {
                        "id": "orientacoes",
                        "opcoes": [
                            self._opcao(
                                "Exames",
                                "Solicito FR, anti-CCP, VHS, PCR, hemograma, TGO, TGP, creatinina e RX de mãos.",
                            ),
                            self._opcao("Retorno", "Retorno em 30 dias com os exames."),
                        ],
                    },
                ]
            }
        return {
            "perguntas": [
                {
                    "texto": "Alguma junta ficou quente e inchada com febre?",
                    "seSim": "Refere junta quente e inchada com febre.",
                    "seNao": "Nega junta quente e inchada com febre.",
                    "sinalId": "monoartrite-febre",
                },
                {
                    "texto": "Tem dificuldade para levantar da cadeira ou erguer os braços?",
                    "seSim": "Refere fraqueza para levantar da cadeira ou erguer os braços.",
                    "seNao": "Nega fraqueza proximal.",
                    "sinalId": "fraqueza-proximal",
                },
            ]
        }

    def gerar(
        self, pedido: PedidoIA, esquema: type[BaseModel], ao_escrever: Callable[[str], None] | None = None
    ) -> RespostaIA:
        meta = {"confianca": 0.5, "evidencias": [], "avisos": [], "origem": "demonstração"}
        resultado: dict[str, Any]
        # Reumatologia: respostas fixas da especialidade (o prompt da consulta diz qual é: "diagnosticos-reumato-1")
        if "-reumato-" in pedido.versao_prompt and pedido.motor in ("historia", "diagnosticos", "conduta", "perguntas"):
            resultado = self._reumatologia(pedido)
        elif pedido.motor == "historia":
            resultado = {k: "" for k in ["qp", "ap", "hp", "hf", "exameFisico", "examesTexto"]} | {"hda": self.HDA}
        elif pedido.motor == "sinais":
            resultado = {"detectados": [], "extras": []}
        elif pedido.motor == "diagnosticos":
            # a evidência cita a história que veio no pedido (a do retorno é montada pela tela, não é a fixa daqui)
            hda = str(pedido.dados.get("historia", {}).get("hda", "")).strip() or self.HDA
            ev = {"lado": "favor", "texto": "demonstração", "secao": "hda", "trecho": hda}
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
