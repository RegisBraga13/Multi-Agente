from datetime import UTC, datetime

import pytest

from app.consulta.repositorio import ConsultaFinalizada
from app.consulta.servico import ErroEtapa, editar, exigir_predecessor, oficializar, seguintes
from app.contratos.consulta_blocos import NovaConsulta
from tests.fabrica import ANAMNESE, DADOS_MINIMOS, EXAME, HISTORIA, conduta, diagnosticos

QUANDO = datetime(2026, 11, 13, 8, 0, tzinfo=UTC)


@pytest.fixture
def consulta(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(
        a, NovaConsulta(paciente_id=paciente, tipo="consulta", modalidade="presencial", agendada_para=QUANDO)
    )
    return repo, a, c.id


def oficializar_ate(repo, a, cid, ultima):
    conteudos = {
        "anamnese": ANAMNESE,
        "exame": EXAME,
        "historia": HISTORIA,
        "diagnosticos": diagnosticos("confirmada"),
        "conduta": conduta("Rotina para pele oleosa."),
    }
    for etapa, conteudo in conteudos.items():
        editar(repo, a, cid, etapa, conteudo)
        oficializar(repo, a, cid, etapa, QUANDO)
        if etapa == ultima:
            return


def test_seguintes():
    assert seguintes("exame") == ["historia", "diagnosticos", "conduta"] and seguintes("conduta") == []


def test_editar_grava_revisado(consulta):
    repo, a, cid = consulta
    c = editar(repo, a, cid, "anamnese", ANAMNESE)
    assert c.bloco("anamnese").estado == "revisado_medico"


def test_oficializar_primeira_etapa(consulta):
    repo, a, cid = consulta
    editar(repo, a, cid, "anamnese", ANAMNESE)
    b = oficializar(repo, a, cid, "anamnese", QUANDO).bloco("anamnese")
    assert (b.estado, b.oficializado_em) == ("oficializado", QUANDO)


def test_oficializar_sem_bloco_e_erro(consulta):
    repo, a, cid = consulta
    with pytest.raises(ErroEtapa, match="Anamnese"):
        oficializar(repo, a, cid, "anamnese", QUANDO)


def test_oficializar_sem_anterior_oficializada_e_erro(consulta):
    repo, a, cid = consulta
    editar(repo, a, cid, "exame", EXAME)
    with pytest.raises(ErroEtapa, match="Oficialize Anamnese antes"):
        oficializar(repo, a, cid, "exame", QUANDO)


def test_oficializar_com_anterior_desatualizada_e_erro(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "historia")
    editar(repo, a, cid, "exame", EXAME)  # exame volta a revisado; história fica desatualizada
    editar(repo, a, cid, "diagnosticos", diagnosticos("confirmada"))
    with pytest.raises(ErroEtapa, match="História clínica"):
        oficializar(repo, a, cid, "diagnosticos", QUANDO)


def test_editar_etapa_oficializada_desatualiza_as_seguintes(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "conduta")
    c = editar(repo, a, cid, "anamnese", ANAMNESE)
    assert c.bloco("anamnese").estado == "revisado_medico" and not c.bloco("anamnese").desatualizado
    assert all(c.bloco(e).desatualizado for e in ("exame", "historia", "diagnosticos", "conduta"))


def test_reoficializar_desatualiza_as_seguintes(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "diagnosticos")
    editar(repo, a, cid, "historia", HISTORIA)
    c = oficializar(repo, a, cid, "historia", QUANDO)
    assert c.bloco("historia").estado == "oficializado" and c.bloco("diagnosticos").desatualizado


def test_reoficializar_tira_a_marca_da_propria_etapa(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "historia")
    editar(repo, a, cid, "exame", EXAME)
    oficializar(repo, a, cid, "exame", QUANDO)
    c = oficializar(repo, a, cid, "historia", QUANDO)
    assert not c.bloco("historia").desatualizado


def test_diagnosticos_sem_confirmado_nao_oficializa(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "historia")
    editar(repo, a, cid, "diagnosticos", diagnosticos("pendente", "descartada"))
    with pytest.raises(ErroEtapa, match="Confirme ao menos um diagnóstico"):
        oficializar(repo, a, cid, "diagnosticos", QUANDO)


def test_conduta_sem_texto_nao_oficializa(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "diagnosticos")
    editar(repo, a, cid, "conduta", conduta("", "  "))
    with pytest.raises(ErroEtapa, match="Escreva a conduta"):
        oficializar(repo, a, cid, "conduta", QUANDO)


def test_exigir_predecessor(consulta):
    repo, a, cid = consulta
    with pytest.raises(ErroEtapa, match="Oficialize Exame físico antes"):
        exigir_predecessor(repo.buscar(a, cid), "historia")
    oficializar_ate(repo, a, cid, "exame")
    assert exigir_predecessor(repo.buscar(a, cid), "historia").etapa == "exame"


def test_consulta_finalizada_nao_muda(consulta):
    repo, a, cid = consulta
    oficializar_ate(repo, a, cid, "anamnese")
    repo.finalizar(a, cid, DADOS_MINIMOS, {}, QUANDO)
    with pytest.raises(ConsultaFinalizada):
        editar(repo, a, cid, "exame", EXAME)
    with pytest.raises(ConsultaFinalizada):
        oficializar(repo, a, cid, "anamnese", QUANDO)
