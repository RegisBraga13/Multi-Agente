"""Rotas das especialidades: o que a tela precisa saber do pacote de cada uma."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencias import Dependencias, dependencias
from app.contratos.base import ModeloApi
from app.especialidades.pacote import Prazo, TipoSinal
from app.especialidades.registro import especialidades_disponiveis

rotas = APIRouter(prefix="/especialidades", tags=["especialidades"])
Dep = Annotated[Dependencias, Depends(dependencias)]


class SinalDaLista(ModeloApi):
    id: str
    texto: str
    tipo: TipoSinal
    acao: list[str]
    prazo: Prazo


@rotas.get("/{slug}/sinais", response_model=list[SinalDaLista])
def sinais_da_especialidade(slug: str, dep: Dep) -> list[SinalDaLista]:
    """A lista FIXA de sinais de alerta (sempre checada), na ordem do pacote."""
    if slug not in especialidades_disponiveis():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "especialidade não encontrada")
    return [
        SinalDaLista(id=s.id, texto=s.texto, tipo=s.tipo, acao=s.acao, prazo=s.prazo) for s in dep.pacote(slug).sinais
    ]
