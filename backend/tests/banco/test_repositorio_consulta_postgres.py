"""Os mesmos cenários do repositório em memória, agora no Postgres sob RLS (decisão 0003)."""

from datetime import UTC, date, datetime

import psycopg
import pytest

from app.consulta.repositorio import ConsultaFinalizada
from app.consulta.repositorio_postgres import RepositorioConsultasPostgres
from app.contratos.consulta_blocos import NovaConsulta
from app.contratos.paciente import NovoPaciente
from app.pacientes.repositorio_postgres import RepositorioPacientesPostgres
from tests.banco.conftest import MEDICO_A, MEDICO_B
from tests.fabrica import DADOS_MINIMOS, EXAME
from tests.test_repositorio_consulta import (  # noqa: F401 (os cenários rodam aqui com a fixture abaixo)
    test_adendo_so_depois_de_finalizar,
    test_consulta_de_outro_medico_nao_existe,
    test_criar_e_buscar,
    test_data_e_hora_no_fuso_do_consultorio,
    test_desatualizar_so_as_existentes,
    test_documento_um_por_tipo,
    test_finalizada_recusa_qualquer_escrita,
    test_gravar_bloco_desatualiza_as_seguintes_junto,
    test_gravar_bloco_substitui_e_zera_desatualizado,
    test_paciente_de_outro_medico_nao_vira_consulta,
    test_pacientes_com_prontuario_so_finalizados_e_so_do_medico,
    test_prontuario_mais_recente_no_topo_com_titulo,
    test_rascunho_ia_so_grava_se_nada_mudou,
)

pytestmark = pytest.mark.banco
QUANDO = datetime(2026, 11, 13, 8, 0, tzinfo=UTC)


@pytest.fixture
def ambiente(url_banco):
    paciente = RepositorioPacientesPostgres(url_banco).criar(
        MEDICO_A, NovoPaciente(nome="Paciente Teste", nascimento=date(1992, 3, 10), sexo="F")
    )
    return RepositorioConsultasPostgres(url_banco), MEDICO_A, MEDICO_B, paciente.id


def test_rls_isola_medicos(ambiente, url_banco):
    repo, a, _, paciente = ambiente
    c = repo.criar(
        a, NovaConsulta(paciente_id=paciente, tipo="consulta", modalidade="presencial", agendada_para=QUANDO)
    )
    repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)
    with psycopg.connect(url_banco) as conn:
        conn.execute("set local role authenticated")
        conn.execute("select set_config('request.jwt.claims', %s, true)", (f'{{"sub": "{MEDICO_B}"}}',))
        assert conn.execute("select count(*) from clinical_facts where encounter_id = %s", (c.id,)).fetchone()[0] == 0


def test_gatilho_de_finalizada_vira_consulta_finalizada(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(
        a, NovaConsulta(paciente_id=paciente, tipo="consulta", modalidade="presencial", agendada_para=QUANDO)
    )
    repo.finalizar(a, c.id, DADOS_MINIMOS, {}, QUANDO)
    repo._aberta = lambda conn, cid: None  # tira a checagem do servidor: sobra o gatilho do banco
    with pytest.raises(ConsultaFinalizada):
        repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)
