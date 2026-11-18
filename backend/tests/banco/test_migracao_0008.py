"""Correções da revisão final (migration 0008): vínculos imutáveis, auditoria sem dado pessoal, trava contra corrida."""

import threading
import time

import psycopg
import pytest

from banco_local.aplicar import aplicar
from tests.banco.conftest import MEDICO_A, como_medico
from tests.banco.test_migracao_0007 import finalizar, nova_consulta, novo_bloco, novo_paciente

pytestmark = pytest.mark.banco


def test_bloco_nao_sai_de_consulta_finalizada(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        finalizada, aberta = nova_consulta(conn, MEDICO_A, pid), nova_consulta(conn, MEDICO_A, pid)
        novo_bloco(conn, "clinical_histories", finalizada)
        finalizar(conn, finalizada)
        with pytest.raises(psycopg.Error, match="finalizada|vínculos"):
            conn.execute(
                "update clinical_histories set encounter_id = %s where encounter_id = %s", (aberta, finalizada)
            )


def test_documento_nao_sai_de_consulta_finalizada(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        finalizada, aberta = nova_consulta(conn, MEDICO_A, pid), nova_consulta(conn, MEDICO_A, pid)
        conn.execute(
            "insert into documents (doctor_id, encounter_id, kind, content) values (%s, %s, 'receita', '{}')",
            (MEDICO_A, finalizada),
        )
        finalizar(conn, finalizada)
        with pytest.raises(psycopg.Error, match="finalizada|vínculos"):
            conn.execute("update documents set encounter_id = %s where encounter_id = %s", (aberta, finalizada))


def test_bloco_nao_muda_de_consulta_nem_aberta(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        a, b = nova_consulta(conn, MEDICO_A, pid), nova_consulta(conn, MEDICO_A, pid)
        novo_bloco(conn, "care_plans", a)
        with pytest.raises(psycopg.Error, match="vínculos"):
            conn.execute("update care_plans set encounter_id = %s where encounter_id = %s", (b, a))


def test_consulta_nao_muda_de_paciente(url_banco):
    with psycopg.connect(url_banco) as conn:
        p1, p2 = novo_paciente(conn, MEDICO_A), novo_paciente(conn, MEDICO_A)
        cid = nova_consulta(conn, MEDICO_A, p1)
        with pytest.raises(psycopg.Error, match="vínculos"):
            conn.execute("update encounters set patient_id = %s where id = %s", (p2, cid))


def test_auditoria_nao_guarda_dado_pessoal(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        conn.execute("update patients set full_name = 'Nome Secreto Fictício' where id = %s", (pid,))
        conn.execute("reset role")
        [mudancas] = conn.execute(
            "select changes from audit_log where entity = 'patients' and entity_id = %s and action = 'update'",
            (str(pid),),
        ).fetchone()
    assert "Nome Secreto" not in str(mudancas)
    assert "full_name" in mudancas["colunas"]


def test_bloco_que_corre_com_a_finalizacao_e_recusado(url_banco):
    with psycopg.connect(url_banco) as setup:
        cid = nova_consulta(setup, MEDICO_A, novo_paciente(setup, MEDICO_A))
        setup.commit()
    finalizando = psycopg.connect(url_banco)
    como_medico(finalizando, MEDICO_A)
    finalizar(finalizando, cid)  # ainda não confirmada
    resultado: dict[str, BaseException | None] = {}

    def escrever_bloco() -> None:
        try:
            with psycopg.connect(url_banco) as conn:
                como_medico(conn, MEDICO_A)
                novo_bloco(conn, "transcripts", cid)
            resultado["erro"] = None
        except BaseException as erro:  # noqa: BLE001
            resultado["erro"] = erro

    t = threading.Thread(target=escrever_bloco)
    t.start()
    time.sleep(1.5)
    finalizando.commit()
    finalizando.close()
    t.join(timeout=10)
    assert resultado["erro"] is not None and "finalizada" in str(resultado["erro"])


def test_aplicar_de_novo_nao_quebra(url_banco):
    aplicar(url_banco)
    aplicar(url_banco)
    with psycopg.connect(url_banco) as conn:
        n = conn.execute("select count(*) from banco_local.migracoes_aplicadas").fetchone()[0]
    assert n >= 8
