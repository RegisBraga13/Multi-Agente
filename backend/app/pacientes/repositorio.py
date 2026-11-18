"""Repositório de pacientes atrás de interface (Postgres em produção; memória nos testes de API)."""

from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from app.contratos.paciente import NovoPaciente, Paciente


class RepositorioPacientes(Protocol):
    def criar(self, medico_id: UUID, novo: NovoPaciente) -> Paciente: ...

    def buscar(self, medico_id: UUID, paciente_id: UUID) -> Paciente | None: ...


class RepositorioPacientesMemoria:
    def __init__(self) -> None:
        self._dados: dict[UUID, tuple[UUID, Paciente]] = {}

    def criar(self, medico_id: UUID, novo: NovoPaciente) -> Paciente:
        paciente = Paciente(**novo.model_dump(), id=uuid4(), criado_em=datetime.now(UTC))
        self._dados[paciente.id] = (medico_id, paciente)
        return paciente

    def buscar(self, medico_id: UUID, paciente_id: UUID) -> Paciente | None:
        registro = self._dados.get(paciente_id)
        if registro is None or registro[0] != medico_id:
            return None
        return registro[1]
