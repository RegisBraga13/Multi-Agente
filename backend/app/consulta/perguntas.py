"""Regras das perguntas contextuais (puras, sem IA): o que cada resposta faz depois da história.

- Sim numa pergunta ligada a um sinal do catálogo dispara as regras desse sinal (urgência, prazo, ação), igual a quando
  o médico respondia o sinal na anamnese. Não, sem resposta e pergunta livre não disparam nada.
- O DD lê só as perguntas respondidas.
"""

from app.contratos.consulta_blocos import PerguntaContextual
from app.especialidades.pacote import SinalAlerta
from app.motores.diagnosticos import DadosSeguranca, RespostaDeAlerta
from app.motores.sinais import SinalDisparado

_ORDEM_TIPO: dict[str, int] = {"urgencia_imediata": 0, "prioridade": 1, "muda_tratamento": 2}


def seguranca_com_respostas(
    seguranca: DadosSeguranca, perguntas: list[PerguntaContextual], catalogo: list[SinalAlerta]
) -> DadosSeguranca:
    """A segurança da história mais os sinais do catálogo que o médico respondeu Sim nas perguntas contextuais."""
    por_id = {s.id: s for s in catalogo}
    ja = {d.id for d in seguranca.sinais}
    novos: list[SinalDisparado] = []
    for p in perguntas:
        if p.resposta != "sim" or p.sinal_id is None or p.sinal_id not in por_id or p.sinal_id in ja:
            continue
        s = por_id[p.sinal_id]
        ja.add(s.id)
        novos.append(
            SinalDisparado(
                id=s.id, texto=s.texto, tipo=s.tipo, acao=s.acao, prazo=s.prazo, origem="respondido", trecho=None
            )
        )
    todos = sorted([*seguranca.sinais, *novos], key=lambda d: _ORDEM_TIPO[d.tipo])  # estável
    return seguranca.model_copy(update={"sinais": todos})


def respostas_de_alerta(perguntas: list[PerguntaContextual]) -> list[RespostaDeAlerta]:
    return [RespostaDeAlerta(texto=p.texto, resposta=p.resposta) for p in perguntas if p.resposta is not None]


def frases_da_hda(perguntas: list[PerguntaContextual]) -> str:
    """As respostas dadas, em frases de prontuário, na ordem das perguntas. Sem resposta não entra (não vira "nega");
    frase repetida entra uma vez; cada frase termina em ponto."""
    frases: list[str] = []
    for p in perguntas:
        frase = {"sim": p.se_sim, "nao": p.se_nao}.get(p.resposta or "", "").strip()
        if not frase:
            continue
        frase = frase if frase.endswith((".", "!", "?")) else f"{frase}."
        if frase not in frases:
            frases.append(frase)
    return " ".join(frases)
