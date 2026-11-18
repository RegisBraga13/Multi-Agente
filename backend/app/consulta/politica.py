"""Política de decisão (determinística) sobre a proposta de um motor.

Pela Constituição toda proposta vai ao médico; saída estruturalmente inválida é rejeitada antes de qualquer
outra avaliação. A confiança só é registrada (thresholds a calibrar com os casos de teste no marco 3).
"""

from app.contratos.motor import Acao


def decidir(estrutura_valida: bool, confianca: float | None) -> tuple[Acao, list[str]]:
    if not estrutura_valida:
        return "REJECT", ["saída estruturalmente inválida"]
    return "HUMAN_REVIEW", ["toda proposta é revisada pelo médico (Constituição)"]
