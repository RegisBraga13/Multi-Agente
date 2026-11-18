"""Motor da história clínica (desenho §7.3): organiza anamnese + exame em seções, para o médico revisar.

Recebe só a entrada desidentificada. As seções têm as mesmas chaves de `DadosEntrada` do prontuário;
"" = seção sem fonte (nada inventado).
"""

from collections.abc import Callable, Sequence

from app.contratos.base import ModeloApi
from app.contratos.consulta import EntradaConsulta
from app.contratos.motor import PropostaIA, RegistroDecisao
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import chamar_motor
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_HISTORIA = 1


class HistoriaClinica(ModeloApi):
    qp: str
    hda: str
    ap: str
    hp: str
    hf: str
    exame_fisico: str
    exames_texto: str


def motor_historia(
    provedor: ProvedorIA,
    entrada: EntradaConsulta,
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
) -> PropostaIA[HistoriaClinica]:
    prompt = carregar_prompt("dermatologia", "historia")
    pedido = PedidoIA(
        motor="historia",
        versao_prompt=prompt.versao,
        instrucoes=prompt.texto,
        dados={"consulta": entrada.model_dump(by_alias=True, mode="json")},
        esforco="medium",
    )
    return chamar_motor(
        provedor, pedido, HistoriaClinica, VERSAO_ESQUEMA_HISTORIA, relogio, registrar, termos_proibidos
    )
