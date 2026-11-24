"""Prontuário: proposto a partir dos blocos oficializados, finalizar (entrada imutável), adendo e histórico.

Finalizar exige as 5 etapas oficializadas e em dia e todo documento gravado já enviado. Depois disso, só
adendo datado.
"""

from contextlib import suppress
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import StringConstraints

from app.agenda import servico as agenda_servico
from app.agenda.servico import ErroAgenda
from app.api.dependencias import Dependencias, dependencias, medico_atual
from app.consulta.repositorio import ConsultaFinalizada
from app.consulta.servico import ROTULOS, ErroEtapa
from app.contratos.agenda import RetornoMarcado
from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import (
    ETAPAS,
    CondutaBloco,
    Consulta,
    DiagnosticosBloco,
    ExameBloco,
    HistoriaBloco,
)
from app.contratos.prontuario import DadosEntrada, EntradaProntuario, PacienteComProntuario
from app.prontuario.montar import aplicar_edicoes_narrativas, dados_da_consulta
from app.prontuario.retorno import comparar_com_origem
from app.prontuario.titulo import titulo_nova_entrada

rotas = APIRouter(tags=["prontuário"])
Dep = Annotated[Dependencias, Depends(dependencias)]
Medico = Annotated[UUID, Depends(medico_atual)]


class Finalizacao(ModeloApi):
    """`edicoes`: os textos que o médico mudou ou ditou na revisão final (chave → texto)."""

    edicoes: dict[str, str]
    retorno_marcado: RetornoMarcado | None = None  # rascunho da página 5: só vira cartão da agenda aqui


# a coluna `reason` do banco é obrigatória; o médico escreve só o texto
MOTIVO_PADRAO = "adendo do médico"


class NovoAdendo(ModeloApi):
    texto: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


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

    dados = dados_da_consulta(
        HistoriaBloco.model_validate(conteudo("historia")),
        DiagnosticosBloco.model_validate(conteudo("diagnosticos")),
        CondutaBloco.model_validate(conteudo("conduta")),
        ExameBloco.model_validate(conteudo("exame")),
        dep.repo.documentos(medico, consulta_id),
        retorno=consulta.tipo == "retorno",
    )
    origem = _entrada_de_origem(dep, medico, consulta)
    if origem is None:
        return dados
    return dados.model_copy(update={"comparacao": comparar_com_origem(dados, origem.dados, origem.titulo)})


def _entrada_de_origem(dep: Dependencias, medico: UUID, consulta: Consulta) -> EntradaProntuario | None:
    """Retorno: a entrada do prontuário da consulta que marcou este retorno."""
    if consulta.tipo != "retorno" or consulta.retorno_id is None:
        return None
    origem_id = dep.agenda.retorno(medico, consulta.retorno_id).consulta_origem_id
    return next((e for e in dep.repo.prontuario(medico, consulta.paciente_id) if e.id == origem_id), None)


def _titulo(dep: Dependencias, medico: UUID, consulta: Consulta) -> str:
    """Nome da entrada, fixado ao finalizar: consulta = "Consulta N" pela ordem em que foram finalizadas;
    retorno = o nome da consulta que o marcou + " — Retorno" (um retorno por consulta)."""
    if consulta.tipo == "retorno":
        origem = _entrada_de_origem(dep, medico, consulta)
        if origem is not None:
            return f"{origem.titulo} — Retorno"
    feitas = dep.repo.prontuario(medico, consulta.paciente_id)
    return titulo_nova_entrada([(e.tipo, "0", "") for e in feitas], consulta.tipo)


@rotas.get("/consultas/{consulta_id}/prontuario", response_model=DadosEntrada)
def prontuario_proposto(consulta_id: UUID, dep: Dep, medico: Medico) -> DadosEntrada:
    return _proposto(dep, medico, consulta_id)


@rotas.post("/consultas/{consulta_id}/finalizar", response_model=EntradaProntuario)
def finalizar(consulta_id: UUID, corpo: Finalizacao, dep: Dep, medico: Medico) -> EntradaProntuario:
    dados = _proposto(dep, medico, consulta_id)
    if any(d.estado != "enviado" for d in dep.repo.documentos(medico, consulta_id)):
        raise ErroEtapa("Envie os documentos antes de finalizar")
    pedidas = dict(corpo.edicoes)
    if dados.comparacao is not None and "P.orientacoes" in pedidas:
        # retorno: a linha mostra só as orientações novas; a edição do médico vai para elas
        nova = dados.comparacao.model_copy(update={"orientacoes": pedidas.pop("P.orientacoes").strip()})
        dados = dados.model_copy(update={"comparacao": nova})
    dados, edicoes = aplicar_edicoes_narrativas(dados, pedidas)
    consulta = dep.repo.buscar(medico, consulta_id)
    marcou = corpo.retorno_marcado is not None
    if corpo.retorno_marcado is not None:
        nome = dep.pacientes.buscar(medico, consulta.paciente_id)
        assert nome is not None
        try:
            agenda_servico.marcar_retorno(
                dep.agenda,
                medico,
                consulta.paciente_id,
                nome.nome,
                consulta_id,
                corpo.retorno_marcado,
                dep.relogio.agora(),
            )
        except ErroAgenda as erro:
            raise HTTPException(status.HTTP_409_CONFLICT, str(erro)) from erro
        dados = dados.model_copy(update={"retorno_marcado": corpo.retorno_marcado})
    try:
        titulo = _titulo(dep, medico, consulta)
        dep.repo.finalizar(medico, consulta_id, dados, edicoes, dep.relogio.agora(), titulo)
    except Exception:
        if marcou:
            with suppress(
                Exception
            ):  # falha ao desfazer não esconde o erro original; a próxima tentativa substitui o cartão
                dep.agenda.desfazer_retorno(medico, consulta_id)
        raise
    paciente = dep.repo.buscar(medico, consulta_id).paciente_id
    return next(e for e in dep.repo.prontuario(medico, paciente) if e.id == consulta_id)


@rotas.post("/consultas/{consulta_id}/adendos", status_code=status.HTTP_201_CREATED)
def adicionar_adendo(consulta_id: UUID, corpo: NovoAdendo, dep: Dep, medico: Medico) -> None:
    dep.repo.adicionar_adendo(medico, consulta_id, corpo.texto, MOTIVO_PADRAO, dep.relogio.agora())


@rotas.get("/pacientes/{paciente_id}/prontuario", response_model=list[EntradaProntuario])
def prontuario_do_paciente(paciente_id: UUID, dep: Dep, medico: Medico) -> list[EntradaProntuario]:
    if dep.pacientes.buscar(medico, paciente_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "paciente não encontrado")
    return dep.repo.prontuario(medico, paciente_id)


@rotas.get("/prontuarios", response_model=list[PacienteComProntuario])
def prontuarios(dep: Dep, medico: Medico) -> list[PacienteComProntuario]:
    itens: list[PacienteComProntuario] = []
    for paciente_id in dep.repo.pacientes_com_prontuario(medico):
        paciente = dep.pacientes.buscar(medico, paciente_id)
        entradas = dep.repo.prontuario(medico, paciente_id)
        if paciente is not None and entradas:
            itens.append(
                PacienteComProntuario(
                    id=paciente.id,
                    nome=paciente.nome,
                    nascimento=paciente.nascimento,
                    entradas=len(entradas),
                    ultima=entradas[0].data,
                )
            )
    return sorted(itens, key=lambda p: (-p.ultima.toordinal(), p.nome))
