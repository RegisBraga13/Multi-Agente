"""Carrega e valida os casos de teste de uma pasta.

Além do formato (formato.py), confere o que um caso sozinho não sabe: id igual ao nome do arquivo e único,
sinais de alerta existentes na lista fixa da especialidade e nenhum dado de identidade no texto.
Um arquivo ruim não esconde os outros: todos os erros aparecem de uma vez.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import yaml
from pydantic import ValidationError
from pydantic_core import ErrorDetails

from app.especialidades.pacote import SinalAlerta
from app.privacidade import encontrar_identidade
from casos_de_teste.formato import Caso

PASTA_CASOS = Path(__file__).parent / "dermatologia"


class CasoInvalido(Exception):
    def __init__(self, caminho: Path, mensagens: list[str]):
        super().__init__(f"{caminho.name}: {'; '.join(mensagens)}")
        self.caminho = caminho
        self.mensagens = mensagens


@dataclass
class Relatorio:
    casos: list[Caso]
    erros: list[str]

    @property
    def ok(self) -> bool:
        return not self.erros


class _SemChaveRepetida(yaml.SafeLoader):
    """SafeLoader que recusa chave repetida (o YAML padrão fica com a última, em silêncio)."""

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> dict[object, object]:
        vistas: set[object] = set()
        for chave_no, _ in node.value:
            chave = self.construct_object(chave_no, deep=deep)
            if chave in vistas:
                raise yaml.constructor.ConstructorError(None, None, f"chave repetida: {chave!r}", chave_no.start_mark)
            vistas.add(chave)
        return super().construct_mapping(node, deep=deep)


def carregar_caso(caminho: Path) -> Caso:
    try:
        dados = yaml.load(caminho.read_text(encoding="utf-8"), Loader=_SemChaveRepetida)
    except yaml.YAMLError as erro:
        raise CasoInvalido(caminho, [f"YAML inválido: {erro}".replace("\n", " ")]) from erro
    try:
        return Caso.model_validate(dados)
    except ValidationError as erro:
        raise CasoInvalido(caminho, [_mensagem(e) for e in erro.errors()]) from erro


def _mensagem(e: ErrorDetails) -> str:
    campo = ".".join(str(p) for p in e["loc"])
    return f"{campo}: {e['msg']}" if campo else e["msg"]


def _textos(x: object) -> Iterator[str]:
    if isinstance(x, str):
        yield x
    elif isinstance(x, dict):
        for v in x.values():
            yield from _textos(v)
    elif isinstance(x, list):
        for v in x:
            yield from _textos(v)


def _conferir(caso: Caso, caminho: Path, sinais: dict[str, SinalAlerta]) -> list[str]:
    erros = []
    if caso.id != caminho.stem:
        erros.append(f"id {caso.id!r} diferente do nome do arquivo")
    disparados = caso.esperado.sinais.disparados
    citados = [s.sinal for s in caso.entrada.sinais] + disparados
    erros += [f"sinal de alerta inexistente na lista: {s!r}" for s in citados if s not in sinais]
    negados = {s.sinal for s in caso.entrada.sinais if s.resposta == "f"}
    erros += [
        f"sinal {s!r} foi negado na consulta e não pode ser esperado como disparado" for s in disparados if s in negados
    ]
    imediatos = [s for s in disparados if s in sinais and sinais[s].tipo == "urgencia_imediata"]
    if imediatos and caso.esperado.conduta.urgencia != "imediata":
        erros.append(f"sinal de urgência imediata ({', '.join(imediatos)}) exige conduta com urgência imediata")
    for texto in _textos(caso.model_dump(mode="json")):
        erros += [f"dado de identidade ({tipo}) no texto: {texto!r}" for tipo in encontrar_identidade(texto)]
    return erros


def validar_pasta(pasta: Path, sinais: list[SinalAlerta]) -> Relatorio:
    por_id = {s.id: s for s in sinais}
    arquivos = sorted(pasta.glob("*.yaml"))
    if not arquivos:
        return Relatorio(casos=[], erros=["nenhum caso encontrado"])
    casos: list[Caso] = []
    erros: list[str] = []
    vistos: dict[str, str] = {}
    for caminho in arquivos:
        try:
            caso = carregar_caso(caminho)
        except CasoInvalido as erro:
            erros += [f"{caminho.name}: {m}" for m in erro.mensagens]
            continue
        problemas = _conferir(caso, caminho, por_id)
        if caso.id in vistos:
            problemas.append(f"id {caso.id!r} repetido (já usado em {vistos[caso.id]})")
        vistos.setdefault(caso.id, caminho.name)
        erros += [f"{caminho.name}: {p}" for p in problemas]
        if not problemas:
            casos.append(caso)
    return Relatorio(casos=casos, erros=erros)
