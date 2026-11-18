from typing import Any, Literal

import pytest
from pydantic import BaseModel, Field

from app.contratos.base import ModeloApi
from app.motores.conduta import CondutaIA
from app.motores.diagnosticos import DiagnosticosIA
from app.motores.historia import HistoriaClinica
from app.motores.sinais import SinaisIA
from app.provedores.esquema_saida import esquema_envelope
from casos_de_teste.avaliadora import AvaliacaoIA

PROIBIDAS = {
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "$ref",
    "$defs",
    "default",
    "title",
}


class Item(ModeloApi):
    nome_dcb: str = Field(min_length=1, pattern=r"^\w")
    lado: Literal["favor", "contra"]


class Exemplo(ModeloApi):
    pct: int = Field(ge=1, le=99)
    itens: list[Item] = Field(min_length=1, max_length=6)
    extra: Item | None
    nota: str = "x"


ESQUEMAS: list[type[BaseModel]] = [
    Exemplo,
    HistoriaClinica,
    SinaisIA,
    DiagnosticosIA,
    CondutaIA,
    AvaliacaoIA,
]


def chaves(x: Any) -> set[str]:
    if isinstance(x, dict):
        return set(x) | {k for v in x.values() for k in chaves(v)}
    if isinstance(x, list):
        return {k for v in x for k in chaves(v)}
    return set()


def objetos(x: Any) -> list[dict]:
    achados = []
    if isinstance(x, dict):
        if x.get("type") == "object":
            achados.append(x)
        for v in x.values():
            achados += objetos(v)
    elif isinstance(x, list):
        for v in x:
            achados += objetos(v)
    return achados


@pytest.mark.parametrize("esquema", ESQUEMAS)
def test_esquema_de_todos_os_motores_e_aceito(esquema):
    s = esquema_envelope(esquema)
    assert not PROIBIDAS & chaves(s)
    for o in objetos(s):
        assert o["additionalProperties"] is False
        assert sorted(o["required"]) == sorted(o["properties"])


def test_envelope_tem_resultado_e_meta_em_camel_case():
    s = esquema_envelope(Exemplo)
    assert s["required"] == ["resultado", "meta"]
    assert "nomeDcb" in s["properties"]["resultado"]["properties"]["itens"]["items"]["properties"]
    assert set(s["properties"]["meta"]["properties"]) == {"confianca", "evidencias", "avisos", "origem"}


def test_opcional_vira_any_of_com_null():
    extra = esquema_envelope(Exemplo)["properties"]["resultado"]["properties"]["extra"]
    assert {"type": "null"} in extra["anyOf"]
