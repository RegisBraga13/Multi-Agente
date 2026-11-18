"""Chamada de um motor de IA, igual para todos os motores (desenho §7.2 e §7.5).

Ordem: (1) privacidade — dado de identidade no pedido bloqueia antes do provedor; (2) provedor;
(3) estrutura inválida → REJECT, sem uso parcial; (4) válida → política (sempre HUMAN_REVIEW);
(5) registro da decisão, sem prompt e sem dado.

O provedor devolve o envelope {"resultado": <esquema do motor>, "meta": {confianca, evidencias, avisos, origem}} —
nada além disso. A validação é estrita (texto no lugar de número é erro) e feita como JSON.

Nomes de pessoas não são detectáveis por padrão: o pedido é montado só com campos desidentificados e a
chamada recebe os termos proibidos do paciente (nome, CPF, telefone), conferidos sem acento e sem caixa.
"""

import json
import re
import unicodedata
from collections.abc import Callable, Iterator, Sequence
from typing import Any
from uuid import uuid4

from pydantic import Field, ValidationError

from app.consulta.politica import decidir
from app.contratos.base import ModeloApi
from app.contratos.motor import Evidencia, PropostaIA, RegistroDecisao
from app.privacidade import encontrar_identidade
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio


class ErroPrivacidade(Exception):
    """O pedido à IA contém dado de identidade; nada foi enviado."""


class _Meta(ModeloApi):
    confianca: float = Field(ge=0, le=1)
    evidencias: list[Evidencia]
    avisos: list[str]
    origem: str


class _Envelope(ModeloApi):
    resultado: Any
    meta: Any


def _textos(x: Any) -> Iterator[str]:
    """Todo texto do pedido, inclusive números e objetos (nada passa sem ser varrido)."""
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for chave, valor in x.items():
            yield str(chave)
            yield from _textos(valor)
    elif isinstance(x, list | tuple | set | frozenset):
        for valor in x:
            yield from _textos(valor)
    elif x is not None and not isinstance(x, bool):
        yield str(x)


def _normalizar(texto: str) -> str:
    """Sem acento e sem diferença de caixa ("Mariána" == "MARIANA")."""
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)).casefold()


def _tem_termo_proibido(textos: list[str], termos: Sequence[str]) -> bool:
    padroes = [re.compile(rf"\b{re.escape(_normalizar(t.strip()))}\b") for t in termos if t.strip()]
    return any(p.search(_normalizar(texto)) for texto in textos for p in padroes)


def chamar_motor[T: ModeloApi](
    provedor: ProvedorIA,
    pedido: PedidoIA,
    esquema: type[T],
    versao_esquema: int,
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
) -> PropostaIA[T]:
    textos = list(_textos([pedido.instrucoes, pedido.dados]))
    achados = sorted({tipo for texto in textos for tipo in encontrar_identidade(texto)})
    if achados:
        raise ErroPrivacidade(f"dado de identidade no pedido ao motor {pedido.motor!r}: {', '.join(achados)}")
    if _tem_termo_proibido(textos, termos_proibidos):
        # a mensagem nunca repete o termo (ela pode ir para log)
        raise ErroPrivacidade(f"termo proibido do paciente no pedido ao motor {pedido.motor!r}")

    resposta = provedor.gerar(pedido, esquema)
    resultado: T | None = None
    meta: _Meta | None = None
    if resposta.erro is None and isinstance(resposta.bruto, dict):
        try:
            envelope = _Envelope.model_validate(resposta.bruto)
            resultado = esquema.model_validate_json(json.dumps(envelope.resultado), strict=True)
            meta = _Meta.model_validate_json(json.dumps(envelope.meta), strict=True)
        except (ValidationError, TypeError, ValueError):
            resultado, meta = None, None

    valida = resultado is not None and meta is not None
    acao, motivos = decidir(valida, meta.confianca if meta else None)
    if resposta.erro:
        motivos = [*motivos, f"erro do provedor: {resposta.erro}"]
    registrar(
        RegistroDecisao(
            decision_id=uuid4(),
            motor=pedido.motor,
            modelo=resposta.modelo,
            versao_modelo=resposta.versao_modelo,
            versao_esquema=versao_esquema,
            versao_prompt=pedido.versao_prompt,
            confianca=meta.confianca if meta else None,
            acao=acao,
            tokens_entrada=resposta.tokens_entrada,
            tokens_saida=resposta.tokens_saida,
            quando=relogio.agora(),
        )
    )
    return PropostaIA[T](
        resultado=resultado if valida else None,
        confianca=meta.confianca if meta else 0.0,
        evidencias=meta.evidencias if meta else [],
        avisos=meta.avisos if meta else [],
        origem=meta.origem if meta else "",
        acao=acao,
        motivos=motivos,
    )
