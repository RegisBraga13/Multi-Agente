"""Ponto de entrada (uvicorn app.main:app). A configuração é lida na importação: falta → falha na partida."""

import os

from app.aplicacao import Dependencias, criar_app
from app.config import carregar_configuracao
from app.identidade import MedicoLocal
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres

configuracao = carregar_configuracao(os.environ)
app = criar_app(
    Dependencias(
        identidade=MedicoLocal(configuracao.medico_local_id),
        pacientes=RepositorioPacientesPostgres(configuracao.database_url),
    )
)
