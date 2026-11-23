"""Rotas da consulta: etapas, oficialização, geração pela IA (escrita ao vivo por SSE) e documentos.

Consulta de outro médico = 404. Gating = 409. Consulta finalizada = 409 "use adendo". Dado de identidade no
pedido à IA = 422 (nada enviado). Os erros viram HTTP pelos tratadores registrados em `aplicacao.py`.
"""

import json
import queue
import threading
from collections.abc import Iterator
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from app.api.dependencias import Dependencias, dependencias, medico_atual
from app.consulta.abertura import abrir_do_pedido, abrir_do_retorno
from app.consulta.geracao import ResultadoGeracao, gerar, gerar_perguntas
from app.consulta.servico import SinalDesconhecido, editar, oficializar
from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import (
    AnamneseBloco,
    CondutaBloco,
    Consulta,
    DiagnosticosBloco,
    Documento,
    Etapa,
    EtapaIA,
    ExameBloco,
    HistoriaBloco,
    NovaConsulta,
    TipoDocumento,
)
from app.especialidades.registro import especialidades_disponiveis
from app.motores.perguntas import PerguntasProposta

rotas = APIRouter(prefix="/consultas", tags=["consultas"])
Dep = Annotated[Dependencias, Depends(dependencias)]
Medico = Annotated[UUID, Depends(medico_atual)]


@rotas.post("", status_code=status.HTTP_201_CREATED, response_model=Consulta)
def criar_consulta(nova: NovaConsulta, dep: Dep, medico: Medico) -> Consulta:
    if nova.especialidade not in especialidades_disponiveis():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "especialidade não disponível")
    return dep.repo.criar(medico, nova)


class AberturaDoPedido(ModeloApi):
    especialidade: str


@rotas.post("/do-pedido/{pedido_id}", response_model=Consulta)
def abrir_consulta_do_pedido(pedido_id: UUID, corpo: AberturaDoPedido, dep: Dep, medico: Medico) -> Consulta:
    """Cria o paciente e a consulta do pedido da agenda (a mesma consulta se já aberta)."""
    if corpo.especialidade not in especialidades_disponiveis():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "especialidade não disponível")
    return abrir_do_pedido(dep.agenda, dep.pacientes, dep.repo, medico, pedido_id, corpo.especialidade)


@rotas.post("/do-retorno/{retorno_id}", response_model=Consulta)
def abrir_consulta_do_retorno(retorno_id: UUID, corpo: AberturaDoPedido, dep: Dep, medico: Medico) -> Consulta:
    """Cria a consulta de retorno do cartão da agenda (a mesma se já aberta, inclusive finalizada)."""
    if corpo.especialidade not in especialidades_disponiveis():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "especialidade não disponível")
    return abrir_do_retorno(dep.agenda, dep.repo, medico, retorno_id, corpo.especialidade)


@rotas.get("/{consulta_id}", response_model=Consulta)
def buscar_consulta(consulta_id: UUID, dep: Dep, medico: Medico) -> Consulta:
    return dep.repo.buscar(medico, consulta_id)


@rotas.put("/{consulta_id}/anamnese", response_model=Consulta)
def editar_anamnese(consulta_id: UUID, conteudo: AnamneseBloco, dep: Dep, medico: Medico) -> Consulta:
    conhecidos = {s.id for s in dep.pacote(dep.repo.buscar(medico, consulta_id).especialidade).sinais}
    if any(s.id not in conhecidos for s in conteudo.sinais):
        raise SinalDesconhecido
    return editar(dep.repo, medico, consulta_id, "anamnese", conteudo)


@rotas.put("/{consulta_id}/exame", response_model=Consulta)
def editar_exame(consulta_id: UUID, conteudo: ExameBloco, dep: Dep, medico: Medico) -> Consulta:
    return editar(dep.repo, medico, consulta_id, "exame", conteudo)


