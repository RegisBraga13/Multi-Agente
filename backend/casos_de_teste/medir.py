"""Mede os motores nos casos de teste aprovados (desenho §7.8, ADR 0002): IA avaliadora + regras, custo e tempo.

Cada caso roda como uma consulta com um "médico simulado": sinais → história (aceita como veio) → diagnósticos
sobre a história da IA → conduta com o diagnóstico ESPERADO confirmado (o médico corrige o DD; assim um erro do
DD não contamina a medida da conduta). Um caso que quebra não para os outros.
"""

import re
import time
import unicodedata
from collections.abc import Callable
from datetime import datetime
from typing import Literal

from app.contratos.base import ModeloApi
from app.contratos.motor import RegistroDecisao
from app.especialidades.condutas import Protocolo
from app.especialidades.pacote import SinalAlerta
from app.especialidades.prompts import carregar_prompt
from app.motores.conduta import DiagnosticoConfirmado, motor_conduta, remedios_da_conduta, texto_da_conduta
from app.motores.diagnosticos import DiagnosticosIA, HipoteseIA, motor_diagnosticos, seguranca_de
from app.motores.historia import HistoriaClinica, motor_historia
from app.motores.sinais import motor_sinais
from app.provedores.ia import ProvedorIA
from app.provedores.relogio import Relogio
from casos_de_teste.avaliadora import Criterio, TipoCriterio, avaliar_detalhado
from casos_de_teste.entrada import entrada_do_caso
from casos_de_teste.formato import Caso, Diagnostico

Etapa = Literal["historia", "diagnosticos", "sinais", "conduta"]
ResultadoTipo = Literal["passou", "falhou", "duvida"]
PRECO_USD_POR_MILHAO: dict[str, tuple[float, float]] = {"claude-opus-5-5": (4.0, 20.0)}
MOTORES = ["historia", "sinais", "diagnosticos", "conduta", "avaliadora"]
SECOES = {
    "qp": "QP",
    "hda": "HDA",
    "ap": "AP",
    "hp": "HP",
    "hf": "HF",
    "exame_fisico": "Exame físico",
    "exames_texto": "Exames",
}


class ResultadoCriterio(ModeloApi):
    etapa: Etapa
    criterio: str
    como: Literal["avaliadora", "regra"]
    resultado: ResultadoTipo
    trecho: str | None
    nota: str


class ResultadoCaso(ModeloApi):
    id: str
    criterios: list[ResultadoCriterio]
    rejeitados: list[str]
    notas: list[str]
    principal_entre_3: bool
    conduta_da_tabela: bool
    tokens_entrada: int
    tokens_saida: int
    custo_usd: float
    modelos: list[str]
    segundos: float
    erro: str | None


class RelatorioMedicao(ModeloApi):
    """`falso`: rodada de demonstração (provedor falso) — nada clínico foi medido."""

    quando: datetime
    falso: bool
    modelo: str
    versoes_prompt: dict[str, str]
    casos: list[ResultadoCaso]
    resumo: dict[str, float]


def custo_usd(registros: list[RegistroDecisao]) -> tuple[float, list[str]]:
    custo, notas = 0.0, []
    for r in registros:
        preco = PRECO_USD_POR_MILHAO.get(r.modelo)
        if preco is None:
            if f"preço desconhecido: {r.modelo}" not in notas:
                notas.append(f"preço desconhecido: {r.modelo}")
            continue
        custo += (r.tokens_entrada * preco[0] + r.tokens_saida * preco[1]) / 1_000_000
    return custo, notas


def _normalizar(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c)).casefold()


def _contem_palavra(texto: str, palavra: str) -> bool:
    return re.search(rf"\b{re.escape(_normalizar(palavra))}\b", _normalizar(texto)) is not None


