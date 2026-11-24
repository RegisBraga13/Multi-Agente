"""Registro do retorno: só o que mudou desde a consulta de origem (regra 14.8).

HD: assinalado que já estava na origem → "Confirmado" (sem %); assinalado novo → "Nova hipótese" (com %);
sugeridos não entram; nada → "Vide consulta N". Conduta: iniciado, suspenso, ajustado; nada → "Mantida".
Orientações: só as novas. Os dados completos da entrada continuam guardados; isto é o que o registro mostra.
"""

import re

from app.contratos.prontuario import (
    ComparacaoRetorno,
    DadosEntrada,
    DiagnosticoRegistro,
    ItemReceita,
    MudancaConduta,
)

_FRASES = re.compile(r"(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])")


def _frases(texto: str) -> list[str]:
    return [f.strip() for f in _FRASES.split(texto) if f.strip()]


def _chave(d: DiagnosticoRegistro) -> str:
    return d.cid or d.nome.casefold()


def _diagnosticos(
    hoje: list[DiagnosticoRegistro], antes: list[DiagnosticoRegistro]
) -> tuple[list[DiagnosticoRegistro], list[DiagnosticoRegistro]]:
    anteriores = {_chave(d) for d in antes if d.situacao == "assinalado"}
    assinalados = [d for d in hoje if d.situacao == "assinalado"]
    confirmados = [d.model_copy(update={"pct": None}) for d in assinalados if _chave(d) in anteriores]
    novas = [d for d in assinalados if _chave(d) not in anteriores]
    return confirmados, novas


def _remedio(x: ItemReceita) -> str:
    """ "Limeciclina 300mg CAP — Tomar 1 CAP VO, 1 vez ao dia — 8sem" """
    nome = " ".join(p for p in (x.nome, x.concentracao, x.forma) if p)
    return f"{nome} — {x.posologia.rstrip('.')} — {x.duracao}"


def _ajuste(a: ItemReceita, b: ItemReceita) -> str | None:
    """O que mudou no mesmo remédio: "Adapaleno: 0,1% → 0,3%; 8sem → 12sem"; None se nada."""
    campos = ("concentracao", "forma", "posologia", "duracao")
    mudou = [
        f"{getattr(a, c).rstrip('.')} → {getattr(b, c).rstrip('.')}" for c in campos if getattr(a, c) != getattr(b, c)
    ]
    return f"{b.nome}: {'; '.join(mudou)}" if mudou else None


def _conduta(hoje: DadosEntrada, antes: DadosEntrada) -> list[MudancaConduta]:
    if hoje.receita is None and antes.receita is None:
        if hoje.conduta_texto.strip() == antes.conduta_texto.strip():
            return []
        return [MudancaConduta(tipo="ajustado", texto=hoje.conduta_texto.strip())]
    itens_h = {x.nome.casefold(): x for x in (hoje.receita.itens if hoje.receita else [])}
    itens_a = {x.nome.casefold(): x for x in (antes.receita.itens if antes.receita else [])}
    livres_h = hoje.receita.livres if hoje.receita else []
    livres_a = antes.receita.livres if antes.receita else []
    saida = [MudancaConduta(tipo="iniciado", texto=_remedio(x)) for k, x in itens_h.items() if k not in itens_a]
    saida += [MudancaConduta(tipo="iniciado", texto=t) for t in livres_h if t not in livres_a]
    saida += [MudancaConduta(tipo="suspenso", texto=x.nome) for k, x in itens_a.items() if k not in itens_h]
    saida += [MudancaConduta(tipo="suspenso", texto=t) for t in livres_a if t not in livres_h]
    for k, x in itens_h.items():
        if k in itens_a and (texto := _ajuste(itens_a[k], x)):
            saida.append(MudancaConduta(tipo="ajustado", texto=texto))
    return saida


def comparar_com_origem(hoje: DadosEntrada, antes: DadosEntrada, referencia: str) -> ComparacaoRetorno:
    confirmados, novas = _diagnosticos(hoje.diagnosticos, antes.diagnosticos)
    ja_ditas = set(_frases(antes.orientacoes))
    return ComparacaoRetorno(
        referencia=referencia,
        confirmados=confirmados,
        novas_hipoteses=novas,
        conduta=_conduta(hoje, antes),
        orientacoes=" ".join(f for f in _frases(hoje.orientacoes) if f not in ja_ditas),
    )
