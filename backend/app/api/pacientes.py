"""Rotas de pacientes. Paciente de outro médico = 404 (não existe para quem pergunta)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencias import Dependencias, dependencias, medico_atual
from app.contratos.paciente import NovoPaciente, Paciente
from app.pacientes.repositorio import ErroCpfDuplicado

rotas = APIRouter(prefix="/pacientes", tags=["pacientes"])
Dep = Annotated[Dependencias, Depends(dependencias)]
Medico = Annotated[UUID, Depends(medico_atual)]


@rotas.post("", status_code=status.HTTP_201_CREATED, response_model=Paciente)
def criar_paciente(novo: NovoPaciente, dep: Dep, medico: Medico) -> Paciente:
    try:
        return dep.pacientes.criar(medico, novo)
    except ErroCpfDuplicado as erro:
        raise HTTPException(status.HTTP_409_CONFLICT, "já existe paciente com este CPF") from erro


@rotas.get("/{paciente_id}", response_model=Paciente)
def buscar_paciente(paciente_id: UUID, dep: Dep, medico: Medico) -> Paciente:
    paciente = dep.pacientes.buscar(medico, paciente_id)
    if paciente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "paciente não encontrado")
    return paciente
