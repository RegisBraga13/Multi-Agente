"""Título da entrada do prontuário (porte de `tituloNovaEntrada`, frontend/src/prontuario/registro.ts).

Consulta → "Consulta N+1"; retorno → "Consulta N — Retorno" (1º retorno dessa consulta), "— Retorno 2"…,
com N = última consulta. `antes`: (tipo, data 'AAAA-MM-DD', hora 'HH:MM') das entradas anteriores.
"""

from collections.abc import Sequence


def titulo_nova_entrada(antes: Sequence[tuple[str, str, str]], tipo: str) -> str:
    cronologica = [t for t, _, _ in sorted(antes, key=lambda e: f"{e[1]} {e[2]}")]
    n = cronologica.count("consulta")
    if tipo == "consulta":
        return f"Consulta {n + 1}"
    ultima = max((i for i, t in enumerate(cronologica) if t == "consulta"), default=-1)
    retornos = cronologica[ultima + 1 :].count("retorno")
    return f"Consulta {max(n, 1)} — Retorno" + (f" {retornos + 1}" if retornos else "")
