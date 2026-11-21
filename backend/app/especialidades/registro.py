"""Registro das especialidades: cada pasta de `especialidades/` com sinais e prompts é uma especialidade disponível.

Acrescentar uma especialidade = acrescentar a pasta (prompts, sinais, condutas), sem mexer em código.
"""

from dataclasses import dataclass
from functools import cache

from app.especialidades.condutas import Protocolo, carregar_protocolos
from app.especialidades.pacote import PASTA_ESPECIALIDADES, SinalAlerta, carregar_sinais


@dataclass(frozen=True)
class Pacote:
    sinais: list[SinalAlerta]
    protocolos: dict[str, Protocolo]


def especialidades_disponiveis() -> list[str]:
    return sorted(p.name for p in PASTA_ESPECIALIDADES.iterdir() if (p / "sinais_alerta.yaml").is_file())


@cache
def carregar_pacote(especialidade: str) -> Pacote:
    return Pacote(sinais=carregar_sinais(especialidade), protocolos=carregar_protocolos(especialidade))
