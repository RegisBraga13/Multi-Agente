"""Fuso do consultório: datas e horas que o médico vê (prontuário, idade do paciente) saem daqui.

O banco guarda instantes (timestamptz); a data e a hora da consulta são as do consultório, não as de UTC.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

FUSO_CONSULTORIO = ZoneInfo("America/Sao_Paulo")


def no_consultorio(instante: datetime) -> datetime:
    return instante.astimezone(FUSO_CONSULTORIO)


def data_br(dia: date) -> str:
    """Como o médico lê: dia/mês/ano ("02/10/2026")."""
    return dia.strftime("%d/%m/%Y")


def data_hora_br(instante: datetime) -> str:
    """Dia/mês/ano e hora no fuso do consultório ("13/11/2026 05:00")."""
    return no_consultorio(instante).strftime("%d/%m/%Y %H:%M")
