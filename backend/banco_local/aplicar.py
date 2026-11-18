"""Aplica num Postgres vazio: calço do auth (local), todas as migrations do Supabase e a semente local.

python -m banco_local.aplicar postgresql://usuario:senha@host:porta/banco
"""

import sys
from pathlib import Path

import psycopg

PASTA = Path(__file__).parent
MIGRATIONS = PASTA.parent.parent / "supabase" / "migrations"


def arquivos() -> list[Path]:
    return [PASTA / "00_auth_calco.sql", *sorted(MIGRATIONS.glob("*.sql")), PASTA / "99_semente.sql"]


def aplicar(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        for arquivo in arquivos():
            try:
                conn.execute(arquivo.read_text(encoding="utf-8").encode())
            except psycopg.Error as erro:
                raise RuntimeError(f"falhou ao aplicar {arquivo.name}: {erro}") from erro


if __name__ == "__main__":
    aplicar(sys.argv[1])
    print("banco pronto")
