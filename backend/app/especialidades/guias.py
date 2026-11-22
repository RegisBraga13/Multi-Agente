"""Guias por queixa: o que costuma valer a pena perguntar diante de cada tipo de queixa da especialidade.

Cada guia é `especialidades/<especialidade>/guias/<id>.md`: duas linhas de cabeçalho (`titulo:` e `situacao:`) e o texto.
São apoio para a IA escrever perguntas no contexto do paciente, nunca uma lista obrigatória. O conteúdo clínico é do
médico: guia `pendente` ainda não foi revisado por ele.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.especialidades.pacote import PASTA_ESPECIALIDADES, PacoteInvalido

SITUACOES = ("pendente", "aprovado")


@dataclass(frozen=True)
class Guia:
    id: str
    titulo: str
    situacao: Literal["pendente", "aprovado"]
    texto: str


def _cabecalho(linha: str, chave: str, arquivo: Path) -> str:
    nome, _, valor = linha.partition(":")
    if nome.strip() != chave or not valor.strip():
        raise PacoteInvalido(f"{arquivo.name}: a linha tem de ser '{chave}: <valor>'")
    return valor.strip()


def _guia(arquivo: Path) -> Guia:
    primeira, _, resto = arquivo.read_text(encoding="utf-8").partition("\n")
    segunda, _, texto = resto.partition("\n")
    titulo = _cabecalho(primeira, "titulo", arquivo)
    situacao = _cabecalho(segunda, "situacao", arquivo)
    if situacao not in SITUACOES:
        raise PacoteInvalido(f"{arquivo.name}: situacao tem de ser {' ou '.join(SITUACOES)}")
    if not texto.strip():
        raise PacoteInvalido(f"{arquivo.name}: o guia está sem texto")
    return Guia(id=arquivo.stem, titulo=titulo, situacao=situacao, texto=texto.strip())  # type: ignore[arg-type]


def carregar_guias(especialidade: str, raiz: Path = PASTA_ESPECIALIDADES) -> list[Guia]:
    pasta = raiz / especialidade / "guias"
    if not pasta.is_dir():
        return []
    return [_guia(a) for a in sorted(pasta.glob("*.md"))]
