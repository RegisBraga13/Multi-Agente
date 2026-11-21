"""Pacientes no Postgres, sempre sob a RLS do médico (decisão 0003)."""

import json
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from typing import Any
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from app.contratos.paciente import NovoPaciente, Paciente
from app.pacientes.repositorio import ErroCpfDuplicado

_COLUNAS = "id, full_name, birth_date, sex, marital_status, occupation, cpf, phone, created_at"


@contextmanager
def transacao_do_medico(url: str, medico_id: UUID) -> Iterator[psycopg.Connection[dict[str, Any]]]:
    """Abre uma transação no papel `authenticated` com o `sub` do médico: a RLS filtra tudo."""
    with psycopg.connect(url, row_factory=dict_row) as conn:
        conn.execute("set local role authenticated")
        conn.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": str(medico_id)}),))
        yield conn


def _paciente(linha: dict[str, Any]) -> Paciente:
    return Paciente(
        id=linha["id"],
        nome=linha["full_name"],
        nascimento=linha["birth_date"],
        sexo=linha["sex"],
        estado_civil=linha["marital_status"],
        profissao=linha["occupation"],
        cpf=linha["cpf"],
        telefone=linha["phone"],
        criado_em=linha["created_at"],
    )


class RepositorioPacientesPostgres:
    def __init__(self, url: str) -> None:
        self.url = url

    def criar(self, medico_id: UUID, novo: NovoPaciente) -> Paciente:
        valores = (
            medico_id,
            novo.nome,
            novo.nascimento,
            novo.sexo,
            novo.estado_civil,
            novo.profissao,
            novo.cpf,
            novo.telefone,
        )
        try:
            with transacao_do_medico(self.url, medico_id) as conn:
                linha = conn.execute(
                    "insert into patients (doctor_id, full_name, birth_date, sex, marital_status, occupation, cpf, phone)"
                    f" values (%s, %s, %s, %s, %s, %s, %s, %s) returning {_COLUNAS}",
                    valores,
                ).fetchone()
        except psycopg.errors.UniqueViolation as erro:
            raise ErroCpfDuplicado from erro
        if linha is None:
            raise RuntimeError("o banco não devolveu o paciente criado")
        return _paciente(linha)

    def buscar(self, medico_id: UUID, paciente_id: UUID) -> Paciente | None:
        with transacao_do_medico(self.url, medico_id) as conn:
            linha = conn.execute(f"select {_COLUNAS} from patients where id = %s", (paciente_id,)).fetchone()
        return _paciente(linha) if linha else None

    def procurar(self, medico_id: UUID, nome: str, nascimento: date) -> Paciente | None:
        with transacao_do_medico(self.url, medico_id) as conn:
            linha = conn.execute(
                f"select {_COLUNAS} from patients where lower(btrim(full_name)) = lower(btrim(%s))"
                " and birth_date = %s order by created_at limit 1",
                (nome, nascimento),
            ).fetchone()
        return _paciente(linha) if linha else None
