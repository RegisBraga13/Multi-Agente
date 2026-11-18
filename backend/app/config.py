"""Configuração por variáveis de ambiente. Falta ou erro → falha na partida, com mensagem clara."""

from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID


class ErroConfiguracao(Exception):
    pass


@dataclass(frozen=True)
class Configuracao:
    database_url: str
    medico_local_id: UUID


def carregar_configuracao(env: Mapping[str, str]) -> Configuracao:
    faltando = [nome for nome in ("DATABASE_URL", "MEDICO_LOCAL_ID") if not env.get(nome)]
    if faltando:
        raise ErroConfiguracao(f"faltou {', '.join(faltando)}")
    try:
        medico = UUID(env["MEDICO_LOCAL_ID"])
    except ValueError as erro:
        raise ErroConfiguracao("MEDICO_LOCAL_ID não é um UUID válido") from erro
    return Configuracao(database_url=env["DATABASE_URL"], medico_local_id=medico)
