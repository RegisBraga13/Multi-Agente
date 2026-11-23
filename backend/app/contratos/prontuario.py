"""Prontuário: o registro "mãe" (desenho §6). Espelho exato de frontend/src/prontuario/registro.ts
(DadosEntrada, EntradaProntuario) e de ItemReceita (frontend/src/consulta/conduta.ts).

Gravado como dados organizados em JSONB com `SCHEMA_VERSION_PRONTUARIO`. Entrada salva nunca muda;
depois do fim só recebe adendo.
"""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.contratos.agenda import RetornoMarcado
from app.contratos.base import ModeloApi

SCHEMA_VERSION_PRONTUARIO = 2


class Quantidade(ModeloApi):
    n: int = Field(ge=1)
    unidade: str
    feminino: bool


class ItemReceita(ModeloApi):
    """Nome pela DCB, forma (sigla oficial), concentração, quantidade, via, posologia e tempo de tratamento."""

    nome: str
    forma: str
    concentracao: str
    quantidade: Quantidade
    via: Literal["topico", "oral"]
    posologia: str
    duracao: str
    controlado: bool | None = None


class DiagnosticoRegistro(ModeloApi):
    """Sempre 3 no prontuário: assinalados pelo médico + sugeridos pela IA para completar."""

    nome: str
    cid: str
    pct: int | None
    situacao: Literal["assinalado", "sugerido"]


class ExameRegistro(ModeloApi):
    exame: str
    nome: str
    valor: str | None
    status: Literal["PRESENT", "INFERRED", "MISSING"]
    data: str
    origem: str


class FotoRegistro(ModeloApi):
    n: int
    src: str | None


class Atestado(ModeloApi):
    tipo: Literal["atestado"]
    de: str | None
    ate: str | None
    resumo: str


class Laudo(ModeloApi):
    tipo: Literal["laudo"]
    finalidade: str
    resumo: str


DocumentoRegistro = Annotated[Atestado | Laudo, Field(discriminator="tipo")]


class ReceitaRegistro(ModeloApi):
    itens: list[ItemReceita]
    livres: list[str]
    texto: str


class DadosEntrada(ModeloApi):
    """Narrativas ('' = não colhido) e dados estruturados da entrada."""

    qp: str
    hda: str
    ap: str
    hp: str
    hf: str
    evolucao: str | None = None  # retorno: a evolução de hoje (a consulta anterior já está no prontuário); None na consulta
    extensao_pct: float | None = None  # extensão das lesões em % do corpo, do exame físico; None = sem número
    exame_fisico: str
    exames_texto: str
    exames: list[ExameRegistro]
    diagnosticos: list[DiagnosticoRegistro] = Field(max_length=3)
    receita: ReceitaRegistro | None
    conduta_texto: str
    solicitado: list[str]
    encaminhado: list[str]
    orientacoes: str
    avaliacao: str  # "nova avaliação em X semanas": recomendação da conduta, não é o retorno marcado
    retorno_marcado: RetornoMarcado | None = None
    documentos: list[DocumentoRegistro]
    fotos: list[FotoRegistro]

    @model_validator(mode="before")
    @classmethod
    def _registro_do_schema_1(cls, dados: object) -> object:
        """Registros gravados antes da versão 2 chamavam de `retorno` o que hoje é `avaliacao`."""
        if isinstance(dados, dict) and "retorno" in dados and "avaliacao" not in dados:
            dados = {**dados, "avaliacao": dados["retorno"]}
            del dados["retorno"]
        return dados


class Adendo(ModeloApi):
    quando: str
    texto: str


class PacienteComProntuario(ModeloApi):
    """Item da lista de prontuários: quem já terminou ao menos uma consulta."""

    id: UUID
    nome: str
    nascimento: date
    entradas: int
    ultima: date


class EntradaProntuario(ModeloApi):
    id: UUID
    paciente_id: UUID
    titulo: str
    tipo: Literal["consulta", "retorno"]
    modalidade: Literal["presencial", "online"]
    data: date
    hora: str = Field(pattern=r"^\d{2}:\d{2}$")
    dados: DadosEntrada
    edicoes: dict[str, str]
    adendos: list[Adendo]
