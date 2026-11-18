"""Postgres local em Docker com calço do auth + migrations + semente (testes marcados `banco`)."""

import json
import shutil
import subprocess
import time
from collections.abc import Iterator
from uuid import UUID

import psycopg
import pytest

from banco_local.aplicar import aplicar

MEDICO_A = UUID("00000000-0000-4000-8000-000000000001")
MEDICO_B = UUID("00000000-0000-4000-8000-000000000002")


def _docker(*args: str) -> str:
    return subprocess.run(["docker", *args], check=True, capture_output=True, text=True).stdout.strip()


@pytest.fixture(scope="session")
def url_banco() -> Iterator[str]:
    if shutil.which("docker") is None or subprocess.run(["docker", "info"], capture_output=True).returncode != 0:
        pytest.fail("Docker não está rodando. Inicie o Docker Desktop (testes marcados 'banco').")
    conteiner = _docker("run", "-d", "--rm", "-P", "-e", "POSTGRES_PASSWORD=teste", "postgres:16-alpine")
    try:
        porta = _docker("port", conteiner, "5432/tcp").splitlines()[0].rsplit(":", 1)[1]
        url = f"postgresql://postgres:teste@127.0.0.1:{porta}/postgres"
        for _ in range(60):
            try:
                with psycopg.connect(url, connect_timeout=2) as conn:
                    conn.execute("select 1")
                break
            except psycopg.OperationalError:
                time.sleep(1)
        else:
            pytest.fail("Postgres não ficou pronto em 60 s")
        aplicar(url)
        with psycopg.connect(url, autocommit=True) as conn:
            meta = {"crm": "654321", "uf": "RJ", "nome": "Médico B (fictício)", "especialidade": "dermatologia"}
            conn.execute(
                "insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
                (MEDICO_B, "medico.b@exemplo.invalid", json.dumps(meta)),
            )
        yield url
    finally:
        subprocess.run(["docker", "rm", "-f", conteiner], capture_output=True)


def como_medico(conn: psycopg.Connection, medico_id: UUID) -> None:
    """Dentro da transação atual: papel authenticated + sub do médico (a RLS passa a valer)."""
    conn.execute("set local role authenticated")
    conn.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": str(medico_id)}),))
