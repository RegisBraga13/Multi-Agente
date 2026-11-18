"""IA avaliadora dos casos de teste (ADR 0002): confere cada critério clínico pelo sentido, nunca por palavra.

Saída tipada por critério: cumprido / violado / dúvida, com o trecho que justifica. Regras depois da IA:
afirmar que o texto TEM algo (cumprido em fato, negativa, sem resposta, obrigatório; violado em proibido e
desconhecido) exige trecho copiado do texto — sem ele, vira dúvida para o autor conferir. A própria avaliadora
é medida com pares de calibração revisados pelo autor (`calibracao_avaliadora.yaml`).
"""

from collections.abc import Callable
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict

from app.contratos.base import ModeloApi
from app.contratos.motor import RegistroDecisao
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import chamar_motor
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_AVALIADORA = 1
ARQUIVO_CALIBRACAO = Path(__file__).parent / "calibracao_avaliadora.yaml"

TipoCriterio = Literal["fato", "negativa", "sem_resposta", "desconhecido", "obrigatorio", "proibido"]
Resultado = Literal["cumprido", "violado", "duvida"]
# em que veredito a avaliadora afirma que o texto contém algo (e por isso precisa citar o trecho)
_PRECISA_TRECHO: dict[str, str] = {
    "fato": "cumprido",
    "negativa": "cumprido",
    "sem_resposta": "cumprido",
    "obrigatorio": "cumprido",
    "proibido": "violado",
    "desconhecido": "violado",
}


class Criterio(ModeloApi):
    n: int
    tipo: TipoCriterio
    texto: str


class Veredito(ModeloApi):
    n: int
    veredito: Resultado
    trecho: str | None
    justificativa: str


class AvaliacaoIA(ModeloApi):
    vereditos: list[Veredito]


def avaliar(
    provedor: ProvedorIA,
    texto: str,
    criterios: list[Criterio],
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
) -> list[Veredito]:
    if not criterios:
        return []
    prompt = carregar_prompt("dermatologia", "avaliadora")
    pedido = PedidoIA(
        motor="avaliadora",
        versao_prompt=prompt.versao,
        instrucoes=prompt.texto,
        dados={"texto": texto, "criterios": [c.model_dump(by_alias=True) for c in criterios]},
        esforco="medium",
    )
    proposta = chamar_motor(provedor, pedido, AvaliacaoIA, VERSAO_ESQUEMA_AVALIADORA, relogio, registrar)
    respostas: dict[int, list[Veredito]] = {}
    for v in proposta.resultado.vereditos if proposta.resultado else []:
        respostas.setdefault(v.n, []).append(v)

    saida = []
    for c in criterios:
        vs = respostas.get(c.n, [])
        if len(vs) != 1:
            saida.append(Veredito(n=c.n, veredito="duvida", trecho=None, justificativa="avaliadora não respondeu"))
            continue
        v = vs[0]
        if v.veredito == _PRECISA_TRECHO[c.tipo] and not (v.trecho and v.trecho.strip() and v.trecho.strip() in texto):
            v = v.model_copy(update={"veredito": "duvida", "justificativa": f"sem trecho do texto: {v.justificativa}"})
        saida.append(v)
    return saida


class _Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _CriterioYaml(_Modelo):
    tipo: TipoCriterio
    texto: str


class ParCalibracao(_Modelo):
    """Um texto, um critério e o veredito que o autor espera."""

    texto: str
    criterio: _CriterioYaml
    esperado: Literal["cumprido", "violado"]
    porque: str


class _ArquivoCalibracao(_Modelo):
    revisao: dict[str, object]
    pares: list[ParCalibracao]


def carregar_calibracao(caminho: Path = ARQUIVO_CALIBRACAO) -> list[ParCalibracao]:
    return _ArquivoCalibracao.model_validate(yaml.safe_load(caminho.read_text(encoding="utf-8"))).pares


def calibrar(provedor: ProvedorIA, relogio: Relogio) -> tuple[int, int, list[str]]:
    """(acertos, total, discordâncias) da avaliadora nos pares de calibração."""
    pares = carregar_calibracao()
    acertos, discordancias = 0, []
    for i, par in enumerate(pares, 1):
        [v] = avaliar(provedor, par.texto, [Criterio(n=1, **par.criterio.model_dump())], relogio, lambda r: None)
        if v.veredito == par.esperado:
            acertos += 1
        else:
            discordancias.append(
                f"par {i} ({par.criterio.tipo}: {par.criterio.texto}): esperado {par.esperado}, "
                f"avaliadora {v.veredito} — {v.justificativa}"
            )
    return acertos, len(pares), discordancias
