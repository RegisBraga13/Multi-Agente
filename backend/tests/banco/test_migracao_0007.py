import psycopg
import pytest

from tests.banco.conftest import MEDICO_A, MEDICO_B, como_medico

pytestmark = pytest.mark.banco

BLOCOS = ["transcripts", "clinical_facts", "clinical_histories", "diagnostic_hypotheses", "care_plans"]
NOVAS = ["patients", "encounters", *BLOCOS, "documents", "ai_proposals", "addenda"]


def novo_paciente(conn, medico, cpf=None):
    como_medico(conn, medico)
    sql = (
        "insert into patients (doctor_id, full_name, birth_date, sex, cpf)"
        " values (%s, 'Paciente Teste', '1990-01-01', 'F', %s) returning id"
    )
    return conn.execute(sql, (medico, cpf)).fetchone()[0]


def nova_consulta(conn, medico, paciente):
    sql = (
        "insert into encounters (doctor_id, patient_id, kind, modality, scheduled_at)"
        " values (%s, %s, 'consulta', 'presencial', now()) returning id"
    )
    return conn.execute(sql, (medico, paciente)).fetchone()[0]


def finalizar(conn, consulta):
    sql = "update encounters set finalized_at = now(), record = '{}'::jsonb, record_schema_version = 1 where id = %s"
    conn.execute(sql, (consulta,))


def novo_bloco(conn, tabela, consulta, status="rascunho_ia"):
    sql = f"insert into {tabela} (doctor_id, encounter_id, status, content, schema_version) values (%s, %s, %s, '{{}}', 1)"
    conn.execute(sql, (MEDICO_A, consulta, status))


def test_paciente_ganha_id_proprio(url_banco):
    with psycopg.connect(url_banco) as conn:
        assert novo_paciente(conn, MEDICO_A) is not None


def test_id_do_paciente_nunca_muda(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        with pytest.raises(psycopg.Error, match="id"):
            conn.execute("update patients set id = gen_random_uuid() where id = %s", (pid,))


def test_medico_nao_ve_paciente_de_outro(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        conn.commit()
        como_medico(conn, MEDICO_B)
        assert conn.execute("select count(*) from patients where id = %s", (pid,)).fetchone()[0] == 0


def test_medico_nao_insere_em_nome_de_outro(url_banco):
    with psycopg.connect(url_banco) as conn:
        como_medico(conn, MEDICO_B)
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute(
                "insert into patients (doctor_id, full_name, birth_date, sex) values (%s, 'X', '1990-01-01', 'M')",
                (MEDICO_A,),
            )


def test_consulta_com_paciente_de_outro_medico_e_recusada(url_banco):
    with psycopg.connect(url_banco) as conn:
        pid = novo_paciente(conn, MEDICO_A)
        conn.commit()
        como_medico(conn, MEDICO_B)
        with pytest.raises(psycopg.Error):
            nova_consulta(conn, MEDICO_B, pid)


def test_consulta_finalizada_nao_muda(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        finalizar(conn, cid)
        with pytest.raises(psycopg.Error, match="finalizada"):
            conn.execute("""update encounters set record = '{"x": 1}'::jsonb where id = %s""", (cid,))


def test_consulta_finalizada_nao_pode_ser_apagada(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        finalizar(conn, cid)
        conn.execute("reset role")
        with pytest.raises(psycopg.Error, match="finalizada"):
            conn.execute("delete from encounters where id = %s", (cid,))


def test_finalizar_exige_registro(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute("update encounters set finalized_at = now() where id = %s", (cid,))


def test_bloco_de_consulta_finalizada_nao_muda(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        novo_bloco(conn, "clinical_histories", cid)
        finalizar(conn, cid)
        with pytest.raises(psycopg.Error, match="finalizada"):
            conn.execute("""update clinical_histories set content = '{"a": 1}' where encounter_id = %s""", (cid,))


@pytest.mark.parametrize("tabela", BLOCOS)
def test_oficializado_exige_data(url_banco, tabela):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        with pytest.raises(psycopg.errors.CheckViolation):
            novo_bloco(conn, tabela, cid, "oficializado")


def test_um_bloco_por_consulta(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        novo_bloco(conn, "care_plans", cid)
        with pytest.raises(psycopg.errors.UniqueViolation):
            novo_bloco(conn, "care_plans", cid)


def test_adendo_so_em_consulta_finalizada_e_so_insere(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        sql = (
            "insert into addenda (doctor_id, encounter_id, text, reason)"
            " values (%s, %s, 'Corrige dose', 'erro de digitação') returning id"
        )
        conn.execute("savepoint s")
        with pytest.raises(psycopg.Error, match="finalizada"):
            conn.execute(sql, (MEDICO_A, cid))
        conn.execute("rollback to savepoint s")
        finalizar(conn, cid)
        aid = conn.execute(sql, (MEDICO_A, cid)).fetchone()[0]
        conn.execute("reset role")  # nem o dono do banco altera um adendo
        conn.execute("savepoint t")
        with pytest.raises(psycopg.Error, match="somente inserção"):
            conn.execute("update addenda set text = 'x' where id = %s", (aid,))
        conn.execute("rollback to savepoint t")
        with pytest.raises(psycopg.Error, match="somente inserção"):
            conn.execute("delete from addenda where id = %s", (aid,))


def test_proposta_da_ia_so_insere_e_nao_aceita_auto_execute(url_banco):
    with psycopg.connect(url_banco) as conn:
        cid = nova_consulta(conn, MEDICO_A, novo_paciente(conn, MEDICO_A))
        sql = (
            "insert into ai_proposals (decision_id, doctor_id, encounter_id, motor, model, model_version, schema_version,"
            " prompt_version, confidence, action, tokens_in, tokens_out) values"
            " (gen_random_uuid(), %s, %s, 'dd', 'falso', '0', 1, 'v1', 0.8, %s, 0, 0) returning decision_id"
        )
        did = conn.execute(sql, (MEDICO_A, cid, "HUMAN_REVIEW")).fetchone()[0]
        conn.execute("savepoint s")
        with pytest.raises(psycopg.errors.CheckViolation):
            conn.execute(sql, (MEDICO_A, cid, "AUTO_EXECUTE"))
        conn.execute("rollback to savepoint s")
        conn.execute("reset role")
        with pytest.raises(psycopg.Error, match="somente inserção"):
            conn.execute("update ai_proposals set action = 'REJECT' where decision_id = %s", (did,))


def test_cpf_e_opcional_e_unico_por_medico(url_banco):
    with psycopg.connect(url_banco) as conn:
        novo_paciente(conn, MEDICO_A, cpf=None)
        novo_paciente(conn, MEDICO_A, cpf=None)
        novo_paciente(conn, MEDICO_A, cpf="11122233344")
        with pytest.raises(psycopg.errors.UniqueViolation):
            novo_paciente(conn, MEDICO_A, cpf="11122233344")


def test_todas_as_tabelas_novas_tem_rls(url_banco):
    with psycopg.connect(url_banco) as conn:
        linhas = conn.execute(
            "select relname, relrowsecurity from pg_class"
            " where relname = any(%s) and relnamespace = 'public'::regnamespace",
            (NOVAS,),
        ).fetchall()
    assert sorted(linhas) == sorted((t, True) for t in NOVAS)
