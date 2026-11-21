"""Repositório de pacientes atrás de interface (Postgres em produção; memória nos testes de API)."""

from datetime import UTC, date, datetime
from typing import Protocol
from uuid import UUID, uuid4

from app.contratos.paciente import NovoPaciente, Paciente


class ErroCpfDuplicado(Exception):
    """O médico já tem um paciente com este CPF (único por médico; não é chave)."""


class RepositorioPacientes(Protocol):
    def criar(self, medico_id: UUID, novo: NovoPaciente) -> Paciente: ...

    def buscar(self, medico_id: UUID, paciente_id: UUID) -> Paciente | None: ...

    def procurar(self, medico_id: UUID, nome: str, nascimento: date) -> Paciente | None:
        """O paciente do médico com este nome completo e nascimento (a mesma pessoa voltando)."""
        ...


class RepositorioPacientesMemoria:
    def __init__(self) -> None:
        self._dados: dict[UUID, tuple[UUID, Paciente]] = {}

    def criar(self, medico_id: UUID, novo: NovoPaciente) -> Paciente:
        if novo.cpf and any(dono == medico_id and p.cpf == novo.cpf for dono, p in self._dados.values()):
            raise ErroCpfDuplicado
        paciente = Paciente(**novo.model_dump(), id=uuid4(), criado_em=datetime.now(UTC))
        self._dados[paciente.id] = (medico_id, paciente)
        return paciente

    def buscar(self, medico_id: UUID, paciente_id: UUID) -> Paciente | None:
        registro = self._dados.get(paciente_id)
        if registro is None or registro[0] != medico_id:
            return None
        return registro[1]

    def procurar(self, medico_id: UUID, nome: str, nascimento: date) -> Paciente | None:
        chave = nome.strip().casefold()
        return next(
            (
                p
                for dono, p in self._dados.values()
                if dono == medico_id and p.nome.strip().casefold() == chave and p.nascimento == nascimento
            ),
            None,
        )
