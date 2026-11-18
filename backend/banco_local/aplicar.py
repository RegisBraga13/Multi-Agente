"""Aplica num Postgres: calço do auth (local), as migrations do Supabase que faltam e a semente local.

Pode rodar de novo no mesmo banco: cada migration aplicada fica anotada em banco_local.migracoes_aplicadas
e não roda outra vez (calço e semente já são idempotentes).

python -m banco_local.aplicar postgresql://usuario:senha@host:porta/banco
"""

import sys
from pathlib import Path

import psycopg

PASTA = Path(__file__).parent
MIGRATIONS = PASTA.parent.parent / "supabase" / "migrations"


def migrations() -> list[Path]:
    return sorted(MIGRATIONS.glob("*.sql"))


def _executar(conn: psycopg.Connection, arquivo: Path) -> None:
    try:
        conn.execute(arquivo.read_text(encoding="utf-8").encode())
    except psycopg.Error as erro:
        raise RuntimeError(f"falhou ao aplicar {arquivo.name}: {erro}") from erro


def aplicar(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        _executar(conn, PASTA / "00_auth_calco.sql")
        conn.execute("create schema if not exists banco_local")
        conn.execute(
            "create table if not exists banco_local.migracoes_aplicadas"
            " (nome text primary key, aplicada_em timestamptz not null default now())"
        )
        ja = {linha[0] for linha in conn.execute("select nome from banco_local.migracoes_aplicadas")}
        for arquivo in migrations():
            if arquivo.name in ja:
                continue
            with conn.transaction():
                _executar(conn, arquivo)
                conn.execute("insert into banco_local.migracoes_aplicadas (nome) values (%s)", (arquivo.name,))
        _executar(conn, PASTA / "99_semente.sql")


if __name__ == "__main__":
    aplicar(sys.argv[1])
    print("banco pronto")
