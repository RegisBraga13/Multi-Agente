"""Esquema enviado à saída estruturada do modelo: o envelope {"resultado": <esquema do motor>, "meta": MetaProposta}.

A saída estruturada aceita só um subconjunto do JSON Schema. Por isso o esquema vai simplificado: referências
resolvidas em linha, todo objeto fechado e com todos os campos obrigatórios, e sem restrições de valor
(mínimo/máximo, tamanho, padrão). As restrições continuam valendo: a chamada de motor valida a resposta com o
Pydantic, em modo estrito, antes de qualquer uso (app/motores/chamada.py).
"""

from typing import Any

from pydantic import BaseModel

from app.contratos.motor import MetaProposta

_RETIRAR = {
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "default",
    "title",
}


def _simplificar(no: Any, defs: dict[str, Any]) -> Any:
    if isinstance(no, list):
        return [_simplificar(x, defs) for x in no]
    if not isinstance(no, dict):
        return no
    if "$ref" in no:
        return _simplificar(defs[no["$ref"].rsplit("/", 1)[-1]], defs)
    saida = {k: _simplificar(v, defs) for k, v in no.items() if k not in _RETIRAR and k != "$defs"}
    if saida.get("type") == "object" and "properties" in saida:
        saida["additionalProperties"] = False
        saida["required"] = list(saida["properties"])
    return saida


def _esquema(modelo: type[BaseModel]) -> dict[str, Any]:
    bruto = modelo.model_json_schema(by_alias=True)
    resultado: dict[str, Any] = _simplificar(bruto, bruto.get("$defs", {}))
    return resultado


def esquema_envelope(esquema: type[BaseModel]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {"resultado": _esquema(esquema), "meta": _esquema(MetaProposta)},
        "required": ["resultado", "meta"],
        "additionalProperties": False,
    }
