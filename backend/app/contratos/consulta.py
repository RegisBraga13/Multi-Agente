"""Entrada da consulta como vai à IA: desidentificada (desenho §7.5).

O paciente aparece só como "Paciente, 34 anos, feminino" (`descrever_paciente`). Campo do exame `None` =
não examinado (nunca "normal"). Sinal de alerta respondido leva o texto da lista fixa da especialidade.
"""

from datetime import date
from typing import TYPE_CHECKING, Literal

from app.contratos.base import ModeloApi
from app.privacidade import descrever_paciente

if TYPE_CHECKING:  # só tipos: os blocos importam os motores, que importam este módulo
    from app.contratos.consulta_blocos import AnamneseBloco, ExameBloco
    from app.contratos.paciente import Paciente


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


def entrada_da_consulta(
    paciente: "Paciente", anamnese: "AnamneseBloco", exame: "ExameBloco", quando: date
) -> EntradaConsulta:
    """A entrada da IA a partir do paciente e dos blocos oficializados: sem nome, CPF nem telefone."""
    n = paciente.nascimento
    idade = quando.year - n.year - ((quando.month, quando.day) < (n.month, n.day))
    return EntradaConsulta(
        paciente=descrever_paciente(idade, paciente.sexo, paciente.estado_civil, paciente.profissao),
        em_uso=anamnese.em_uso,
        antecedentes=anamnese.antecedentes,
        alergias=anamnese.alergias,
        falas=anamnese.falas,
        sinais=anamnese.sinais,
        exame=exame.exame,
        complementares=exame.complementares,
    )


def termos_do_paciente(paciente: "Paciente") -> list[str]:
    """O que nunca pode chegar à IA: partes do nome (3+ letras), CPF e telefone."""
    termos = [parte for parte in paciente.nome.split() if len(parte) >= 3]
    return termos + [x for x in (paciente.cpf, paciente.telefone) if x]
