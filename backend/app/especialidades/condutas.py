"""Tabela de condutas do pacote da especialidade (desenho §6 e §7.3): lida por chave, sem IA.

Cada protocolo é um YAML em `especialidades/<especialidade>/condutas/`: grupos (os 4 de sempre), opções com os
itens de receita estruturados, regras de ordem ligadas aos sinais de alerta e contraindicações por sinal.

Também aqui, por regra fixa (decisão do autor, 18/11/2026): a urgência da conduta e a ação de emergência dos
sinais de urgência imediata — nunca dependem da IA, mesmo sem protocolo.
"""

from collections import Counter
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, ValidationError

from app.contratos.base import ModeloApi
from app.contratos.prontuario import ItemReceita
from app.especialidades.pacote import PASTA_ESPECIALIDADES, PacoteInvalido, _Revisao, carregar_sinais
from app.motores.sinais import SinalDisparado

Urgencia = Literal["rotina", "prioritaria", "imediata"]
GrupoId = Literal["cuidados", "topico", "sistemico", "orientacoes"]


class _Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OpcaoConduta(_Modelo):
    id: str
    rotulo: str
    texto: str
    dias: int | None = None
    receita: list[ItemReceita] = []


class LinhaConduta(_Modelo):
    id: str
    rotulo: str | None
    opcoes: list[OpcaoConduta]
    prefixo: str | None = None
    multipla: bool = False


class GrupoConduta(_Modelo):
    id: GrupoId
    rotulo: str
    linhas: list[LinhaConduta]
    fixo: str | None = None


class RegraOrdem(_Modelo):
    sinal: str
    linha: str
    opcoes: list[str]


class Contraindicacao(_Modelo):
    sinal: str
    opcoes: list[str]
    motivo: str


class Protocolo(_Modelo):
    chave: str
    versao: int
    cids: list[str]
    revisao: _Revisao
    grupos: list[GrupoConduta]
    regras: list[RegraOrdem]
    contraindicacoes: list[Contraindicacao]


class OpcaoBloqueada(ModeloApi):
    opcao: str
    motivo: str


class PropostaTabela(ModeloApi):
    chave: str
    origem: str
    grupos: list[GrupoConduta]
    bloqueadas: list[OpcaoBloqueada]
    motivos_ordem: dict[str, str]


def _conferir(p: Protocolo, sinais: set[str]) -> list[str]:
    linhas = {linha.id: {o.id for o in linha.opcoes} for g in p.grupos for linha in g.linhas}
    todas = {o for opcoes in linhas.values() for o in opcoes}
    citados = [r.sinal for r in p.regras] + [c.sinal for c in p.contraindicacoes]
    erros = [f"sinal inexistente na lista: {s!r}" for s in citados if s not in sinais]
    erros += [f"linha inexistente: {r.linha!r}" for r in p.regras if r.linha not in linhas]
    erros += [f"opção inexistente: {o!r}" for r in p.regras for o in r.opcoes if o not in linhas.get(r.linha, set())]
    erros += [f"opção inexistente: {o!r}" for c in p.contraindicacoes for o in c.opcoes if o not in todas]
    return erros


def carregar_protocolos(especialidade: str, raiz: Path = PASTA_ESPECIALIDADES) -> dict[str, Protocolo]:
    sinais = {s.id for s in carregar_sinais(especialidade, raiz)}
    protocolos: dict[str, Protocolo] = {}
    for caminho in sorted((raiz / especialidade / "condutas").glob("*.yaml")):
        try:
            p = Protocolo.model_validate(yaml.safe_load(caminho.read_text(encoding="utf-8")))
        except (yaml.YAMLError, ValidationError) as erro:
            raise PacoteInvalido(f"{caminho.name}: {erro}") from erro
        if erros := _conferir(p, sinais):
            raise PacoteInvalido(f"{caminho.name}: {'; '.join(erros)}")
        if p.chave in protocolos:
            raise PacoteInvalido(f"{caminho.name}: chave repetida {p.chave!r}")
        protocolos[p.chave] = p
    if repetidos := [c for c, n in Counter(c for p in protocolos.values() for c in p.cids).items() if n > 1]:
        raise PacoteInvalido(f"CID em mais de um protocolo: {', '.join(repetidos)}")
    return protocolos


def protocolo_do_cid(protocolos: dict[str, Protocolo], cid: str) -> Protocolo | None:
    return next((p for p in protocolos.values() if cid in p.cids), None)


def aplicar_protocolo(p: Protocolo, sinais: list[SinalDisparado]) -> PropostaTabela:
    """Tira as opções contraindicadas pelos sinais (com o motivo) e põe primeiro as das regras."""
    ids = {s.id for s in sinais}
    motivo_bloqueio = {o: c.motivo for c in p.contraindicacoes if c.sinal in ids for o in c.opcoes}
    primeiro: dict[str, list[str]] = {}
    motivos_ordem: dict[str, str] = {}
    for r in p.regras:
        if r.sinal in ids:
            primeiro[r.linha] = r.opcoes
            motivos_ordem[r.linha] = r.sinal

    def linha(lin: LinhaConduta) -> LinhaConduta:
        livres = [o for o in lin.opcoes if o.id not in motivo_bloqueio]
        p1 = primeiro.get(lin.id, [])
        return lin.model_copy(
            update={"opcoes": [o for o in livres if o.id in p1] + [o for o in livres if o.id not in p1]}
        )

    grupos = [g.model_copy(update={"linhas": [linha(lin) for lin in g.linhas]}) for g in p.grupos]
    presentes = {o.id for g in p.grupos for lin in g.linhas for o in lin.opcoes}
    bloqueadas = [OpcaoBloqueada(opcao=o, motivo=m) for o, m in motivo_bloqueio.items() if o in presentes]
    return PropostaTabela(
        chave=p.chave,
        origem=f"protocolo {p.chave} v{p.versao}",
        grupos=grupos,
        bloqueadas=bloqueadas,
        motivos_ordem=motivos_ordem,
    )


def urgencia_por_sinais(sinais: list[SinalDisparado]) -> Urgencia:
    tipos = {s.tipo for s in sinais}
    if "urgencia_imediata" in tipos:
        return "imediata"
    if "prioridade" in tipos:
        return "prioritaria"
    return "rotina"


def emergencia_por_sinais(sinais: list[SinalDisparado]) -> list[str]:
    acoes: list[str] = []
    for s in sinais:
        if s.tipo == "urgencia_imediata":
            acoes += [a for a in s.acao if a not in acoes]
    return acoes
