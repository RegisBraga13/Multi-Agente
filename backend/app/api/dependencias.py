"""Dependências injetadas nas rotas (trocáveis nos testes)."""

from collections.abc import Callable
from dataclasses import dataclass, field
from uuid import UUID

from fastapi import Request

from app.agenda.repositorio import RepositorioAgenda, RepositorioAgendaMemoria
from app.consulta.geracao import Contexto
from app.consulta.repositorio import RepositorioConsultas, RepositorioConsultasMemoria
from app.especialidades.registro import Pacote, carregar_pacote
from app.identidade import Identidade
from app.pacientes.repositorio import RepositorioPacientes
from app.provedores.ia import ProvedorIA
from app.provedores.ia_falso import ProvedorIAFalso
from app.provedores.relogio import Relogio, RelogioSistema


@dataclass
class Dependencias:
    identidade: Identidade
    pacientes: RepositorioPacientes
    consultas: RepositorioConsultas | None = None  # None → em memória, ligado aos pacientes
    provedor: ProvedorIA = field(default_factory=lambda: ProvedorIAFalso({}))
    relogio: Relogio = field(default_factory=RelogioSistema)
    pacote: Callable[[str], Pacote] = carregar_pacote
    agenda: RepositorioAgenda = field(default_factory=RepositorioAgendaMemoria)

    def __post_init__(self) -> None:
        if self.consultas is None:
            self.consultas = RepositorioConsultasMemoria(self.pacientes)

    @property
    def repo(self) -> RepositorioConsultas:
        assert self.consultas is not None
        return self.consultas

    def contexto(self) -> Contexto:
        return Contexto(
            repo=self.repo,
            pacientes=self.pacientes,
            provedor=self.provedor,
            relogio=self.relogio,
            pacote=self.pacote,
        )


def dependencias(request: Request) -> Dependencias:
    dep: Dependencias = request.app.state.dependencias
    return dep


def medico_atual(request: Request) -> UUID:
    # sem login (só local): a tela do módulo informa a página do médico fictício daquela especialidade
    # (a imagem de uma foto não leva cabeçalho: vem no endereço, ?medico_pagina=)
    pagina = request.headers.get("x-medico-pagina") or request.query_params.get("medico_pagina")
    return dependencias(request).identidade.medico_atual(pagina)
