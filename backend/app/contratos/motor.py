"""Contrato de cada motor de IA (desenho §7.2, JEV turbo).

A IA propõe; o médico decide: a ação é sempre `HUMAN_REVIEW` (proposta válida) ou `REJECT` (inválida).
Não existe `AUTO_EXECUTE` de efeito clínico. `confianca` é sinal operacional, não probabilidade de acerto.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contratos.base import ModeloApi

Acao = Literal["HUMAN_REVIEW", "REJECT"]


class Evidencia(ModeloApi):
    trecho: str
    origem: str


class MetaProposta(ModeloApi):
    """O que todo motor devolve junto do resultado: confiança (sinal operacional), evidências, avisos e origem."""

    confianca: float = Field(ge=0, le=1)
    evidencias: list[Evidencia]
    avisos: list[str]
    origem: str


class PropostaIA[T](ModeloApi):
    resultado: T | None
    confianca: float = Field(ge=0, le=1)
    evidencias: list[Evidencia]
    avisos: list[str]
    origem: str
    acao: Acao
    motivos: list[str]


class RegistroDecisao(ModeloApi):
    """O que se registra de cada chamada: sem prompt e sem dado pessoal."""

    decision_id: UUID
    motor: str
    modelo: str
    versao_modelo: str
    versao_esquema: int
    versao_prompt: str
    confianca: float | None = Field(ge=0, le=1)
    acao: Acao
    tokens_entrada: int = Field(ge=0)
    tokens_saida: int = Field(ge=0)
    quando: datetime
