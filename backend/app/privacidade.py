"""Privacidade antes da IA (desenho §7.5).

O que vai ao modelo é desidentificado: sem nome, CPF, telefone, e-mail ou endereço; o paciente vira
"Paciente, 34 anos, feminino". `encontrar_identidade` é a rede de segurança: a chamada de motor recusa
qualquer dado em que ela encontre algo.
"""

import re
from datetime import date
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


def idade_em_texto(nascimento: date, quando: date) -> str:
    """Até 2 anos em meses ("8 meses"); no primeiro mês em dias ("12 dias"); depois em anos (autor, 26/11/2026)."""
    meses = (quando.year - nascimento.year) * 12 + quando.month - nascimento.month - (quando.day < nascimento.day)
    if meses < 1:
        dias = (quando - nascimento).days
        return f"{dias} {'dia' if dias == 1 else 'dias'}"
    if meses < 24:
        return f"{meses} {'mês' if meses == 1 else 'meses'}"
    anos = meses // 12
    return f"{anos} anos"


def descrever_paciente(
    idade: int | str, sexo: Literal["F", "M", "I"], estado_civil: str | None, profissao: str | None
) -> str:
    """'Paciente, 52 anos, masculino, casado, comerciante' — o que não foi informado não entra.
    `idade`: anos, ou o texto pronto de `idade_em_texto` ("8 meses")."""
    texto = idade if isinstance(idade, str) else f"{idade} {'ano' if idade == 1 else 'anos'}"
    partes = [
        f"Paciente, {texto}",
        {"F": "feminino", "M": "masculino", "I": "intersexo"}[sexo],
    ]
    partes += [x for x in (estado_civil, profissao) if x]
    return ", ".join(partes)
