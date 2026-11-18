"""Regras da consulta (Constituição): edição pelo médico, oficialização encadeada e etapas desatualizadas.

- Só o oficializado alimenta a etapa seguinte: oficializar a etapa N exige a N-1 oficializada e em dia.
- Mexer (editar ou reoficializar) numa etapa já oficializada marca as seguintes como desatualizadas.
- Consulta finalizada não muda (o repositório recusa a escrita).
"""

from datetime import datetime
from uuid import UUID

from app.consulta.repositorio import RepositorioConsultas
from app.contratos.base import ModeloApi
from app.contratos.consulta_blocos import (
    CONTEUDO,
    ETAPAS,
    Bloco,
    CondutaBloco,
    Consulta,
    DiagnosticosBloco,
    Etapa,
)

ROTULOS: dict[str, str] = {
    "anamnese": "Anamnese",
    "exame": "Exame físico",
    "historia": "História clínica",
    "diagnosticos": "Diagnósticos",
    "conduta": "Conduta",
}


class ErroEtapa(Exception):
    """A etapa não pode andar; a mensagem é para o médico."""


def seguintes(etapa: Etapa) -> list[Etapa]:
    return list(ETAPAS[ETAPAS.index(etapa) + 1 :])


def exigir_predecessor(consulta: Consulta, etapa: Etapa) -> Bloco:
    """O bloco oficializado e em dia da etapa anterior; senão, ErroEtapa."""
    anterior = ETAPAS[ETAPAS.index(etapa) - 1]
    bloco = consulta.bloco(anterior)
    if bloco is None or bloco.estado != "oficializado" or bloco.desatualizado:
        raise ErroEtapa(f"Oficialize {ROTULOS[anterior]} antes")
    return bloco


def editar(
    repo: RepositorioConsultas, medico_id: UUID, consulta_id: UUID, etapa: Etapa, conteudo: ModeloApi
) -> Consulta:
    antes = repo.buscar(medico_id, consulta_id).bloco(etapa)
    mexeu_no_oficial = antes is not None and antes.estado == "oficializado"
    desatualizar = seguintes(etapa) if mexeu_no_oficial else []
    repo.gravar_bloco(medico_id, consulta_id, etapa, "revisado_medico", conteudo, None, desatualizar=desatualizar)
    return repo.buscar(medico_id, consulta_id)


def _conferir_conteudo(etapa: Etapa, conteudo: ModeloApi) -> None:
    if isinstance(conteudo, DiagnosticosBloco) and not any(i.decisao == "confirmada" for i in conteudo.itens):
        raise ErroEtapa("Confirme ao menos um diagnóstico")
    if isinstance(conteudo, CondutaBloco) and not any(t.strip() for t in conteudo.textos):
        raise ErroEtapa("Escreva a conduta")


def oficializar(
    repo: RepositorioConsultas, medico_id: UUID, consulta_id: UUID, etapa: Etapa, quando: datetime
) -> Consulta:
    consulta = repo.buscar(medico_id, consulta_id)
    bloco = consulta.bloco(etapa)
    if bloco is None:
        raise ErroEtapa(f"Preencha {ROTULOS[etapa]} antes de oficializar")
    if etapa != ETAPAS[0]:
        exigir_predecessor(consulta, etapa)
    conteudo = CONTEUDO[etapa].model_validate(bloco.conteudo)
    _conferir_conteudo(etapa, conteudo)
    repo.gravar_bloco(medico_id, consulta_id, etapa, "oficializado", conteudo, quando, desatualizar=seguintes(etapa))
    return repo.buscar(medico_id, consulta_id)
