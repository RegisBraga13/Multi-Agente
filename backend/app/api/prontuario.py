"""Prontuário: proposto a partir dos blocos oficializados, finalizar (entrada imutável), adendo e histórico.

Finalizar exige as 5 etapas oficializadas e em dia e todo documento gravado já enviado. Depois disso, só
adendo datado.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field

from app.api.dependencias import Dependencias, dependencias, medico_atual
from app.consulta.repositorio import ConsultaFinalizada
from app.consulta.servico import ROTULOS, ErroEtapa
from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import (
    ETAPAS,
    CondutaBloco,
    DiagnosticosBloco,
    ExameBloco,
    HistoriaBloco,
)
from app.contratos.prontuario import DadosEntrada, EntradaProntuario
from app.prontuario.montar import dados_da_consulta

rotas = APIRouter(tags=["prontuário"])
Dep = Annotated[Dependencias, Depends(dependencias)]
Medico = Annotated[UUID, Depends(medico_atual)]


class Finalizacao(ModeloApi):
    """`edicoes`: os textos que o médico mudou ou ditou na revisão final (chave → texto)."""

    edicoes: dict[str, str]


class NovoAdendo(ModeloApi):
    texto: str = Field(min_length=1)
    motivo: str = Field(min_length=1)


def _proposto(dep: Dependencias, medico: UUID, consulta_id: UUID) -> DadosEntrada:
    consulta = dep.repo.buscar(medico, consulta_id)
    if consulta.finalizada_em is not None:
        raise ConsultaFinalizada
    for etapa in ETAPAS:
        b = consulta.bloco(etapa)
        if b is None or b.estado != "oficializado" or b.desatualizado:
            raise ErroEtapa(f"Oficialize {ROTULOS[etapa]} antes")

    def conteudo(etapa: str) -> dict[str, object]:
        bloco = consulta.bloco(etapa)  # type: ignore[arg-type]
        assert bloco is not None
        return bloco.conteudo

    return dados_da_consulta(
        HistoriaBloco.model_validate(conteudo("historia")),
        DiagnosticosBloco.model_validate(conteudo("diagnosticos")),
        CondutaBloco.model_validate(conteudo("conduta")),
        ExameBloco.model_validate(conteudo("exame")),
        dep.repo.documentos(medico, consulta_id),
    )


@rotas.get("/consultas/{consulta_id}/prontuario", response_model=DadosEntrada)
def prontuario_proposto(consulta_id: UUID, dep: Dep, medico: Medico) -> DadosEntrada:
    return _proposto(dep, medico, consulta_id)


@rotas.post("/consultas/{consulta_id}/finalizar", response_model=EntradaProntuario)
def finalizar(consulta_id: UUID, corpo: Finalizacao, dep: Dep, medico: Medico) -> EntradaProntuario:
    dados = _proposto(dep, medico, consulta_id)
    if any(d.estado != "enviado" for d in dep.repo.documentos(medico, consulta_id)):
        raise ErroEtapa("Envie os documentos antes de finalizar")
    dep.repo.finalizar(medico, consulta_id, dados, corpo.edicoes, dep.relogio.agora())
    paciente = dep.repo.buscar(medico, consulta_id).paciente_id
    return next(e for e in dep.repo.prontuario(medico, paciente) if e.id == consulta_id)


@rotas.post("/consultas/{consulta_id}/adendos", status_code=status.HTTP_201_CREATED)
def adicionar_adendo(consulta_id: UUID, corpo: NovoAdendo, dep: Dep, medico: Medico) -> None:
    dep.repo.adicionar_adendo(medico, consulta_id, corpo.texto, corpo.motivo, dep.relogio.agora())


@rotas.get("/pacientes/{paciente_id}/prontuario", response_model=list[EntradaProntuario])
def prontuario_do_paciente(paciente_id: UUID, dep: Dep, medico: Medico) -> list[EntradaProntuario]:
    if dep.pacientes.buscar(medico, paciente_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "paciente não encontrado")
    return dep.repo.prontuario(medico, paciente_id)
