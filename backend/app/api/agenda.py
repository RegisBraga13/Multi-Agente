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
from app.contratos.agenda import FormularioEnviado, Horario, NovoPedido, Pedido, PedidoCriado, PedidoParaPaciente

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


@medico_rotas.get("/pedidos", response_model=list[Pedido])
def pedidos(de: date, ate: date, dep: Dep, medico: Medico) -> list[Pedido]:
    servico.periodo_valido(de, ate)
    return dep.agenda.pedidos(medico, de, ate)


@medico_rotas.get("/pedidos/{pedido_id}", response_model=Pedido)
def um_pedido(pedido_id: UUID, dep: Dep, medico: Medico) -> Pedido:
    return dep.agenda.pedido(medico, pedido_id)


@medico_rotas.post("/pedidos/{pedido_id}/link-enviado", response_model=Pedido)
def link_enviado(pedido_id: UUID, dep: Dep, medico: Medico) -> Pedido:
    return dep.agenda.marcar_link_enviado(medico, pedido_id)


@medico_rotas.get("/pedidos/{pedido_id}/fotos/{pergunta}")
def foto(pedido_id: UUID, pergunta: str, dep: Dep, medico: Medico) -> Response:
    achada = dep.agenda.foto(medico, pedido_id, pergunta)
    if achada is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "foto não encontrada")
    return Response(achada.conteudo, media_type=achada.tipo, headers={"Cache-Control": "private, no-store"})
