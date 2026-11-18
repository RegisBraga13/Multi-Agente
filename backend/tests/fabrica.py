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
