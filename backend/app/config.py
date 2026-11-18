"""Configuração por variáveis de ambiente. Falta ou erro → falha na partida, com mensagem clara."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, cast
from uuid import UUID

ProvedorNome = Literal["anthropic", "demonstracao"]


class ErroConfiguracao(Exception):
    pass


@dataclass(frozen=True)
class Configuracao:
    database_url: str
    medico_local_id: UUID
    # IA_PROVEDOR: "demonstracao" (padrão: sem chave, sem custo) ou "anthropic" (exige ANTHROPIC_API_KEY)
    ia_provedor: ProvedorNome = "demonstracao"


def carregar_configuracao(env: Mapping[str, str]) -> Configuracao:
    faltando = [nome for nome in ("DATABASE_URL", "MEDICO_LOCAL_ID") if not env.get(nome)]
    if faltando:
        raise ErroConfiguracao(f"faltou {', '.join(faltando)}")
    try:
        medico = UUID(env["MEDICO_LOCAL_ID"])
    except ValueError as erro:
        raise ErroConfiguracao("MEDICO_LOCAL_ID não é um UUID válido") from erro
    provedor = env.get("IA_PROVEDOR") or "demonstracao"
    if provedor not in ("anthropic", "demonstracao"):
        raise ErroConfiguracao("IA_PROVEDOR deve ser 'anthropic' ou 'demonstracao'")
    if provedor == "anthropic" and not env.get("ANTHROPIC_API_KEY"):
        raise ErroConfiguracao("IA_PROVEDOR=anthropic exige ANTHROPIC_API_KEY")
    return Configuracao(
        database_url=env["DATABASE_URL"], medico_local_id=medico, ia_provedor=cast(ProvedorNome, provedor)
    )
