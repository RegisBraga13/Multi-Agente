"""Ponto de entrada (uvicorn app.main:app). A configuração é lida na importação: falta → falha na partida."""

import os

from app.aplicacao import Dependencias, criar_app
from app.config import carregar_configuracao
from app.consulta.repositorio_postgres import RepositorioConsultasPostgres
from app.identidade import MedicoLocal
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres
from app.provedores.ia import ProvedorIA
from app.provedores.ia_demonstracao import ProvedorDemonstracao

configuracao = carregar_configuracao(os.environ)


def _provedor() -> ProvedorIA:
    if configuracao.ia_provedor == "anthropic":
        from app.provedores.ia_anthropic import criar_provedor_anthropic

        return criar_provedor_anthropic()
    return ProvedorDemonstracao()


app = criar_app(
    Dependencias(
        identidade=MedicoLocal(configuracao.medico_local_id),
        pacientes=RepositorioPacientesPostgres(configuracao.database_url),
        consultas=RepositorioConsultasPostgres(configuracao.database_url),
        provedor=_provedor(),
    )
)
