"""Contratos da agenda: o pedido de consulta (página do médico) e o formulário que o paciente envia.

O pedido não é paciente nem consulta: tem só nome e WhatsApp. Nascimento e sexo chegam com o formulário.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.contratos.base import ModeloApi

Modalidade = Literal["presencial", "online"]
SituacaoFicha = Literal["sem-ficha", "link-enviado", "pronta"]
PADRAO_HORA = r"^([01]\d|2[0-3]):[0-5]\d$"
PADRAO_WHATSAPP = r"^55[1-9]\d9\d{8}$"  # celular com DDD, já normalizado pela página
PADRAO_PERGUNTA = r"^[a-z0-9_]+$"


class Horario(ModeloApi):
    data: date
    inicio: str = Field(pattern=PADRAO_HORA)


class NovoPedido(Horario):
    modalidade: Modalidade
    nome: str = Field(min_length=1, max_length=120)
    whatsapp: str = Field(pattern=PADRAO_WHATSAPP)
    pagamento: str = Field(min_length=1, max_length=80)  # "Particular" ou o nome do convênio
    transcricao: Literal["aceita", "recusada"]
    forma: Literal["whatsapp", "pagina", "consulta"]


class PedidoCriado(ModeloApi):
    id: UUID
    token_formulario: str


class DadosPessoais(ModeloApi):
    """Identificação do formulário (os opcionais chegam vazios)."""

    nome_completo: str = Field(min_length=1, max_length=160)
    nome_social: str = Field(default="", max_length=160)
    nascimento: date
    sexo: Literal["M", "F", "I"]  # masculino, feminino, intersexo
    whatsapp: str = Field(max_length=30)
    email: str = Field(default="", max_length=160)
    cidade: str = Field(max_length=80)
    uf: str = Field(pattern=r"^[A-Z]{2}$")
    estado_civil: Literal["solteiro", "casado", "uniao-estavel", "separado", "divorciado", "viuvo", ""] = ""
    profissao: str = Field(default="", max_length=120)
    trabalho_exposto: Literal["sim", "nao", ""] = ""


class FotoEnviada(ModeloApi):
    tipo: str = Field(pattern=r"^(image/[a-z0-9.+-]+|application/pdf)$")  # foto, ou receita/exame/laudo em PDF
    base64: str = Field(max_length=14_000_000)  # ~10 MB depois de decodificada


class FormularioEnviado(ModeloApi):
    dados: DadosPessoais
    respostas: dict[str, str | list[str]] = Field(default_factory=dict, max_length=80)
    fotos: dict[str, FotoEnviada] = Field(default_factory=dict, max_length=12)  # 2 fotos da pele + até 10 documentos


class FormularioRecebido(ModeloApi):
    """O que o médico vê: as respostas e as perguntas que têm foto (a foto vem por outra rota)."""

    dados: DadosPessoais
    respostas: dict[str, str | list[str]]
    fotos: list[str]
    recebido_em: datetime


class PedidoParaPaciente(Horario):
    """O que a página do formulário mostra (aberta pelo link que o paciente recebe)."""

    medico_slug: str
    modalidade: Modalidade
    nome: str
    whatsapp: str
    situacao_ficha: SituacaoFicha


class Pedido(NovoPedido):
    """O pedido na agenda do médico."""

    id: UUID
    token_formulario: str
    situacao_ficha: SituacaoFicha
    status: Literal["novo", "confirmado", "cancelado"]
    criado_em: datetime
    formulario: FormularioRecebido | None = None
