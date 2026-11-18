"""Prompts versionados no repositório, por especialidade (desenho §2.3 e §7.1).

Cada prompt é `especialidades/<especialidade>/prompts/<motor>.md`; a primeira linha é `versao: <motor>-<esp>-N`.
Mudou o texto, sobe a versão: a versão vai no registro de cada decisão e no relatório da medição.
"""

from dataclasses import dataclass
from pathlib import Path

from app.especialidades.pacote import PASTA_ESPECIALIDADES, PacoteInvalido


@dataclass(frozen=True)
class Prompt:
    versao: str
    texto: str


def carregar_prompt(especialidade: str, motor: str, raiz: Path = PASTA_ESPECIALIDADES) -> Prompt:
    caminho = raiz / especialidade / "prompts" / f"{motor}.md"
    if not caminho.is_file():
        raise PacoteInvalido(f"prompt não encontrado: {caminho}")
    primeira, _, resto = caminho.read_text(encoding="utf-8").partition("\n")
    chave, _, versao = primeira.partition(":")
    if chave.strip() != "versao" or not versao.strip():
        raise PacoteInvalido(f"{caminho.name}: a primeira linha tem de ser 'versao: <motor>-<especialidade>-N'")
    return Prompt(versao=versao.strip(), texto=resto.strip())
