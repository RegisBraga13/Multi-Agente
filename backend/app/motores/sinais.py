"""Sinais de alerta (desenho §7.3): nunca só IA.

1. Regra fixa, sempre: sinal da lista respondido "sim" pelo médico dispara — sem IA.
2. A IA procura na conversa e no exame sinais da lista ainda não respondidos e pode sugerir extras (marcados).
   Um sinal da IA só entra com id da lista e trecho copiado da entrada; o resto vira aviso para o médico.
   Sinal que o médico respondeu "não" continua não disparado: o achado da IA vira aviso (a resposta dele vale).
3. A IA falhou → só a lista respondida, com aviso.
"""

from collections.abc import Callable, Sequence
from typing import Literal

from app.contratos.base import ModeloApi
from app.contratos.consulta import EntradaConsulta
from app.contratos.motor import RegistroDecisao
from app.especialidades.pacote import Prazo, SinalAlerta, TipoSinal
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import ErroPrivacidade, chamar_motor
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_SINAIS = 1
_ORDEM_TIPO: dict[str, int] = {"urgencia_imediata": 0, "prioridade": 1, "muda_tratamento": 2}


class SinalDetectado(ModeloApi):
    id: str
    trecho: str


class SinaisIA(ModeloApi):
    detectados: list[SinalDetectado]
    extras: list[str]


class SinalDisparado(ModeloApi):
    id: str
    texto: str
    tipo: TipoSinal
    acao: list[str]
    prazo: Prazo
    origem: Literal["respondido", "ia"]
    trecho: str | None


class SinaisConsulta(ModeloApi):
    """`conflitos`: sinais que o médico respondeu "não" mas a IA encontrou com trecho — não disparam (a resposta
    dele vale), mas a tela tem de mostrá-los em destaque. `ia_falhou`: só a lista respondida foi checada."""

    disparados: list[SinalDisparado]
    conflitos: list[SinalDisparado]
    extras_ia: list[str]
    avisos: list[str]
    ia_falhou: bool


def _disparado(s: SinalAlerta, origem: Literal["respondido", "ia"], trecho: str | None) -> SinalDisparado:
    return SinalDisparado(id=s.id, texto=s.texto, tipo=s.tipo, acao=s.acao, prazo=s.prazo, origem=origem, trecho=trecho)


def _ordenar(disparados: list[SinalDisparado]) -> list[SinalDisparado]:
    return sorted(disparados, key=lambda d: _ORDEM_TIPO[d.tipo])  # estável: dentro do tipo, a ordem de chegada


def sinais_respondidos(entrada: EntradaConsulta, lista: list[SinalAlerta]) -> list[SinalDisparado]:
    por_id = {s.id: s for s in lista}
    return _ordenar(
        [_disparado(por_id[r.id], "respondido", None) for r in entrada.sinais if r.resposta == "sim" and r.id in por_id]
    )


def _textos_da_entrada(entrada: EntradaConsulta) -> list[str]:
    exame = [v for v in entrada.exame.model_dump().values() if v]
    return [f.texto for f in entrada.falas] + exame


def motor_sinais(
    provedor: ProvedorIA,
    entrada: EntradaConsulta,
    lista: list[SinalAlerta],
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
) -> SinaisConsulta:
    disparados = sinais_respondidos(entrada, lista)
    prompt = carregar_prompt("dermatologia", "sinais")
    pedido = PedidoIA(
        motor="sinais",
        versao_prompt=prompt.versao,
        instrucoes=prompt.texto,
        dados={
            "consulta": entrada.model_dump(by_alias=True, mode="json"),
            "lista": [{"id": s.id, "texto": s.texto, "porque": s.porque} for s in lista],
        },
        esforco="low",
    )
    try:
        proposta = chamar_motor(provedor, pedido, SinaisIA, VERSAO_ESQUEMA_SINAIS, relogio, registrar, termos_proibidos)
    except ErroPrivacidade as erro:
        # a regra fixa não depende da IA: a lista respondida continua valendo
        aviso = f"pedido à IA bloqueado por privacidade ({erro}); só a lista respondida foi checada"
        return SinaisConsulta(disparados=disparados, conflitos=[], extras_ia=[], avisos=[aviso], ia_falhou=True)
    if proposta.resultado is None:
        aviso = "IA dos sinais falhou; só a lista respondida foi checada"
        return SinaisConsulta(disparados=disparados, conflitos=[], extras_ia=[], avisos=[aviso], ia_falhou=True)

    por_id = {s.id: s for s in lista}
    negados = {r.id for r in entrada.sinais if r.resposta == "nao"}
    ja = {d.id for d in disparados}
    textos = _textos_da_entrada(entrada)
    avisos: list[str] = []
    conflitos: list[SinalDisparado] = []
    for d in proposta.resultado.detectados:
        if d.id in ja:
            continue
        if d.id not in por_id:
            avisos.append(f"IA citou sinal fora da lista: {d.id!r} ({d.trecho!r})")
        elif not d.trecho.strip() or not any(d.trecho.strip() in t for t in textos):
            avisos.append(f"IA citou {d.id!r} sem trecho da consulta ({d.trecho!r}); conferir")
        elif d.id in negados:
            avisos.append(f"{d.id!r} foi respondido não pelo médico, mas a IA encontrou: {d.trecho!r}; conferir")
            if d.id not in {c.id for c in conflitos}:
                conflitos.append(_disparado(por_id[d.id], "ia", d.trecho.strip()))
        else:
            disparados.append(_disparado(por_id[d.id], "ia", d.trecho.strip()))
            ja.add(d.id)
    return SinaisConsulta(
        disparados=_ordenar(disparados),
        conflitos=_ordenar(conflitos),
        extras_ia=proposta.resultado.extras,
        avisos=avisos,
        ia_falhou=False,
    )