def _regra(etapa: Etapa, criterio: str, ok: bool | None, nota: str = "") -> ResultadoCriterio:
    resultado: ResultadoTipo = "duvida" if ok is None else "passou" if ok else "falhou"
    return ResultadoCriterio(etapa=etapa, criterio=criterio, como="regra", resultado=resultado, trecho=None, nota=nota)


_DO_VEREDITO: dict[str, ResultadoTipo] = {"cumprido": "passou", "violado": "falhou", "duvida": "duvida"}


def _pela_avaliadora(
    etapa: Etapa,
    provedor: ProvedorIA,
    texto: str,
    itens: list[tuple[TipoCriterio, str]],
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    rejeitados: list[str],
) -> list[ResultadoCriterio]:
    criterios = [Criterio(n=i, tipo=t, texto=x) for i, (t, x) in enumerate(itens, 1)]
    vereditos, rejeitada = avaliar_detalhado(provedor, texto, criterios, relogio, registrar)
    if rejeitada and "avaliadora" not in rejeitados:
        rejeitados.append("avaliadora")
    return [
        ResultadoCriterio(
            etapa=etapa,
            criterio=f"{c.tipo}: {c.texto}",
            como="avaliadora",
            resultado=_DO_VEREDITO[v.veredito],
            trecho=v.trecho,
            nota=v.justificativa,
        )
        for c, v in zip(criterios, vereditos, strict=True)
    ]


def _falhou_tudo(etapa: Etapa, itens: list[str], nota: str) -> list[ResultadoCriterio]:
    return [_regra(etapa, x, False, nota) for x in itens]


def _casa_cid(esperados: list[Diagnostico], hipoteses: list[tuple[str, str]]) -> tuple[bool | None, int | None]:
    """(True, índice) CID igual; (None, índice) mesma categoria (3 primeiros caracteres); (False, None) nenhum."""
    cids = {d.cid for d in esperados}
    for i, (_, cid) in enumerate(hipoteses):
        if cid in cids:
            return True, i
    for i, (_, cid) in enumerate(hipoteses):
        if cid[:3] in {c[:3] for c in cids}:
            return None, i
    return False, None


def _criterios_historia(
    caso: Caso,
    h: HistoriaClinica,
    provedor: ProvedorIA,
    relogio: Relogio,
    reg: Callable[[RegistroDecisao], None],
    rejeitados: list[str],
) -> list[ResultadoCriterio]:
    e = caso.esperado.historia
    texto = "\n".join(f"{rotulo}: {getattr(h, chave)}" for chave, rotulo in SECOES.items())
    itens: list[tuple[TipoCriterio, str]] = (
        [("fato", x) for x in e.fatos]
        + [("negativa", x) for x in e.negativas]
        + [("sem_resposta", x) for x in e.sem_resposta]
        + [("desconhecido", x) for x in e.desconhecidos]
    )
    resultados = _pela_avaliadora("historia", provedor, texto, itens, relogio, reg, rejeitados)
    for secao in e.vazias:
        chave = "exames_texto" if secao == "exames" else secao
        valor = getattr(h, chave).strip()
        resultados.append(_regra("historia", f"vazia: {secao}", not valor, valor[:80]))
    return resultados


