"""Fuso do consultório: datas e horas que o médico vê (prontuário, idade do paciente) saem daqui.

O banco guarda instantes (timestamptz); a data e a hora da consulta são as do consultório, não as de UTC.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

FUSO_CONSULTORIO = ZoneInfo("America/Sao_Paulo")


def no_consultorio(instante: datetime) -> datetime:
    return instante.astimezone(FUSO_CONSULTORIO)
