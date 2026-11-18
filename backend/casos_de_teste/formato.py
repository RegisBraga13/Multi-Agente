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
    """Critérios clínicos da história, avaliados pelo sentido (não por palavra literal).

    `fatos`: o que tem de estar na história. `negativas`: o que o paciente negou e tem de constar como negado.
    `sem_resposta`: perguntado, mas o paciente não soube responder — registrar como desconhecido pelo paciente.
    `desconhecidos`: o que não foi perguntado nem examinado — não pode virar afirmação nem "nega".
    `vazias`: seções sem nenhuma fonte na entrada (nada inventado).
    """

    fatos: list[str] = Field(min_length=1)
    negativas: list[str] = []
    sem_resposta: list[str] = []
    desconhecidos: list[str] = []
    vazias: list[SecaoHistoria] = []


class DiagnosticoPrincipal(Diagnostico):
    """`certeza`: suspeita (ex. câncer antes da histopatologia), hipotese ou clinico."""

    certeza: Literal["suspeita", "hipotese", "clinico"]


class EsperadoDiagnosticos(Modelo):
    """`principal` (ou um dos `aceitos`) tem de estar entre os 3; `nao_pode_perder` entre os 3 ou no aviso.

    `rastrear`: o que investigar e registrar a negativa, sem diagnosticar (ex. artrite psoriásica).
    """

    principal: DiagnosticoPrincipal
    aceitos: list[Diagnostico] = []
    nao_pode_perder: Diagnostico | None = None
    rastrear: list[str] = []


class EsperadoSinais(Modelo):
    """Ids da lista fixa da especialidade que a IA tem de pegar."""

    disparados: list[str] = []


class EsperadoConduta(Modelo):
    """Critérios clínicos da conduta, avaliados pelo sentido (IA avaliadora) e por regra no que é estruturado.

    `protocolo`: chave da tabela de condutas (None = sem protocolo).
    `urgencia`: rotina, prioritaria ou imediata (regra fixa).
    `obrigatorios` / `proibidos`: frases clínicas; citar um item para contraindicá-lo NÃO viola `proibidos`.
    `remedios_proibidos`: nomes (DCB) que não podem estar na receita — conferidos por regra nos itens estruturados.
    """

    protocolo: str | None
    urgencia: Literal["rotina", "prioritaria", "imediata"]
    obrigatorios: list[str] = Field(min_length=1)
    proibidos: list[str] = []
    remedios_proibidos: list[str] = []


class Esperado(Modelo):
    historia: EsperadoHistoria
    diagnosticos: EsperadoDiagnosticos
    sinais: EsperadoSinais
    conduta: EsperadoConduta


class Caso(Modelo):
    versao_formato: Literal[2]
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
