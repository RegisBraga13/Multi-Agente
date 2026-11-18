"""Relógio atrás de interface: testes usam hora fixa."""

from datetime import UTC, datetime
from typing import Protocol


class Relogio(Protocol):
    def agora(self) -> datetime: ...


class RelogioSistema:
    def agora(self) -> datetime:
        return datetime.now(UTC)


class RelogioFixo:
    def __init__(self, quando: datetime) -> None:
        self.quando = quando

    def agora(self) -> datetime:
        return self.quando
