"""Rotas da agenda.

`/publico/...`: o paciente, sem login (página do médico e link do formulário). Só aceita o que ele pode fazer:
ver horários ocupados, pedir um horário e enviar o próprio formulário (o link tem um token impossível de adivinhar).
`/agenda/...`: o médico, sempre sob a RLS dele.
"""

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.agenda import servico
from app.api.dependencias import Dependencias, dependencias, medico_atual
from app.consulta.repositorio import ConsultaNaoEncontrada
from app.contratos.agenda import (
    DadosPessoais,
    FichaDoRetorno,
    FormularioEnviado,
    HistoricoDoPaciente,
    Horario,
    NovoPedido,
    Pedido,
    PedidoCriado,
    PedidoDoMedico,
    PedidoParaPaciente,
    Retorno,
    RetornoComFicha,
)
from app.contratos.consulta_blocos import AnamneseBloco
from app.prontuario.alergias import alergias_do_prontuario

publico = APIRouter(prefix="/publico", tags=["agenda (paciente)"])
medico_rotas = APIRouter(prefix="/agenda", tags=["agenda (médico)"])
Dep = Annotated[Dependencias, Depends(dependencias)]
Medico = Annotated[UUID, Depends(medico_atual)]


@publico.get("/medicos/{slug}/ocupados", response_model=list[Horario])
def horarios_ocupados(slug: str, de: date, ate: date, dep: Dep) -> list[Horario]:
    servico.periodo_valido(de, ate)
    return dep.agenda.ocupados(servico.medico_da_pagina(dep.agenda, slug), de, ate)


@publico.post("/medicos/{slug}/pedidos", status_code=status.HTTP_201_CREATED, response_model=PedidoCriado)
def pedir_consulta(slug: str, novo: NovoPedido, dep: Dep) -> PedidoCriado:
    return servico.pedir_consulta(dep.agenda, slug, novo, dep.relogio.agora())


@publico.get("/formularios/{token}", response_model=PedidoParaPaciente)
def abrir_formulario(token: str, dep: Dep) -> PedidoParaPaciente:
    dono, p = servico.pedido_do_link(dep.agenda, token)
    return PedidoParaPaciente(
        medico_slug=dep.agenda.slug_do_medico(dono) or "",
        data=p.data,
        inicio=p.inicio,
        modalidade=p.modalidade,
        nome=p.nome,
        whatsapp=p.whatsapp,
        situacao_ficha=p.situacao_ficha,
    )


@publico.post("/formularios/{token}", status_code=status.HTTP_204_NO_CONTENT)
def enviar_formulario(token: str, enviado: FormularioEnviado, dep: Dep) -> Response:
    servico.enviar_formulario(dep.agenda, token, enviado, dep.relogio.agora())
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@medico_rotas.get("/pedidos", response_model=list[PedidoDoMedico])
def pedidos(de: date, ate: date, dep: Dep, medico: Medico) -> list[PedidoDoMedico]:
    servico.periodo_valido(de, ate)
    return [_com_historico(dep, medico, p) for p in dep.agenda.pedidos(medico, de, ate)]


def _com_historico(dep: Dependencias, medico: UUID, p: Pedido) -> PedidoDoMedico:
    """Quem já tem prontuário (mesmo nome completo e nascimento) volta como consulta nova, com as alergias conhecidas."""
    historico = None
    if p.formulario is not None:
        d = p.formulario.dados
        paciente = dep.pacientes.procurar(medico, d.nome_completo, d.nascimento)
        if paciente is not None and dep.repo.prontuario(medico, paciente.id):
            historico = HistoricoDoPaciente(
                paciente_id=paciente.id, alergias=alergias_do_prontuario(dep.repo, medico, paciente.id)
            )
    return PedidoDoMedico(**p.model_dump(), historico=historico)


