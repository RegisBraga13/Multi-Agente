"""O prontuário montado pelo servidor a partir dos blocos oficializados (desenho §6 e §7.3).

Porte de `diagnosticosDoProntuario` e `dadosDaConsulta` (frontend/src/consulta/prontuario.ts): mesmas regras,
agora na fonte única (Pydantic). Diagnósticos: até 3 — assinalados (confirmados; >3 → maior %) e sugeridos
(pendentes) para completar; descartado nunca entra.
"""

import re

from app.contratos.consulta_blocos import (
    CondutaBloco,
    DiagnosticosBloco,
    Documento,
    ExameBloco,
    HistoriaBloco,
    ItemDD,
)
from app.contratos.prontuario import DadosEntrada, DiagnosticoRegistro, ExameRegistro, ReceitaRegistro

# frase termina em ponto e a seguinte começa com maiúscula
_FRASES = re.compile(r"(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])")


def _frases(texto: str) -> list[str]:
    return [f.strip() for f in _FRASES.split(texto) if f.strip()]


def _por_pct(itens: list[ItemDD]) -> list[ItemDD]:
    ordem = sorted(
        enumerate(itens), key=lambda x: (-(x[1].hipotese.pct if x[1].hipotese.pct is not None else -1), x[0])
    )
    return [i for _, i in ordem]


def diagnosticos_do_prontuario(itens: list[ItemDD]) -> list[DiagnosticoRegistro]:
    assinalados = _por_pct([i for i in itens if i.decisao == "confirmada"])[:3]
    sugeridos = _por_pct([i for i in itens if i.decisao == "pendente"])[: 3 - len(assinalados)]

    def reg(i: ItemDD, situacao: str) -> DiagnosticoRegistro:
        h = i.hipotese
        return DiagnosticoRegistro(nome=h.nome, cid=h.cid, pct=h.pct, situacao=situacao)

    return [reg(i, "assinalado") for i in assinalados] + [reg(i, "sugerido") for i in sugeridos]


def _sem(prefixo: str, frase: str) -> str:
    return frase.removeprefix(prefixo).removesuffix(".")


def dados_da_consulta(
    historia: HistoriaBloco,
    dd: DiagnosticosBloco,
    conduta: CondutaBloco,
    exame: ExameBloco,
    documentos: list[Documento],
) -> DadosEntrada:
    h = historia.historia
    t = [x.strip() for x in conduta.textos]
    orient = _frases(t[3])
    enviados = [d for d in documentos if d.estado == "enviado"]
    receita = next((d.texto.strip() for d in enviados if d.tipo == "receita"), "")
    return DadosEntrada(
        qp=h.qp.strip(),
        hda=h.hda.strip(),
        ap=h.ap.strip(),
        hp=h.hp.strip(),
        hf=h.hf.strip(),
        exame_fisico=h.exame_fisico.strip(),
        exames_texto=h.exames_texto.strip(),
        exames=[
            ExameRegistro(
                exame=c.exame,
                nome=i.nome,
                valor=i.valor,
                status=i.status,
                data=c.data.isoformat(),
                origem=c.origem,
            )
            for c in exame.complementares
            for i in c.itens
        ],
        diagnosticos=diagnosticos_do_prontuario(dd.itens),
        # o tratamento detalhado: a receita enviada, como está; sem ela, só o texto da conduta
        receita=ReceitaRegistro(itens=conduta.receita, livres=conduta.livres, texto=receita) if receita else None,
        conduta_texto=" ".join(x for x in t[:3] if x),
        solicitado=[
            "exames de rotina" if f.startswith("Solicito exames de rotina") else _sem("Solicito ", f)
            for f in orient
            if f.startswith("Solicito ")
        ],
        encaminhado=[_sem("Encaminho para ", f) for f in orient if f.startswith("Encaminho para ")],
        orientacoes=" ".join(f for f in orient if not f.startswith(("Solicito ", "Encaminho ", "Retorno "))),
        retorno=" ".join(f.removeprefix("Retorno ") for f in orient if f.startswith("Retorno ")),
        documentos=[d.registro for d in enviados if d.registro is not None],
        fotos=[],
    )
