"""Motor da conduta (desenho §6, §7.3 e §12): tabela primeiro, IA só complementa ou cobre a lacuna.

Ordem fixa:
1. Urgência e ação de emergência pelos sinais disparados — regra fixa, sem IA, mesmo sem protocolo.
2. Protocolo pelo CID do diagnóstico confirmado → opções da tabela (contraindicadas tiradas, com motivo); a IA só
   devolve orientações e alertas complementares, sem receitar.
3. Sem protocolo → a IA propõe os 4 grupos, marcada "sugestão da IA".
Recebe SÓ o diagnóstico oficializado e os dados de segurança (Constituição): nada da história.
"""

from collections.abc import Callable, Sequence

from app.contratos.base import ModeloApi
from app.contratos.motor import Acao, RegistroDecisao
from app.contratos.prontuario import ItemReceita
from app.especialidades.condutas import (
    GrupoId,
    PropostaTabela,
    Protocolo,
    Urgencia,
    aplicar_protocolo,
    emergencia_por_sinais,
    protocolo_do_cid,
    urgencia_por_sinais,
)
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import chamar_motor
from app.motores.diagnosticos import Certeza, DadosSeguranca
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_CONDUTA = 1
ORIGEM_IA = "sugestão da IA"
AVISO_FALHOU = "A IA não conseguiu; escreva a conduta"
ROTULOS: dict[str, str] = {
    "cuidados": "1. Cuidados básicos",
    "topico": "2. Tratamento tópico",
    "sistemico": "3. Tratamento sistêmico",
    "orientacoes": "4. Orientações",
}


class DiagnosticoConfirmado(ModeloApi):
    nome: str
    cid: str
    certeza: Certeza


class ComplementoConduta(ModeloApi):
    orientacoes: list[str]
    alertas: list[str]


class OpcaoIA(ModeloApi):
    rotulo: str
    texto: str
    receita: list[ItemReceita]


class GrupoIA(ModeloApi):
    id: GrupoId
    opcoes: list[OpcaoIA]


class CondutaIA(ModeloApi):
    grupos: list[GrupoIA]
    alertas: list[str]


class CondutaProposta(ModeloApi):
    urgencia: Urgencia
    emergencia: list[str]
    tabela: PropostaTabela | None
    ia: CondutaIA | None
    complemento: ComplementoConduta | None
    origem: str
    avisos: list[str]
    acao: Acao


def motor_conduta(
    provedor: ProvedorIA,
    dx: DiagnosticoConfirmado,
    seguranca: DadosSeguranca,
    protocolos: dict[str, Protocolo],
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
) -> CondutaProposta:
    urgencia = urgencia_por_sinais(seguranca.sinais)
    emergencia = emergencia_por_sinais(seguranca.sinais)
    protocolo = protocolo_do_cid(protocolos, dx.cid)
    prompt = carregar_prompt("dermatologia", "conduta")
    dados = {
        "diagnostico": dx.model_dump(by_alias=True, mode="json"),
        "seguranca": seguranca.model_dump(by_alias=True, mode="json"),
        "emergencia": emergencia,
    }

    def pedido(motor: str, extra: dict[str, object]) -> PedidoIA:
        return PedidoIA(
            motor=motor, versao_prompt=prompt.versao, instrucoes=prompt.texto, dados=dados | extra, esforco="medium"
        )

    if protocolo is not None:
        tabela = aplicar_protocolo(protocolo, seguranca.sinais)
        p = chamar_motor(
            provedor,
            pedido("conduta-complemento", {"tabela": tabela.model_dump(by_alias=True, mode="json")}),
            ComplementoConduta,
            VERSAO_ESQUEMA_CONDUTA,
            relogio,
            registrar,
            termos_proibidos,
        )
        avisos = p.avisos if p.resultado else [AVISO_FALHOU]
        return CondutaProposta(
            urgencia=urgencia,
            emergencia=emergencia,
            tabela=tabela,
            ia=None,
            complemento=p.resultado,
            origem=tabela.origem,
            avisos=avisos,
            acao="HUMAN_REVIEW",
        )

    q = chamar_motor(
        provedor, pedido("conduta", {}), CondutaIA, VERSAO_ESQUEMA_CONDUTA, relogio, registrar, termos_proibidos
    )
    return CondutaProposta(
        urgencia=urgencia,
        emergencia=emergencia,
        tabela=None,
        ia=q.resultado,
        complemento=None,
        origem=ORIGEM_IA,
        avisos=q.avisos if q.resultado else [AVISO_FALHOU],
        acao=q.acao,
    )


def texto_da_conduta(c: CondutaProposta) -> str:
    """Texto corrido de tudo o que a conduta oferece ao médico (para a avaliadora e para revisão)."""
    partes = [f"Urgência: {c.urgencia}."]
    if c.emergencia:
        partes.append("Ação de emergência: " + "; ".join(c.emergencia) + ".")
    partes.append(f"Origem: {c.origem}.")
    if c.tabela is not None:
        for g in c.tabela.grupos:
            linhas = [g.fixo or ""] + [
                f"{o.rotulo}: {o.texto}" + "".join(f" [{_item(i)}]" for i in o.receita)
                for linha in g.linhas
                for o in linha.opcoes
            ]
            partes.append(f"{g.rotulo} — opções: " + " | ".join(x for x in linhas if x))
        partes += [f"Não indicado: {b.rotulo} — {b.motivo}." for b in c.tabela.bloqueadas]
    if c.ia is not None:
        for gi in c.ia.grupos:
            opcoes = [f"{o.rotulo}: {o.texto}" + "".join(f" [{_item(i)}]" for i in o.receita) for o in gi.opcoes]
            partes.append(f"{ROTULOS[gi.id]} — opções: " + " | ".join(opcoes))
        partes += [f"Alerta: {a}" for a in c.ia.alertas]
    if c.complemento is not None:
        partes += [f"Orientação: {o}" for o in c.complemento.orientacoes]
        partes += [f"Alerta: {a}" for a in c.complemento.alertas]
    partes += [f"Aviso: {a}" for a in c.avisos]
    return "\n".join(partes)


def _item(i: ItemReceita) -> str:
    return f"{i.nome} {i.concentracao} {i.forma} — {i.posologia} — {i.duracao}".replace("  ", " ")


def remedios_da_conduta(c: CondutaProposta) -> list[str]:
    """Nomes (DCB) de todos os itens de receita oferecidos ao médico."""
    nomes: list[str] = []
    if c.tabela is not None:
        nomes += [i.nome for g in c.tabela.grupos for linha in g.linhas for o in linha.opcoes for i in o.receita]
    if c.ia is not None:
        nomes += [i.nome for g in c.ia.grupos for o in g.opcoes for i in o.receita]
    return nomes