def _ficha_do_retorno(dep: Dependencias, medico: UUID, r: Retorno) -> FichaDoRetorno | None:
    """A ficha do retorno vem do que já existe: a anamnese da consulta de origem, o aceite do pedido e o cadastro."""
    try:
        origem = dep.repo.buscar(medico, r.consulta_origem_id)
    except ConsultaNaoEncontrada:  # sem a consulta de origem, o cartão segue sem ficha
        return None
    bloco = origem.bloco("anamnese")
    if bloco is None:
        return None
    a = AnamneseBloco.model_validate(bloco.conteudo)
    transcricao = dep.agenda.pedido(medico, origem.pedido_id).transcricao if origem.pedido_id else None
    paciente = dep.pacientes.buscar(medico, r.paciente_id)
    return FichaDoRetorno(
        queixa=a.queixa,
        em_uso=a.em_uso,
        antecedentes=a.antecedentes,
        alergias=a.alergias,
        transcricao=transcricao,
        nascimento=paciente.nascimento if paciente else None,
    )


def _com_ficha(dep: Dependencias, medico: UUID, r: Retorno) -> RetornoComFicha:
    return RetornoComFicha(**r.model_dump(), ficha=_ficha_do_retorno(dep, medico, r))


@medico_rotas.get("/retornos", response_model=list[RetornoComFicha])
def retornos(de: date, ate: date, dep: Dep, medico: Medico) -> list[RetornoComFicha]:
    servico.periodo_valido(de, ate)
    return [_com_ficha(dep, medico, r) for r in dep.agenda.retornos(medico, de, ate)]


@medico_rotas.get("/retornos/{retorno_id}", response_model=RetornoComFicha)
def um_retorno(retorno_id: UUID, dep: Dep, medico: Medico) -> RetornoComFicha:
    return _com_ficha(dep, medico, dep.agenda.retorno(medico, retorno_id))


@medico_rotas.get("/pedidos/{pedido_id}", response_model=PedidoDoMedico)
def um_pedido(pedido_id: UUID, dep: Dep, medico: Medico) -> PedidoDoMedico:
    return _com_historico(dep, medico, dep.agenda.pedido(medico, pedido_id))


@medico_rotas.post("/pedidos/{pedido_id}/link-enviado", response_model=PedidoDoMedico)
def link_enviado(pedido_id: UUID, dep: Dep, medico: Medico) -> PedidoDoMedico:
    return _com_historico(dep, medico, dep.agenda.marcar_link_enviado(medico, pedido_id))


@medico_rotas.post("/pedidos/{pedido_id}/confirmar", response_model=PedidoDoMedico)
def confirmar(pedido_id: UUID, dep: Dep, medico: Medico) -> PedidoDoMedico:
    return _com_historico(dep, medico, dep.agenda.confirmar(medico, pedido_id))


@medico_rotas.post("/pedidos/{pedido_id}/cancelar", response_model=PedidoDoMedico)
def cancelar(pedido_id: UUID, dep: Dep, medico: Medico) -> PedidoDoMedico:
    return _com_historico(dep, medico, dep.agenda.cancelar(medico, pedido_id))


@medico_rotas.post("/pedidos/{pedido_id}/identificacao", response_model=PedidoDoMedico)
def identificacao(pedido_id: UUID, dados: DadosPessoais, dep: Dep, medico: Medico) -> PedidoDoMedico:
    pedido = servico.identificacao_na_chegada(dep.agenda, medico, pedido_id, dados, dep.relogio.agora())
    return _com_historico(dep, medico, pedido)


@medico_rotas.get("/pedidos/{pedido_id}/fotos/{pergunta}")
def foto(pedido_id: UUID, pergunta: str, dep: Dep, medico: Medico) -> Response:
    achada = dep.agenda.foto(medico, pedido_id, pergunta)
    if achada is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "foto não encontrada")
    return Response(achada.conteudo, media_type=achada.tipo, headers={"Cache-Control": "private, no-store"})
