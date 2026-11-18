"""Dependências injetadas nas rotas (trocáveis nos testes)."""

from dataclasses import dataclass, field
from uuid import UUID

from fastapi import Request

from app.consulta.geracao import Contexto
from app.consulta.repositorio import RepositorioConsultas, RepositorioConsultasMemoria
from app.especialidades.condutas import Protocolo, carregar_protocolos
from app.especialidades.pacote import SinalAlerta, carregar_sinais
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
    sinais: list[SinalAlerta] = field(default_factory=lambda: carregar_sinais("dermatologia"))
    protocolos: dict[str, Protocolo] = field(default_factory=lambda: carregar_protocolos("dermatologia"))

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
            sinais=self.sinais,
            protocolos=self.protocolos,
        )


def dependencias(request: Request) -> Dependencias:
    dep: Dependencias = request.app.state.dependencias
    return dep


def medico_atual(request: Request) -> UUID:
    return dependencias(request).identidade.medico_atual()