def _criterios_diagnosticos(
    caso: Caso,
    dd: DiagnosticosIA,
    provedor: ProvedorIA,
    relogio: Relogio,
    reg: Callable[[RegistroDecisao], None],
    rejeitados: list[str],
) -> tuple[list[ResultadoCriterio], bool]:
    e = caso.esperado.diagnosticos
    top: list[HipoteseIA] = dd.hipoteses[:3]
    pares = [(h.nome, h.cid) for h in top]
    vistos = ", ".join(f"{n} ({c})" for n, c in pares)
    ok, i = _casa_cid([e.principal, *e.aceitos], pares)
    nota = f"3 primeiras: {vistos}" + (" — mesma categoria de CID; o autor confere" if ok is None else "")
    resultados = [_regra("diagnosticos", f"principal entre os 3: {e.principal.nome} ({e.principal.cid})", ok, nota)]
    if i is not None:
        certeza = top[i].certeza
        resultados.append(
            _regra("diagnosticos", f"certeza: {e.principal.certeza}", certeza == e.principal.certeza, certeza)
        )
    else:
        resultados.append(_regra("diagnosticos", f"certeza: {e.principal.certeza}", False, "principal ausente"))
    if e.nao_pode_perder is not None:
        candidatos = pares + ([(dd.nao_pode_perder.nome, dd.nao_pode_perder.cid)] if dd.nao_pode_perder else [])
        ok_npp, _ = _casa_cid([e.nao_pode_perder], candidatos)
        resultados.append(
            _regra("diagnosticos", f"não pode perder: {e.nao_pode_perder.nome} ({e.nao_pode_perder.cid})", ok_npp)
        )
    if e.rastrear:
        texto = "Rastrear: " + "; ".join(dd.rastrear) + "\nHipóteses: " + vistos
        resultados += _pela_avaliadora(
            "diagnosticos", provedor, texto, [("obrigatorio", x) for x in e.rastrear], relogio, reg, rejeitados
        )
    return resultados, ok is True


def _criterios_esperados(caso: Caso) -> dict[Etapa, list[str]]:
    e = caso.esperado
    h, d, c = e.historia, e.diagnosticos, e.conduta
    return {
        "sinais": [f"sinal: {s}" for s in e.sinais.disparados],
        "historia": h.fatos + h.negativas + h.sem_resposta + h.desconhecidos + [f"vazia: {x}" for x in h.vazias],
        "diagnosticos": [f"principal entre os 3: {d.principal.nome}", f"certeza: {d.principal.certeza}"],
        "conduta": [f"protocolo: {c.protocolo}", f"urgência: {c.urgencia}", *c.obrigatorios, *c.proibidos]
        + [f"remédio proibido: {x}" for x in c.remedios_proibidos],
    }


