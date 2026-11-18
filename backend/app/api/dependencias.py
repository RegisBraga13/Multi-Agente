"""Dependências injetadas nas rotas (trocáveis nos testes)."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Request

from app.identidade import Identidade
from app.pacientes.repositorio import RepositorioPacientes


@dataclass
class Dependencias:
    identidade: Identidade
    pacientes: RepositorioPacientes


def dependencias(request: Request) -> Dependencias:
    dep: Dependencias = request.app.state.dependencias
    return dep


def medico_atual(request: Request) -> UUID:
    return dependencias(request).identidade.medico_atual()
