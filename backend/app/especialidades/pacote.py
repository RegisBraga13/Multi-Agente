"""Pacote da especialidade: os dados que mudam de uma especialidade para outra (nunca código copiado).

Hoje: a lista fixa de sinais de alerta. Sinal de alerta nunca depende só da IA (desenho §7.3): a lista
fixa é sempre checada; a IA pode sugerir extras, marcados como sugestão.

Cada sinal tem tipo, ação e prazo. A ação de um sinal de `urgencia_imediata` é a resposta de emergência FIXA
(revisada pelo autor): quando o sinal dispara, ela entra na conduta por regra, sem depender da IA e mesmo sem
protocolo na tabela (decisão do autor, 18/11/2026).
"""

from collections import Counter
from datetime import date
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

PASTA_ESPECIALIDADES = Path(__file__).parent


class PacoteInvalido(Exception):
    pass


class _Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


TipoSinal = Literal["urgencia_imediata", "prioridade", "muda_tratamento"]
Prazo = Literal["imediato", "em dias", "em semanas", "antes de prescrever"]


class SinalAlerta(_Modelo):
    """`tipo`: urgência imediata (risco de vida/órgão), prioridade (ex. suspeita de câncer) ou muda o tratamento
    (ex. gravidez). `acao`: o que fazer, item a item. `prazo`: em quanto tempo."""

    id: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    texto: str = Field(min_length=1)
    porque: str = Field(min_length=1)
    tipo: TipoSinal
    acao: list[str] = Field(min_length=1)
    prazo: Prazo


class _Revisao(_Modelo):
    situacao: Literal["pendente", "aprovado", "corrigir"]
    nota: str = ""
    em: date | None = None


class _ArquivoSinais(_Modelo):
    revisao: _Revisao
    sinais: list[SinalAlerta] = Field(min_length=1)


def carregar_sinais(especialidade: str, raiz: Path = PASTA_ESPECIALIDADES) -> list[SinalAlerta]:
    caminho = raiz / especialidade / "sinais_alerta.yaml"
    if not caminho.is_file():
        raise PacoteInvalido(f"lista de sinais de alerta não encontrada: {caminho}")
    try:
        arquivo = _ArquivoSinais.model_validate(yaml.safe_load(caminho.read_text(encoding="utf-8")))
    except (yaml.YAMLError, ValidationError) as erro:
        raise PacoteInvalido(f"{caminho.name}: {erro}") from erro
    if repetidos := [i for i, n in Counter(s.id for s in arquivo.sinais).items() if n > 1]:
        raise PacoteInvalido(f"{caminho.name}: id repetido: {', '.join(repetidos)}")
    return arquivo.sinais