@rotas.put("/{consulta_id}/historia", response_model=Consulta)
def editar_historia(consulta_id: UUID, conteudo: HistoriaBloco, dep: Dep, medico: Medico) -> Consulta:
    return editar(dep.repo, medico, consulta_id, "historia", conteudo)


@rotas.put("/{consulta_id}/diagnosticos", response_model=Consulta)
def editar_diagnosticos(consulta_id: UUID, conteudo: DiagnosticosBloco, dep: Dep, medico: Medico) -> Consulta:
    return editar(dep.repo, medico, consulta_id, "diagnosticos", conteudo)


@rotas.put("/{consulta_id}/conduta", response_model=Consulta)
def editar_conduta(consulta_id: UUID, conteudo: CondutaBloco, dep: Dep, medico: Medico) -> Consulta:
    return editar(dep.repo, medico, consulta_id, "conduta", conteudo)


@rotas.post("/{consulta_id}/{etapa}/oficializar", response_model=Consulta)
def oficializar_etapa(consulta_id: UUID, etapa: Etapa, dep: Dep, medico: Medico) -> Consulta:
    return oficializar(dep.repo, medico, consulta_id, etapa, dep.relogio.agora())


def _sse(evento: str, dados: str) -> str:
    return f"event: {evento}\ndata: {dados}\n\n"


@rotas.post("/{consulta_id}/perguntas/gerar", response_model=PerguntasProposta)
def gerar_perguntas_da_consulta(consulta_id: UUID, dep: Dep, medico: Medico) -> PerguntasProposta:
    """Perguntas de segurança escritas para este paciente, depois da história. Não grava: a tela salva com a história."""
    return gerar_perguntas(dep.contexto(), medico, consulta_id)


@rotas.post(
    "/{consulta_id}/{etapa}/gerar",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}, "description": "eventos `parcial` e, no fim, `pronto`"}},
)
def gerar_etapa(consulta_id: UUID, etapa: EtapaIA, dep: Dep, medico: Medico) -> StreamingResponse:
    """Escrita ao vivo (desenho §7.7): `parcial` = o resultado até ali (só para mostrar); `pronto` = ResultadoGeracao."""
    fila: queue.Queue[tuple[str, Any]] = queue.Queue()

    def trabalhar() -> None:
        try:
            r = gerar(dep.contexto(), medico, consulta_id, etapa, ao_escrever=lambda p: fila.put(("parcial", p)))
            fila.put(("pronto", r))
        except Exception as erro:  # vira resposta HTTP (antes de começar) ou evento `erro` (no meio)
            fila.put(("erro", erro))

    threading.Thread(target=trabalhar, daemon=True).start()
    primeiro = fila.get()
    if primeiro[0] == "erro":
        raise primeiro[1]  # gating, consulta, privacidade: tratadores HTTP (409/404/422)

    def eventos() -> Iterator[str]:
        tipo, valor = primeiro
        while True:
            if tipo == "parcial":
                yield _sse("parcial", json.dumps(valor, ensure_ascii=False))
            elif tipo == "pronto":
                r: ResultadoGeracao = valor
                yield _sse("pronto", r.model_dump_json(by_alias=True))
                return
            else:
                yield _sse("erro", json.dumps({"detail": "A IA não conseguiu; escreva ou tente de novo"}))
                return
            tipo, valor = fila.get()

    return StreamingResponse(eventos(), media_type="text/event-stream")


@rotas.put("/{consulta_id}/documentos/{tipo}", status_code=status.HTTP_204_NO_CONTENT)
def gravar_documento(
    consulta_id: UUID, tipo: TipoDocumento, documento: Documento, dep: Dep, medico: Medico
) -> Response:
    if documento.tipo != tipo:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "o tipo do documento não confere com o endereço")
    dep.repo.gravar_documento(medico, consulta_id, documento)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@rotas.get("/{consulta_id}/documentos", response_model=list[Documento])
def listar_documentos(consulta_id: UUID, dep: Dep, medico: Medico) -> list[Documento]:
    return dep.repo.documentos(medico, consulta_id)
