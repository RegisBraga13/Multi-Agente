"""Motor dos diagnósticos diferenciais (desenho §7.3).

Recebe SÓ a história oficializada + os dados de segurança (Constituição: nada da conversa crua). Devolve
hipóteses com certeza, % (sinal para ordenar, não probabilidade de acerto), evidências a favor/contra com o
trecho da história, o "não pode perder" e o que rastrear.

Regra fixa depois da IA: evidência cujo trecho não está na seção citada da história é descartada (aviso);
hipótese sem evidência a favor sai (aviso); sem nenhuma hipótese restante, a proposta é rejeitada.
"""

from collections.abc import Callable, Sequence
from typing import Any, Literal

from pydantic import Field

from app.contratos.base import PADRAO_CID, ModeloApi
from app.contratos.consulta import Alergia, EntradaConsulta
from app.contratos.motor import PropostaIA, RegistroDecisao
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import chamar_motor
from app.motores.historia import HistoriaClinica
from app.motores.sinais import SinaisConsulta, SinalDisparado
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_DIAGNOSTICOS = 1

# chaves como a IA as recebe (JSON em camelCase)
SecaoHistoriaId = Literal["qp", "hda", "ap", "hp", "hf", "exameFisico", "examesTexto"]
Certeza = Literal["suspeita", "hipotese", "clinico"]


class EvidenciaDD(ModeloApi):
    lado: Literal["favor", "contra"]
    texto: str
    secao: SecaoHistoriaId
    trecho: str


class HipoteseIA(ModeloApi):
    nome: str
    cid: str = Field(pattern=PADRAO_CID)
    certeza: Certeza
    pct: int = Field(ge=1, le=99)
    evidencias: list[EvidenciaDD]


class NaoPerderIA(ModeloApi):
    nome: str
    cid: str = Field(pattern=PADRAO_CID)
    porque: str
    como: str


class DiagnosticosIA(ModeloApi):
    hipoteses: list[HipoteseIA] = Field(min_length=1, max_length=6)
    nao_pode_perder: NaoPerderIA | None
    rastrear: list[str]


class DadosSeguranca(ModeloApi):
    """O que acompanha a consulta de etapa em etapa (Constituição): alergias, em uso e sinais disparados."""

    alergias: list[Alergia]
    em_uso: list[str]
    sinais: list[SinalDisparado]


def seguranca_de(entrada: EntradaConsulta, sinais: SinaisConsulta) -> DadosSeguranca:
    return DadosSeguranca(alergias=entrada.alergias, em_uso=entrada.em_uso, sinais=sinais.disparados)


def _so_com_evidencia(historia: HistoriaClinica) -> Callable[[DiagnosticosIA], tuple[DiagnosticosIA | None, list[str]]]:
    def regra(dd: DiagnosticosIA) -> tuple[DiagnosticosIA | None, list[str]]:
        secoes: dict[str, str] = historia.model_dump(by_alias=True)
        avisos: list[str] = []
        hipoteses: list[HipoteseIA] = []
        for h in dd.hipoteses:
            boas = []
            for e in h.evidencias:
                if e.trecho.strip() and e.trecho.strip() in secoes[e.secao]:
                    boas.append(e)
                else:
                    avisos.append(f"{h.nome}: evidência sem trecho da história descartada ({e.trecho!r})")
            if not any(e.lado == "favor" for e in boas):
                avisos.append(f"{h.nome}: saiu por não ter evidência a favor na história")
                continue
            hipoteses.append(h.model_copy(update={"evidencias": boas}))
        if not hipoteses:
            return None, ["nenhuma hipótese com evidência na história", *avisos]
        ordenadas = sorted(hipoteses, key=lambda h: h.pct, reverse=True)
        return dd.model_copy(update={"hipoteses": ordenadas}), avisos

    return regra


def motor_diagnosticos(
    provedor: ProvedorIA,
    historia: HistoriaClinica,
    seguranca: DadosSeguranca,
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
    ao_escrever: Callable[[dict[str, Any]], None] | None = None,
) -> PropostaIA[DiagnosticosIA]:
    prompt = carregar_prompt("dermatologia", "diagnosticos")
    pedido = PedidoIA(
        motor="diagnosticos",
        versao_prompt=prompt.versao,
        instrucoes=prompt.texto,
        dados={
            "historia": historia.model_dump(by_alias=True, mode="json"),
            "seguranca": seguranca.model_dump(by_alias=True, mode="json"),
        },
        esforco="high",
    )
    return chamar_motor(
        provedor,
        pedido,
        DiagnosticosIA,
        VERSAO_ESQUEMA_DIAGNOSTICOS,
        relogio,
        registrar,
        termos_proibidos,
        regra=_so_com_evidencia(historia),
        ao_escrever=ao_escrever,
    )
