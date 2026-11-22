"""Regras do pedido e do formulário, iguais para qualquer repositório."""

import base64
import binascii
import secrets
from datetime import date, datetime
from uuid import UUID

from app.agenda.repositorio import FotoGuardada, RepositorioAgenda, instante
from app.contratos.agenda import (
    DadosPessoais,
    FormularioEnviado,
    FormularioRecebido,
    NovoPedido,
    Pedido,
    PedidoCriado,
    Retorno,
    RetornoMarcado,
)

TAMANHO_MAXIMO_FOTO = 10 * 1024 * 1024


class ErroAgenda(Exception):
    """Pedido ou formulário que não pode ser aceito; a mensagem é para quem preenche."""


class PaginaNaoEncontrada(Exception):
    """Nenhum médico com este endereço de página."""


class FormularioNaoEncontrado(Exception):
    """Link de formulário que não existe."""


def novo_token() -> str:
    """Link do formulário: impossível de adivinhar (256 bits)."""
    return secrets.token_urlsafe(32)


def medico_da_pagina(repo: RepositorioAgenda, slug: str) -> UUID:
    medico = repo.medico_da_pagina(slug)
    if medico is None:
        raise PaginaNaoEncontrada
    return medico


def pedir_consulta(repo: RepositorioAgenda, slug: str, novo: NovoPedido, agora: datetime) -> PedidoCriado:
    medico = medico_da_pagina(repo, slug)
    if instante(novo.data, novo.inicio) <= agora:
        raise ErroAgenda("Esse horário já passou. Escolha outro.")
    pedido = repo.criar_pedido(medico, novo, novo_token())
    return PedidoCriado(id=pedido.id, token_formulario=pedido.token_formulario)


def _decodificar(pergunta: str, conteudo: str) -> bytes:
    try:
        dados = base64.b64decode(conteudo, validate=True)
    except (binascii.Error, ValueError) as erro:
        raise ErroAgenda("Uma das fotos não pôde ser lida. Escolha de novo.") from erro
    if not dados:
        raise ErroAgenda("Uma das fotos está vazia. Escolha de novo.")
    if len(dados) > TAMANHO_MAXIMO_FOTO:
        raise ErroAgenda("Cada foto pode ter até 10 MB.")
    return dados


def pedido_do_link(repo: RepositorioAgenda, token: str) -> tuple[UUID, Pedido]:
    achado = repo.pedido_do_token(token)
    if achado is None:
        raise FormularioNaoEncontrado
    return achado


def enviar_formulario(repo: RepositorioAgenda, token: str, enviado: FormularioEnviado, agora: datetime) -> Pedido:
    medico, pedido = pedido_do_link(repo, token)
    fotos = {p: FotoGuardada(tipo=f.tipo, conteudo=_decodificar(p, f.base64)) for p, f in enviado.fotos.items()}
    recebido = FormularioRecebido(
        dados=enviado.dados, respostas=enviado.respostas, fotos=sorted(fotos), recebido_em=agora
    )
    return repo.gravar_formulario(medico, pedido.id, recebido, fotos)


def identificacao_na_chegada(
    repo: RepositorioAgenda, medico: UUID, pedido_id: UUID, dados: DadosPessoais, agora: datetime
) -> Pedido:
    """Quem escolheu "preencher na consulta": o médico preenche a Identificação na chegada (o resto vira Perguntas).
    Não substitui um formulário que o paciente já enviou."""
    if repo.pedido(medico, pedido_id).formulario is not None:
        raise ErroAgenda("O paciente já enviou o formulário.")
    recebido = FormularioRecebido(dados=dados, respostas={}, fotos=[], recebido_em=agora)
    return repo.gravar_formulario(medico, pedido_id, recebido, {})


def periodo_valido(de: date, ate: date) -> None:
    if ate < de or (ate - de).days > 62:
        raise ErroAgenda("Período inválido (no máximo dois meses).")


def marcar_retorno(
    repo: RepositorioAgenda,
    medico: UUID,
    paciente_id: UUID,
    paciente_nome: str,
    consulta_id: UUID,
    marcado: RetornoMarcado,
    agora: datetime,
) -> Retorno:
    """O retorno combinado na consulta vira cartão da agenda (HorarioOcupado se o horário já foi tomado)."""
    if instante(marcado.data, marcado.inicio) <= agora:
        raise ErroAgenda("Esse horário já passou. Escolha outro.")
    return repo.criar_retorno(medico, paciente_id, paciente_nome, consulta_id, marcado)
