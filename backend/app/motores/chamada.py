"""Chamada de um motor de IA, igual para todos os motores (desenho §7.2 e §7.5).

Ordem: (1) privacidade — dado de identidade no pedido bloqueia antes do provedor; (2) provedor;
(3) estrutura inválida → REJECT, sem uso parcial; (3b) regra fixa do motor, se houver, pode limpar a saída
(com aviso) ou rejeitá-la; (4) válida → política (sempre HUMAN_REVIEW);
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

from pydantic import ValidationError
from pydantic_core import from_json

from app.consulta.politica import decidir
from app.contratos.base import ModeloApi
from app.contratos.motor import MetaProposta, PropostaIA, RegistroDecisao
from app.privacidade import encontrar_identidade
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio


class ErroPrivacidade(Exception):
    """O pedido à IA contém dado de identidade; nada foi enviado."""


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


def _parciais(ao_escrever: Callable[[dict[str, Any]], None]) -> Callable[[str], None]:
    """Texto acumulado → resultado parcial (só para mostrar; nunca é validado, gravado ou usado adiante)."""
    ultimo: list[dict[str, Any]] = []

    def ao_texto(texto: str) -> None:
        try:
            parcial = from_json(texto, allow_partial="trailing-strings")
        except ValueError:
            return
        resultado = parcial.get("resultado") if isinstance(parcial, dict) else None
        if isinstance(resultado, dict) and (not ultimo or resultado != ultimo[-1]):
            ultimo.append(resultado)
            ao_escrever(resultado)

    return ao_texto


def chamar_motor[T: ModeloApi](
    provedor: ProvedorIA,
    pedido: PedidoIA,
    esquema: type[T],
    versao_esquema: int,
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
    regra: Callable[[T], tuple[T | None, list[str]]] | None = None,
    ao_escrever: Callable[[dict[str, Any]], None] | None = None,
) -> PropostaIA[T]:
    textos = list(_textos([pedido.instrucoes, pedido.dados]))
    achados = sorted({tipo for texto in textos for tipo in encontrar_identidade(texto)})
    if achados:
        raise ErroPrivacidade(f"dado de identidade no pedido ao motor {pedido.motor!r}: {', '.join(achados)}")
    # termos do paciente: só nos dados (as instruções fixas e as listas do pacote não vêm do paciente)
    if _tem_termo_proibido(list(_textos(pedido.dados)), termos_proibidos):
        # a mensagem nunca repete o termo (ela pode ir para log)
        raise ErroPrivacidade(f"termo proibido do paciente no pedido ao motor {pedido.motor!r}")

    if ao_escrever is None:
        resposta = provedor.gerar(pedido, esquema)
    else:
        resposta = provedor.gerar(pedido, esquema, ao_escrever=_parciais(ao_escrever))
    resultado: T | None = None
    meta: MetaProposta | None = None
    if resposta.erro is None and isinstance(resposta.bruto, dict):
        try:
            envelope = _Envelope.model_validate(resposta.bruto)
            resultado = esquema.model_validate_json(json.dumps(envelope.resultado), strict=True)
            meta = MetaProposta.model_validate_json(json.dumps(envelope.meta), strict=True)
        except (ValidationError, TypeError, ValueError):
            resultado, meta = None, None

    valida = resultado is not None and meta is not None
    avisos_evidencia: list[str] = []
    if meta is not None:
        # evidência do meta só passa se o trecho estiver, literalmente, no que foi enviado à IA
        fontes = [t for t in _textos(pedido.dados) if t]
        boas = [e for e in meta.evidencias if e.trecho.strip() and any(e.trecho.strip() in f for f in fontes)]
        avisos_evidencia = [
            f"evidência sem trecho da entrada descartada ({e.trecho!r})" for e in meta.evidencias if e not in boas
        ]
        meta = meta.model_copy(update={"evidencias": boas})
    avisos_regra: list[str] = []
    rejeitada_pela_regra = False
    if valida and regra is not None and resultado is not None:
        # regra fixa do motor sobre a saída válida (ex.: evidência tem de estar na história)
        resultado, avisos_regra = regra(resultado)
        rejeitada_pela_regra = resultado is None
        valida = not rejeitada_pela_regra
    acao, motivos = decidir(valida, meta.confianca if meta else None)
    if rejeitada_pela_regra:
        motivos = avisos_regra
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
        avisos=[
            *(meta.avisos if meta else []),
            *avisos_evidencia,
            *([] if rejeitada_pela_regra else avisos_regra),
        ],
        origem=meta.origem if meta else "",
        acao=acao,
        motivos=motivos,
    )
