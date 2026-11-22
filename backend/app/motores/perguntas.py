"""Motor das perguntas contextuais (decisão do autor, 21/11/2026): depois da história, a IA escreve só as perguntas de
segurança que servem a ESTE paciente, usando o catálogo de sinais e os guias por queixa como apoio, nunca como lista
obrigatória. Sem mínimo e sem máximo clínico (o limite do esquema é só uma trava técnica).

- Um `sinal_id` só vale se existir no catálogo; senão a pergunta vira livre e o aviso fica registrado.
- A IA falhou → lista vazia com aviso; a consulta segue sem perguntas. Dado de identidade no pedido → `ErroPrivacidade`.
"""

from collections.abc import Callable, Sequence

from pydantic import Field

from app.contratos.base import ModeloApi
from app.contratos.consulta import EntradaConsulta
from app.contratos.consulta_blocos import PerguntaContextual
from app.contratos.motor import RegistroDecisao
from app.especialidades.guias import Guia
from app.especialidades.pacote import ESPECIALIDADE_PADRAO, SinalAlerta
from app.especialidades.prompts import carregar_prompt
from app.motores.chamada import chamar_motor
from app.motores.historia import HistoriaClinica
from app.provedores.ia import PedidoIA, ProvedorIA
from app.provedores.relogio import Relogio

VERSAO_ESQUEMA_PERGUNTAS = 1
MAXIMO_TECNICO = 15


class PerguntaIA(ModeloApi):
    texto: str = Field(min_length=1)
    se_sim: str = Field(min_length=1)
    se_nao: str = Field(min_length=1)
    sinal_id: str | None


class PerguntasIA(ModeloApi):
    perguntas: list[PerguntaIA] = Field(max_length=MAXIMO_TECNICO)


class PerguntasProposta(ModeloApi):
    perguntas: list[PerguntaContextual]
    avisos: list[str]
    ia_falhou: bool


def motor_perguntas(
    provedor: ProvedorIA,
    entrada: EntradaConsulta,
    historia: HistoriaClinica,
    catalogo: list[SinalAlerta],
    guias: list[Guia],
    relogio: Relogio,
    registrar: Callable[[RegistroDecisao], None],
    termos_proibidos: Sequence[str] = (),
    especialidade: str = ESPECIALIDADE_PADRAO,
) -> PerguntasProposta:
    prompt = carregar_prompt(especialidade, "perguntas")
    pedido = PedidoIA(
        motor="perguntas",
        versao_prompt=prompt.versao,
        instrucoes=prompt.texto,
        dados={
            "consulta": entrada.model_dump(by_alias=True, mode="json"),
            "historia": historia.model_dump(by_alias=True, mode="json"),
            "catalogo": [{"id": s.id, "texto": s.texto, "porque": s.porque} for s in catalogo],
            "guias": [{"titulo": g.titulo, "texto": g.texto} for g in guias],
        },
        esforco="medium",
    )
    # dado de identidade no pedido: ErroPrivacidade sobe (a rota responde 422 e nada é enviado), como na história
    proposta = chamar_motor(
        provedor, pedido, PerguntasIA, VERSAO_ESQUEMA_PERGUNTAS, relogio, registrar, termos_proibidos
    )
    if proposta.resultado is None:
        aviso = "A IA não conseguiu escrever as perguntas; siga sem elas ou tente de novo"
        return PerguntasProposta(perguntas=[], avisos=[aviso], ia_falhou=True)

    ids = {s.id for s in catalogo}
    avisos: list[str] = []
    perguntas: list[PerguntaContextual] = []
    for i, p in enumerate(proposta.resultado.perguntas, start=1):
        sinal = p.sinal_id
        if sinal is not None and sinal not in ids:
            avisos.append(f"IA ligou a pergunta {i} a um sinal fora do catálogo ({sinal!r}); virou pergunta livre")
            sinal = None
        perguntas.append(
            PerguntaContextual(id=f"p{i}", texto=p.texto, se_sim=p.se_sim, se_nao=p.se_nao, sinal_id=sinal)
        )
    return PerguntasProposta(perguntas=perguntas, avisos=avisos, ia_falhou=False)
