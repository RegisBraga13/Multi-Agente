"""Blocos da consulta: o conteúdo tipado de cada etapa, guardado no Postgres (decisão 0003).

Cada etapa é um bloco `rascunho_ia → revisado_medico → oficializado` (Constituição). Anamnese e exame são
escritos pelo médico; história, diagnósticos e conduta nascem da IA e são revisados por ele. A história
oficializada carrega os dados de segurança que acompanham as etapas seguintes.
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field

from app.contratos.base import ModeloApi
from app.contratos.consulta import Alergia, ExameComplementar, ExameDerm, Fala, SinalRespondido
from app.contratos.prontuario import DocumentoRegistro, ItemReceita
from app.motores.conduta import CondutaProposta, DiagnosticoConfirmado
from app.motores.diagnosticos import DadosSeguranca, HipoteseIA, NaoPerderIA
from app.motores.historia import HistoriaClinica
from app.motores.sinais import SinalDisparado

Etapa = Literal["anamnese", "exame", "historia", "diagnosticos", "conduta"]
EtapaIA = Literal["historia", "diagnosticos", "conduta"]
ETAPAS: tuple[Etapa, ...] = ("anamnese", "exame", "historia", "diagnosticos", "conduta")
ETAPAS_IA: tuple[EtapaIA, ...] = ("historia", "diagnosticos", "conduta")
EstadoBloco = Literal["rascunho_ia", "revisado_medico", "oficializado"]
VERSAO_ESQUEMA_BLOCO = 1


class AnamneseBloco(ModeloApi):
    queixa: str
    falas: list[Fala]
    sinais: list[SinalRespondido]
    em_uso: list[str]
    antecedentes: list[str]
    alergias: list[Alergia]


class ExameBloco(ModeloApi):
    exame: ExameDerm
    complementares: list[ExameComplementar]


class HistoriaBloco(ModeloApi):
    historia: HistoriaClinica
    seguranca: DadosSeguranca
    conflitos: list[SinalDisparado]
    extras_ia: list[str]


class ItemDD(ModeloApi):
    """`propria`: diagnóstico escrito pelo médico (não veio da IA)."""

    hipotese: HipoteseIA
    decisao: Literal["pendente", "confirmada", "descartada"]
    propria: bool


class DiagnosticosBloco(ModeloApi):
    itens: list[ItemDD]
    nao_pode_perder: NaoPerderIA | None
    rastrear: list[str]


class CondutaBloco(ModeloApi):
    """A proposta (tabela/IA) + o que o médico escolheu e escreveu nos 4 grupos (ordem de GRUPOS_CONDUTA)."""

    proposta: CondutaProposta
    diagnostico: DiagnosticoConfirmado
    escolha: dict[str, list[str]]
    textos: list[str] = Field(min_length=4, max_length=4)
    receita: list[ItemReceita]
    livres: list[str]


CONTEUDO: dict[Etapa, type[ModeloApi]] = {
    "anamnese": AnamneseBloco,
    "exame": ExameBloco,
    "historia": HistoriaBloco,
    "diagnosticos": DiagnosticosBloco,
    "conduta": CondutaBloco,
}


class Bloco(ModeloApi):
    etapa: Etapa
    estado: EstadoBloco
    desatualizado: bool
    conteudo: dict[str, Any]
    oficializado_em: datetime | None


class NovaConsulta(ModeloApi):
    paciente_id: UUID
    tipo: Literal["consulta", "retorno"]
    modalidade: Literal["presencial", "online"]
    agendada_para: AwareDatetime  # com fuso: a data/hora do consultório sai daqui


class Consulta(NovaConsulta):
    id: UUID
    finalizada_em: datetime | None
    blocos: list[Bloco]

    def bloco(self, etapa: Etapa) -> Bloco | None:
        return next((b for b in self.blocos if b.etapa == etapa), None)


TipoDocumento = Literal["receita", "exames", "encaminhamento", "orientacoes", "atestado", "laudo"]


class Documento(ModeloApi):
    """Texto final montado pela tela (formato aprovado pelo autor); `registro`: resumo de uma linha do atestado/laudo."""

    tipo: TipoDocumento
    estado: Literal["rascunho", "revisado", "assinado", "enviado"]
    texto: str
    registro: DocumentoRegistro | None
