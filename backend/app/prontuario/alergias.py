"""Alergias que o prontuário já conhece: valem em toda consulta nova do paciente (segurança), não só no retorno."""

from collections.abc import Iterable
from uuid import UUID

from app.consulta.repositorio import RepositorioConsultas
from app.contratos.consulta import Alergia
from app.contratos.consulta_blocos import AnamneseBloco


def juntar_alergias(*listas: Iterable[Alergia]) -> list[Alergia]:
    """Sem repetir a mesma substância (a primeira vence: a resposta de hoje antes da do prontuário)."""
    vistas: dict[str, Alergia] = {}
    for lista in listas:
        for a in lista:
            vistas.setdefault(a.substancia.strip().casefold(), a)
    return list(vistas.values())


def alergias_do_prontuario(repo: RepositorioConsultas, medico: UUID, paciente_id: UUID) -> list[Alergia]:
    """As alergias registradas nas anamneses das consultas e retornos já finalizados do paciente."""
    listas = []
    for entrada in repo.prontuario(medico, paciente_id):
        bloco = repo.buscar(medico, entrada.id).bloco("anamnese")
        if bloco is not None:
            listas.append(AnamneseBloco.model_validate(bloco.conteudo).alergias)
    return juntar_alergias(*listas)
