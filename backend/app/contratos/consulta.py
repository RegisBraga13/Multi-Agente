"""Entrada da consulta como vai à IA: desidentificada (desenho §7.5).

O paciente aparece só como "Paciente, 34 anos, feminino" (`descrever_paciente`). Campo do exame `None` =
não examinado (nunca "normal"). Sinal de alerta respondido leva o texto da lista fixa da especialidade.
"""

from datetime import date
from typing import TYPE_CHECKING, Literal

from pydantic import model_validator

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


class PerguntaRespondida(ModeloApi):
    """Pergunta que o médico fez na consulta; `detalhe` só nas perguntas abertas."""

    texto: str
    resposta: Literal["sim", "nao"]
    detalhe: str | None = None


class FormularioDaConsulta(ModeloApi):
    """O formulário do paciente como a consulta o usa; `fotos`: ids das perguntas de foto (as imagens ficam no pedido)."""

    respostas: dict[str, str | list[str]]
    fotos: list[str]


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
    """Valor de exame trazido: PRESENT (lido no laudo), INFERRED (deduzido — exige aviso e evidência) ou
    MISSING (não encontrado — valor null). Nada é inventado."""

    nome: str
    valor: str | None
    status: Literal["PRESENT", "INFERRED", "MISSING"]
    aviso: str | None
    evidencia: str | None

    @model_validator(mode="after")
    def _coerente(self) -> "ItemComplementar":
        if (self.valor is None) != (self.status == "MISSING"):
            raise ValueError("MISSING ⇔ valor null")
        if self.status == "INFERRED" and not (self.aviso and self.evidencia):
            raise ValueError("INFERRED exige aviso e evidência")
        return self


class ExameComplementar(ModeloApi):
    """`origem`: o arquivo ou identificador do laudo (para conferir na revisão e na auditoria)."""

    exame: str
    data: date
    origem: str
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


# partículas de nome (não identificam e aparecem em qualquer texto: "lesões dos pés")
_PARTICULAS = {"de", "da", "do", "das", "dos", "del", "della", "di", "du", "e", "van", "von", "der", "la", "le"}


def termos_do_paciente(paciente: "Paciente") -> list[str]:
    """O que nunca pode chegar à IA: partes do nome (3+ letras), CPF e telefone."""
    termos = [p for p in paciente.nome.split() if len(p) >= 3 and p.casefold() not in _PARTICULAS]
    return termos + [x for x in (paciente.cpf, paciente.telefone) if x]