def medir_caso(
    provedor: ProvedorIA, caso: Caso, lista: list[SinalAlerta], protocolos: dict[str, Protocolo], relogio: Relogio
) -> ResultadoCaso:
    registros: list[RegistroDecisao] = []
    criterios: list[ResultadoCriterio] = []
    rejeitados: list[str] = []
    notas: list[str] = []
    principal_ok = da_tabela = False
    erro: str | None = None
    inicio = time.perf_counter()
    reg = registros.append
    try:
        entrada = entrada_do_caso(caso, {s.id: s for s in lista})
        sinais = motor_sinais(provedor, entrada, lista, relogio, reg)
        if sinais.ia_falhou:
            rejeitados.append("sinais")
        pegos = {d.id for d in sinais.disparados}
        esperados = caso.esperado.sinais.disparados
        criterios += [
            _regra("sinais", f"sinal: {s}", s in pegos, "" if s in pegos else "SINAL PERDIDO") for s in esperados
        ]
        notas += [f"sinal a mais (não esperado): {s}" for s in sorted(pegos - set(esperados))]
        notas += [f"CONFLITO: {c.id} respondido não pelo médico, IA encontrou {c.trecho!r}" for c in sinais.conflitos]
        notas += [f"aviso dos sinais: {a}" for a in sinais.avisos]

        hist = motor_historia(provedor, entrada, relogio, reg)
        e = caso.esperado
        if hist.resultado is None:
            rejeitados.append("historia")
            itens_h = e.historia.fatos + e.historia.negativas + e.historia.sem_resposta + e.historia.desconhecidos
            criterios += _falhou_tudo("historia", itens_h, "motor da história rejeitado")
            criterios += _falhou_tudo(
                "diagnosticos", [f"principal entre os 3: {e.diagnosticos.principal.nome}"], "sem história"
            )
        else:
            criterios += _criterios_historia(caso, hist.resultado, provedor, relogio, reg, rejeitados)
            seg = seguranca_de(entrada, sinais)
            dd = motor_diagnosticos(provedor, hist.resultado, seg, relogio, reg)
            if dd.resultado is None:
                rejeitados.append("diagnosticos")
                criterios += _falhou_tudo(
                    "diagnosticos", [f"principal entre os 3: {e.diagnosticos.principal.nome}"], "; ".join(dd.motivos)
                )
            else:
                ddc, principal_ok = _criterios_diagnosticos(caso, dd.resultado, provedor, relogio, reg, rejeitados)
                criterios += ddc

        seg = seguranca_de(entrada, sinais)
        p = e.diagnosticos.principal
        dx = DiagnosticoConfirmado(nome=p.nome, cid=p.cid, certeza=p.certeza)
        conduta = motor_conduta(provedor, dx, seg, protocolos, relogio, reg)
        sem_conduta = conduta.acao == "REJECT"
        if sem_conduta:
            rejeitados.append("conduta")
            criterios.append(_regra("conduta", "conduta produzida", False, "; ".join(conduta.avisos)))
        elif conduta.ia_falhou:
            rejeitados.append("conduta-complemento")
        usada = conduta.tabela.chave if conduta.tabela else None
        da_tabela = usada is not None
        ec = e.conduta
        criterios.append(_regra("conduta", f"protocolo: {ec.protocolo}", usada == ec.protocolo, f"usado: {usada}"))
        criterios.append(
            _regra(
                "conduta", f"urgência: {ec.urgencia}", conduta.urgencia == ec.urgencia, f"proposta: {conduta.urgencia}"
            )
        )
        remedios = remedios_da_conduta(conduta)
        for proibido in ec.remedios_proibidos:
            achados = [r for r in remedios if _contem_palavra(r, proibido)]
            # conduta vazia não "passa" um proibido de graça
            ok = None if sem_conduta else not achados
            nota = "sem conduta para conferir" if sem_conduta else ", ".join(achados)
            criterios.append(_regra("conduta", f"remédio proibido: {proibido}", ok, nota))
        itens_c: list[tuple[TipoCriterio, str]] = [("obrigatorio", x) for x in ec.obrigatorios]
        if sem_conduta:
            criterios += [_regra("conduta", f"proibido: {x}", None, "sem conduta para conferir") for x in ec.proibidos]
        else:
            itens_c += [("proibido", x) for x in ec.proibidos]
        criterios += _pela_avaliadora("conduta", provedor, texto_da_conduta(conduta), itens_c, relogio, reg, rejeitados)
    except Exception as falha:  # um caso que quebra não para os outros
        erro = f"{type(falha).__name__}: {falha}"
        # o que não chegou a ser medido conta como falha (não encolhe o denominador)
        medidas = {c.etapa for c in criterios}
        for etapa, nomes in _criterios_esperados(caso).items():
            if etapa not in medidas:
                criterios += _falhou_tudo(etapa, nomes, f"não medido: {erro}")

    custo, notas_custo = custo_usd(registros)
    return ResultadoCaso(
        id=caso.id,
        criterios=criterios,
        rejeitados=rejeitados,
        notas=notas + notas_custo,
        principal_entre_3=principal_ok,
        conduta_da_tabela=da_tabela,
        tokens_entrada=sum(r.tokens_entrada for r in registros),
        tokens_saida=sum(r.tokens_saida for r in registros),
        custo_usd=round(custo, 4),
        modelos=sorted({r.modelo for r in registros}),
        segundos=round(time.perf_counter() - inicio, 2),
        erro=erro,
    )


def _pct(partes: list[bool]) -> float:
    return round(100 * sum(partes) / len(partes), 1) if partes else 0.0


