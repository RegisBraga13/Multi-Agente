"""Entrada da consulta como vai à IA: desidentificada (desenho §7.5).

O paciente aparece só como "Paciente, 34 anos, feminino" (`descrever_paciente`). Campo do exame `None` =
não examinado (nunca "normal"). Sinal de alerta respondido leva o texto da lista fixa da especialidade.
"""

from datetime import date
from typing import Literal

from app.contratos.base import ModeloApi


class SinalRespondido(ModeloApi):
    id: str
    texto: str
    resposta: Literal["sim", "nao"]


class Alergia(ModeloApi):
    substancia: str
    reacao: str


class Fala(ModeloApi):
    quem: Literal["Médico", "Paciente"]
    texto: str


class ExameDerm(ModeloApi):
    """Os 5 campos do exame da Dermatologia. None = não examinado."""

    morfologia: str | None
    localizacao: str | None
    extensao: str | None
    gravidade: str | None
    achados: str | None


class ItemComplementar(ModeloApi):
    nome: str
    valor: str | None


class ExameComplementar(ModeloApi):
    exame: str
    data: date
    itens: list[ItemComplementar]


class EntradaConsulta(ModeloApi):
    paciente: str
    em_uso: list[str]
    antecedentes: list[str]
    alergias: list[Alergia]
    falas: list[Fala]
    sinais: list[SinalRespondido]
    exame: ExameDerm
    complementares: list[ExameComplementar]
