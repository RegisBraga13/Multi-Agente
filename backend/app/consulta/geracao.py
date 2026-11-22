"""A IA dentro da consulta (Constituição): cada etapa recebe só o oficializado da anterior.

- Gating antes de tudo: sem a etapa anterior oficializada e em dia, nada é chamado (ErroEtapa → 409).
- Privacidade: o pedido leva só a entrada desidentificada e os termos proibidos do paciente; dado de
  identidade → ErroPrivacidade (→ 422), nada enviado.
- Toda chamada da IA fica em `ai_proposals` (decisão, modelo, versões, confiança, tokens + a proposta validada).
- A proposta só vira bloco (`rascunho_ia`) se a etapa ainda não foi mexida pelo médico; senão volta como
  sugestão ao lado. REJECT nunca grava.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.consulta.perguntas import respostas_de_alerta, seguranca_com_respostas
from app.consulta.repositorio import ConsultaFinalizada, ConsultaNaoEncontrada, RepositorioConsultas
from app.consulta.servico import ErroEtapa, exigir_predecessor
from app.contratos.base import ModeloApi
from app.contratos.consulta import entrada_da_consulta, termos_do_paciente
from app.contratos.consulta_blocos import (
    AnamneseBloco,
    CondutaBloco,
    Consulta,
    DiagnosticosBloco,
    EtapaIA,
    ExameBloco,
    HipoteseItem,
    HistoriaBloco,
    ItemDD,
)
from app.contratos.motor import Acao, RegistroDecisao
from app.contratos.paciente import Paciente
from app.especialidades.guias import carregar_guias
from app.especialidades.registro import Pacote
from app.fuso import no_consultorio
from app.motores.conduta import DiagnosticoConfirmado, motor_conduta
from app.motores.diagnosticos import motor_diagnosticos, seguranca_de
from app.motores.historia import motor_historia
from app.motores.perguntas import PerguntasProposta, motor_perguntas
from app.motores.sinais import motor_sinais
from app.pacientes.repositorio import RepositorioPacientes
from app.provedores.ia import ProvedorIA
from app.provedores.relogio import Relogio

PRONTA = "Proposta da IA pronta para revisão"
FALHOU = "A IA não conseguiu; escreva ou tente de novo"
AO_LADO = "Sugestão da IA ao lado: o bloco já foi revisado pelo médico"
MUDOU = "A etapa anterior mudou durante a geração; gere de novo"
AoEscrever = Callable[[dict[str, Any]], None]


@dataclass(frozen=True)
class Contexto:
    repo: RepositorioConsultas
    pacientes: RepositorioPacientes
    provedor: ProvedorIA
    relogio: Relogio
    pacote: Callable[[str], Pacote]  # a especialidade da consulta escolhe sinais e protocolos


class ResultadoGeracao(ModeloApi):
    acao: Acao
    gravado: bool
    conteudo: dict[str, Any] | None
    avisos: list[str]
    mensagem: str


def _paciente(ctx: Contexto, medico_id: UUID, consulta: Consulta) -> Paciente:
    paciente = ctx.pacientes.buscar(medico_id, consulta.paciente_id)
    if paciente is None:  # a chave estrangeira impede; defesa
        raise ConsultaNaoEncontrada
    return paciente


def _historia(
    ctx: Contexto,
    consulta: Consulta,
    paciente: Paciente,
    reg: Callable[[RegistroDecisao], None],
    termos: list[str],
    conteudos: dict[str, Any],
    ao_escrever: AoEscrever | None,
) -> tuple[ModeloApi | None, list[str]]:
    anamnese = AnamneseBloco.model_validate(_bloco(consulta, "anamnese"))
    exame = ExameBloco.model_validate(_bloco(consulta, "exame"))
    entrada = entrada_da_consulta(paciente, anamnese, exame, no_consultorio(consulta.agendada_para).date())
    sinais = motor_sinais(
        ctx.provedor,
        entrada,
        ctx.pacote(consulta.especialidade).sinais,
        ctx.relogio,
        reg,
        termos,
        especialidade=consulta.especialidade,
    )
    conteudos["sinais"] = sinais.model_dump(by_alias=True, mode="json")
    p = motor_historia(
        ctx.provedor, entrada, ctx.relogio, reg, termos, ao_escrever=ao_escrever, especialidade=consulta.especialidade
    )
    conteudos["historia"] = p.resultado.model_dump(by_alias=True, mode="json") if p.resultado else None
    if p.resultado is None:
        return None, [*sinais.avisos, *p.avisos]
    bloco = HistoriaBloco(
        historia=p.resultado,
        seguranca=seguranca_de(entrada, sinais),
        conflitos=sinais.conflitos,
        extras_ia=sinais.extras_ia,
    )
    return bloco, [*sinais.avisos, *p.avisos]


def _bloco(consulta: Consulta, etapa: str) -> dict[str, Any]:
    b = next(b for b in consulta.blocos if b.etapa == etapa)
    return b.conteudo


def gerar(
    ctx: Contexto, medico_id: UUID, consulta_id: UUID, etapa: EtapaIA, ao_escrever: AoEscrever | None = None
) -> ResultadoGeracao:
    consulta = ctx.repo.buscar(medico_id, consulta_id)
    if consulta.finalizada_em is not None:
        raise ConsultaFinalizada
    anterior = exigir_predecessor(consulta, etapa)
    paciente = _paciente(ctx, medico_id, consulta)
    termos = termos_do_paciente(paciente)
    registros: list[RegistroDecisao] = []
    conteudos: dict[str, Any] = {}
    reg = registros.append
    sem_gravar: ModeloApi | None = None
    try:
        novo: ModeloApi | None
        if etapa == "historia":
            novo, avisos = _historia(ctx, consulta, paciente, reg, termos, conteudos, ao_escrever)
        elif etapa == "diagnosticos":
            h = HistoriaBloco.model_validate(_bloco(consulta, "historia"))
            seguranca = seguranca_com_respostas(h.seguranca, h.perguntas, ctx.pacote(consulta.especialidade).sinais)
            p = motor_diagnosticos(
                ctx.provedor,
                h.historia,
                seguranca,
                ctx.relogio,
                reg,
                termos,
                ao_escrever,
                consulta.especialidade,
                respostas_de_alerta(h.perguntas),
            )
            conteudos["diagnosticos"] = p.resultado.model_dump(by_alias=True, mode="json") if p.resultado else None
            avisos = p.avisos
            novo = (
                DiagnosticosBloco(
                    itens=[
                        ItemDD(hipotese=HipoteseItem.model_validate(x.model_dump()), decisao="pendente", propria=False)
                        for x in p.resultado.hipoteses
                    ],
                    nao_pode_perder=p.resultado.nao_pode_perder,
                    rastrear=p.resultado.rastrear,
                )
                if p.resultado
                else None
            )
        else:
            h = HistoriaBloco.model_validate(_bloco(consulta, "historia"))
            dd = DiagnosticosBloco.model_validate(_bloco(consulta, "diagnosticos"))
            principal = next(i.hipotese for i in dd.itens if i.decisao == "confirmada")
            dx = DiagnosticoConfirmado(nome=principal.nome, cid=principal.cid, certeza=principal.certeza)
            c = motor_conduta(
                ctx.provedor,
                dx,
                seguranca_com_respostas(h.seguranca, h.perguntas, ctx.pacote(consulta.especialidade).sinais),
                ctx.pacote(consulta.especialidade).protocolos,
                ctx.relogio,
                reg,
                termos,
                ao_escrever,
                consulta.especialidade,
            )
            conteudos["conduta"] = c.model_dump(by_alias=True, mode="json")
            avisos = c.avisos
            bloco_conduta = CondutaBloco(
                proposta=c, diagnostico=dx, escolha={}, textos=["", "", "", ""], receita=[], livres=[]
            )
            novo = bloco_conduta if c.acao == "HUMAN_REVIEW" else None
            # sem conduta a revisar nada é gravado, mas a urgência e a emergência (regra fixa) chegam à tela
            sem_gravar = bloco_conduta if novo is None else None
    finally:
        for r in registros:
            ctx.repo.registrar_proposta(medico_id, consulta_id, r, conteudos.get(r.motor))

    if novo is None:
        conteudo_rejeitado = sem_gravar.model_dump(by_alias=True, mode="json") if sem_gravar else None
        return ResultadoGeracao(
            acao="REJECT", gravado=False, conteudo=conteudo_rejeitado, avisos=avisos, mensagem=FALHOU
        )
    conteudo = novo.model_dump(by_alias=True, mode="json")
    # a IA levou segundos: grava só se a anterior continua como estava e a etapa não foi mexida (uma gravação só)
    situacao = ctx.repo.gravar_rascunho_ia(
        medico_id, consulta_id, etapa, novo, anterior.etapa, anterior.oficializado_em
    )
    mensagem = {"gravado": PRONTA, "revisado": AO_LADO, "mudou": MUDOU}[situacao]
    return ResultadoGeracao(
        acao="HUMAN_REVIEW", gravado=situacao == "gravado", conteudo=conteudo, avisos=avisos, mensagem=mensagem
    )


HISTORIA_AUSENTE = "Monte a história antes das perguntas"


def gerar_perguntas(ctx: Contexto, medico_id: UUID, consulta_id: UUID) -> PerguntasProposta:
    """Propõe as perguntas contextuais da consulta. Não grava no bloco: a tela as põe na história e salva com ela."""
    consulta = ctx.repo.buscar(medico_id, consulta_id)
    if consulta.finalizada_em is not None:
        raise ConsultaFinalizada
    blocos = {e: consulta.bloco(e) for e in ("anamnese", "exame", "historia")}
    if any(b is None for b in blocos.values()):
        raise ErroEtapa(HISTORIA_AUSENTE)
    catalogo = ctx.pacote(consulta.especialidade).sinais
    paciente = _paciente(ctx, medico_id, consulta)
    anamnese = AnamneseBloco.model_validate(_bloco(consulta, "anamnese"))
    exame = ExameBloco.model_validate(_bloco(consulta, "exame"))
    historia = HistoriaBloco.model_validate(_bloco(consulta, "historia")).historia
    entrada = entrada_da_consulta(paciente, anamnese, exame, no_consultorio(consulta.agendada_para).date())
    registros: list[RegistroDecisao] = []
    proposta: PerguntasProposta | None = None
    try:
        proposta = motor_perguntas(
            ctx.provedor,
            entrada,
            historia,
            catalogo,
            carregar_guias(consulta.especialidade),
            ctx.relogio,
            registros.append,
            termos_do_paciente(paciente),
            consulta.especialidade,
        )
    finally:
        conteudo = proposta.model_dump(by_alias=True, mode="json") if proposta else None
        for r in registros:
            ctx.repo.registrar_proposta(medico_id, consulta_id, r, conteudo)
    return proposta
