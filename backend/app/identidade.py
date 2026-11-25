"""Quem é o médico da requisição, atrás de interface.

Primeiro uso (desenho §10): só o autor, no computador dele, com pacientes fictícios → `MedicoLocal`.
Login real (Supabase Auth / JWT) entra como outro adaptador nos portões do §11.
"""

from collections.abc import Callable
from typing import Protocol
from uuid import UUID


class Identidade(Protocol):
    def medico_atual(self, pagina: str | None = None) -> UUID: ...


class MedicoLocal:
    """Sem login: o médico local. Para testar outra especialidade no mesmo computador, a tela do módulo diz de qual
    página de médico está falando (`pagina`, ex. "paulo-mendes" na Reumatologia) e, se essa página existe, a
    requisição é desse médico (fictício). Some quando o login real entrar."""

    def __init__(self, medico_id: UUID, paginas: Callable[[str], UUID | None] | None = None) -> None:
        self.medico_id = medico_id
        self.paginas = paginas

    def medico_atual(self, pagina: str | None = None) -> UUID:
        if pagina and self.paginas and (outro := self.paginas(pagina)):
            return outro
        return self.medico_id
