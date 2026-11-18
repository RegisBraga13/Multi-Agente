"""Quem é o médico da requisição, atrás de interface.

Primeiro uso (desenho §10): só o autor, no computador dele, com pacientes fictícios → `MedicoLocal`.
Login real (Supabase Auth / JWT) entra como outro adaptador nos portões do §11.
"""

from typing import Protocol
from uuid import UUID


class Identidade(Protocol):
    def medico_atual(self) -> UUID: ...


class MedicoLocal:
    def __init__(self, medico_id: UUID) -> None:
        self.medico_id = medico_id

    def medico_atual(self) -> UUID:
        return self.medico_id
