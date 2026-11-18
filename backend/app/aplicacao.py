"""Monta o servidor a partir das dependências (os testes passam versões em memória)."""

from fastapi import FastAPI

from app.api import pacientes, saude
from app.api.dependencias import Dependencias

__all__ = ["Dependencias", "criar_app"]


def criar_app(dep: Dependencias) -> FastAPI:
    app = FastAPI(title="especIAlista — servidor da consulta", version="0.2.0")
    app.state.dependencias = dep
    app.include_router(saude.rotas)
    app.include_router(pacientes.rotas)
    return app
