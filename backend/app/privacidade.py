"""Privacidade antes da IA (desenho §7.5).

O que vai ao modelo é desidentificado: sem nome, CPF, telefone, e-mail ou endereço; o paciente vira
"Paciente, 34 anos, feminino". `encontrar_identidade` é a rede de segurança: a chamada de motor recusa
qualquer dado em que ela encontre algo.
"""

import re
from typing import Literal

PADROES_IDENTIDADE = {
    "CPF": re.compile(r"(?<!\d)\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s-]?\d{2}(?!\d)"),
    # com ou sem DDD; separadores comuns: espaço, ponto, hífen ("98765-4321", "(11) 98765 4321", "9 8765 4321")
    "telefone": re.compile(r"(?<!\d)(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}(?!\d)"),
    "e-mail": re.compile(r"\S+@\S+\.\S+"),
}


def encontrar_identidade(texto: str) -> list[str]:
    """Tipos de dado de identidade encontrados no texto ([] = nenhum)."""
    return [tipo for tipo, padrao in PADROES_IDENTIDADE.items() if padrao.search(texto)]


def descrever_paciente(idade: int, sexo: Literal["F", "M"], estado_civil: str | None, profissao: str | None) -> str:
    """'Paciente, 52 anos, masculino, casado, comerciante' — o que não foi informado não entra."""
    partes = [f"Paciente, {idade} {'ano' if idade == 1 else 'anos'}", "feminino" if sexo == "F" else "masculino"]
    partes += [x for x in (estado_civil, profissao) if x]
    return ", ".join(partes)