def resumir(casos: list[ResultadoCaso]) -> dict[str, float]:
    todos = [c for r in casos for c in r.criterios]
    resumo: dict[str, float] = {
        f"{etapa}_pct": _pct([c.resultado == "passou" for c in todos if c.etapa == etapa])
        for etapa in ("historia", "diagnosticos", "sinais", "conduta")
    }
    custo = sum(r.custo_usd for r in casos)
    resumo |= {
        "casos": len(casos),
        "casos_com_erro": sum(r.erro is not None for r in casos),
        "sinais_perdidos": sum(c.etapa == "sinais" and c.resultado == "falhou" for c in todos),
        "principal_entre_3_pct": _pct([r.principal_entre_3 for r in casos]),
        "conduta_da_tabela_pct": _pct([r.conduta_da_tabela for r in casos]),
        "saidas_invalidas": sum(len(r.rejeitados) for r in casos),
        "duvidas": sum(c.resultado == "duvida" for c in todos),
        "custo_total_usd": round(custo, 4),
        "custo_medio_usd": round(custo / len(casos), 4) if casos else 0.0,
        "segundos_medio": round(sum(r.segundos for r in casos) / len(casos), 1) if casos else 0.0,
    }
    return resumo


def medir(
    provedor: ProvedorIA,
    casos: list[Caso],
    lista: list[SinalAlerta],
    protocolos: dict[str, Protocolo],
    relogio: Relogio,
    so_aprovados: bool = True,
    falso: bool = False,
) -> RelatorioMedicao:
    escolhidos = [c for c in casos if c.revisao.situacao == "aprovado" or not so_aprovados]
    resultados = [medir_caso(provedor, c, lista, protocolos, relogio) for c in escolhidos]
    return RelatorioMedicao(
        quando=relogio.agora(),
        falso=falso,
        # o modelo que de fato respondeu (inclui o de fallback, se houve)
        modelo=", ".join(sorted({m for r in resultados for m in r.modelos})) or "—",
        versoes_prompt={m: carregar_prompt("dermatologia", m).versao for m in MOTORES},
        casos=resultados,
        resumo=resumir(resultados),
    )


def texto_do_resumo(r: RelatorioMedicao) -> str:
    s = r.resumo
    sem_preco = sorted({n for c in r.casos for n in c.notas if n.startswith("preço desconhecido")})
    linhas = ["DEMONSTRAÇÃO (provedor falso): nada clínico foi medido"] if r.falso else []
    linhas += [
        f"casos: {int(s['casos'])} (com erro: {int(s['casos_com_erro'])}) · modelo {r.modelo}",
        f"história: {s['historia_pct']}% dos critérios · diagnósticos: {s['diagnosticos_pct']}% · "
        f"conduta: {s['conduta_pct']}%",
        f"sinais perdidos: {int(s['sinais_perdidos'])} (meta: 0) · principal entre os 3: {s['principal_entre_3_pct']}%"
        f" · conduta da tabela: {s['conduta_da_tabela_pct']}%",
        f"saídas inválidas: {int(s['saidas_invalidas'])} · dúvidas da avaliadora: {int(s['duvidas'])}",
        f"custo: US$ {s['custo_total_usd']:.2f} (média US$ {s['custo_medio_usd']:.2f}/caso) · "
        f"tempo médio: {s['segundos_medio']}s/caso",
    ]
    if sem_preco:
        linhas.append(f"custo parcial: modelo sem preço na tabela ({'; '.join(sem_preco)})")
    for c in r.casos:
        linhas += [f"  {c.id}: {n}" for n in c.notas if n.startswith("CONFLITO")]
    for c in r.casos:
        falhas = [x for x in c.criterios if x.resultado != "passou"]
        if c.erro:
            linhas.append(f"  {c.id}: ERRO {c.erro}")
        for x in falhas:
            linhas.append(
                f"  {c.id} · {x.etapa} · {x.resultado.upper()} · {x.criterio}" + (f" — {x.nota}" if x.nota else "")
            )
    return "\n".join(linhas)
