"""Dados de teste reaproveitados entre arquivos."""

from app.contratos.prontuario import DadosEntrada

DADOS_MINIMOS = DadosEntrada(
    qp="Espinhas.",
    hda="Paciente, 34 anos, refere espinhas.",
    ap="",
    hp="",
    hf="",
    exame_fisico="Pápulas em face.",
    exames_texto="",
    exames=[],
    diagnosticos=[],
    receita=None,
    conduta_texto="",
    solicitado=[],
    encaminhado=[],
    orientacoes="",
    retorno="",
    documentos=[],
    fotos=[],
)

from app.contratos.consulta import ExameDerm, Fala  # noqa: E402
from app.contratos.consulta_blocos import (  # noqa: E402
    AnamneseBloco,
    CondutaBloco,
    DiagnosticosBloco,
    ExameBloco,
    HistoriaBloco,
    ItemDD,
)
from app.motores.conduta import CondutaProposta, DiagnosticoConfirmado  # noqa: E402
from app.motores.diagnosticos import DadosSeguranca, EvidenciaDD, HipoteseIA  # noqa: E402
from app.motores.historia import HistoriaClinica  # noqa: E402

ANAMNESE = AnamneseBloco(
    queixa="Espinhas no rosto",
    falas=[Fala(quem="Paciente", texto="Espinhas no rosto há 6 meses.")],
    sinais=[],
    em_uso=[],
    antecedentes=[],
    alergias=[],
)
EXAME = ExameBloco(
    exame=ExameDerm(morfologia="Pápulas e pústulas", localizacao="Face", extensao=None, gravidade=None, achados=None),
    complementares=[],
)
HISTORIA = HistoriaBloco(
    historia=HistoriaClinica(
        qp="Espinhas no rosto.",
        hda="Paciente, 34 anos, feminino, refere espinhas no rosto há 6 meses.",
        ap="",
        hp="",
        hf="",
        exame_fisico="Pápulas e pústulas em face.",
        exames_texto="",
    ),
    seguranca=DadosSeguranca(alergias=[], em_uso=[], sinais=[]),
    conflitos=[],
    extras_ia=[],
)


def hipotese(nome="Acne vulgar", cid="L70.0", pct=85):
    ev = EvidenciaDD(lado="favor", texto="pápulas", secao="exameFisico", trecho="Pápulas e pústulas")
    return HipoteseIA(nome=nome, cid=cid, certeza="clinico", pct=pct, evidencias=[ev])


def diagnosticos(*decisoes: str) -> DiagnosticosBloco:
    nomes = [("Acne vulgar", "L70.0", 85), ("Rosácea", "L71.9", 40), ("Foliculite", "L73.9", 20)]
    itens = [ItemDD(hipotese=hipotese(*nomes[i]), decisao=d, propria=False) for i, d in enumerate(decisoes)]  # type: ignore[arg-type]
    return DiagnosticosBloco(itens=itens, nao_pode_perder=None, rastrear=[])


PROPOSTA_VAZIA = CondutaProposta(
    urgencia="rotina",
    emergencia=[],
    tabela=None,
    ia=None,
    origem="sugestão da IA",
    avisos=[],
    acao="REJECT",
    ia_falhou=True,
)


def conduta(*textos: str) -> CondutaBloco:
    t = list(textos) + [""] * (4 - len(textos))
    return CondutaBloco(
        proposta=PROPOSTA_VAZIA,
        diagnostico=DiagnosticoConfirmado(nome="Acne vulgar", cid="L70.0", certeza="clinico"),
        escolha={},
        textos=t,
        receita=[],
        livres=[],
    )
