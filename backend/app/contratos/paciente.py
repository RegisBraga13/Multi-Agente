"""Paciente com identificador próprio, gerado pelo sistema, que nunca muda (desenho §6).

CPF, se houver, é dado de cadastro, não chave.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contratos.base import ModeloApi


class NovoPaciente(ModeloApi):
    nome: str = Field(min_length=1)
    nascimento: date
    sexo: Literal["F", "M"]
    estado_civil: str | None = None
    profissao: str | None = None
    cpf: str | None = Field(default=None, pattern=r"^[0-9]{11}$")
    telefone: str | None = None


class Paciente(NovoPaciente):
    id: UUID
    criado_em: datetime
