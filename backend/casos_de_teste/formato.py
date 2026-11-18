"""Formato de um caso de teste: uma consulta fictícia, desidentificada, com a resposta esperada por etapa.

Cada caso é um arquivo YAML em `casos_de_teste/<especialidade>/`. Campo com nome errado é recusado
(`extra="forbid"`): um erro de digitação nunca é ignorado em silêncio. O script que roda os motores
sobre os casos (marco 3) compara a saída de cada motor com `esperado`.
"""
import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Mesmas chaves de DadosEntrada (frontend/src/prontuario/registro.ts): exameFisico → exame_fisico, examesTexto → exames.
SecaoHistoria = Literal["qp", "hda", "ap", "hp", "hf", "exame_fisico", "exames"]

PADRAO_CID = re.compile(r"^[A-Z]\d{2}(\.\d{1,2})?$")
PADRAO_ID = re.compile(r"^derm-\d{3}-[a-z0-9]+(-[a-z0-9]+)*$")


class Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Revisao(Modelo):
    """Só o autor aprova. `corrigir` vem com a `nota` do que ele pediu."""
    situacao: Literal["pendente", "aprovado", "corrigir"]
    nota: str = ""
    em: date | None = None


class Alergia(Modelo):
    substancia: str
    reacao: str


class Paciente(Modelo):
    """Desidentificado: sem nome, CPF, telefone, e-mail ou endereço."""
    idade: int = Field(ge=0, le=120)
    sexo: Literal["F", "M"]
    estado_civil: str | None = None
    profissao: str | None = None
    em_uso: list[str] = []
    antecedentes: list[str] = []
    alergias: list[Alergia] = []


class Fala(Modelo):
    quem: Literal["Médico", "Paciente"]
    texto: str = Field(min_length=1)


class RespostaSinal(Modelo):
    """Sinal de alerta perguntado pelo médico: v = sim, f = não."""
    sinal: str
    resposta: Literal["v", "f"]


class ExameFisico(Modelo):
    """Os 5 campos do exame da Dermatologia. None = não examinado."""
    morfologia: str | None
    localizacao: str | None
    extensao: str | None
    gravidade: str | None
    achados: str | None


class ItemComplementar(Modelo):
    nome: str
    valor: str | None


class ExameComplementar(Modelo):
    exame: str
    data: date
    itens: list[ItemComplementar]


class Entrada(Modelo):
    paciente: Paciente
    falas: list[Fala]
    sinais: list[RespostaSinal] = []
    exame: ExameFisico
    complementares: list[ExameComplementar] = []

    @model_validator(mode="after")
    def _paciente_fala(self) -> "Entrada":
        if not any(f.quem == "Paciente" for f in self.falas):
            raise ValueError("a conversa precisa de ao menos uma fala do Paciente")
        return self


class Diagnostico(Modelo):
    nome: str
    cid: str

    @field_validator("cid")
    @classmethod
    def _cid(cls, v: str) -> str:
        if not PADRAO_CID.match(v):
            raise ValueError(f"CID-10 inválido: {v!r}")
        return v


class EsperadoHistoria(Modelo):
    """`deve_conter`: termos literais que a seção tem de ter. `vazias`: seções sem fonte (nada inventado)."""
    deve_conter: dict[SecaoHistoria, list[str]]
    vazias: list[SecaoHistoria] = []

    @model_validator(mode="after")
    def _coerente(self) -> "EsperadoHistoria":
        if vazias := set(self.deve_conter) & set(self.vazias):
            raise ValueError(f"seção esperada e vazia ao mesmo tempo: {sorted(vazias)}")
        if sem_termo := [s for s, termos in self.deve_conter.items() if not termos]:
            raise ValueError(f"seção sem nenhum termo esperado: {sem_termo}")
        return self


class EsperadoDiagnosticos(Modelo):
    """`principal` tem de estar entre os 3; `nao_pode_perder` entre os 3 ou no aviso "não pode perder"."""
    principal: Diagnostico
    nao_pode_perder: Diagnostico | None = None


class EsperadoSinais(Modelo):
    """Ids da lista fixa da especialidade que a IA tem de pegar."""
    disparados: list[str] = []


class EsperadoConduta(Modelo):
    """`protocolo`: chave da tabela de condutas (None = sem protocolo; a IA sugere e marca)."""
    protocolo: str | None
    deve_incluir: list[str] = []
    proibidos: list[str] = []


class Esperado(Modelo):
    historia: EsperadoHistoria
    diagnosticos: EsperadoDiagnosticos
    sinais: EsperadoSinais
    conduta: EsperadoConduta


class Caso(Modelo):
    versao_formato: Literal[1]
    id: str
    especialidade: Literal["dermatologia"]
    titulo: str
    objetivo: str
    revisao: Revisao
    entrada: Entrada
    esperado: Esperado

    @field_validator("id")
    @classmethod
    def _id(cls, v: str) -> str:
        if not PADRAO_ID.match(v):
            raise ValueError(f"id inválido: {v!r} (formato derm-NNN-nome-em-minusculas)")
        return v
