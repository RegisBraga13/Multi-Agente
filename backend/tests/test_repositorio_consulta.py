"""Cenários do repositório da consulta. A fixture `ambiente` (conftest) roda em memória e, com -m banco, no Postgres."""

from datetime import UTC, datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.consulta.repositorio import ConsultaAberta, ConsultaFinalizada, ConsultaNaoEncontrada
from app.contratos.consulta import ExameDerm
from app.contratos.consulta_blocos import Documento, ExameBloco, NovaConsulta
from app.contratos.motor import RegistroDecisao
from tests.fabrica import DADOS_MINIMOS

QUANDO = datetime(2026, 11, 13, 8, 0, tzinfo=UTC)
BRT = timezone(timedelta(hours=-3))  # horário do consultório (sem horário de verão em 2026)
EXAME = ExameBloco(
    exame=ExameDerm(morfologia="Pápulas", localizacao="Face", extensao=None, gravidade=None, achados=None),
    complementares=[],
)


def nova(paciente_id, quando=QUANDO, tipo="consulta"):
    return NovaConsulta(paciente_id=paciente_id, tipo=tipo, modalidade="presencial", agendada_para=quando)


def registro():
    return RegistroDecisao(
        decision_id=uuid4(),
        motor="historia",
        modelo="falso",
        versao_modelo="0",
        versao_esquema=1,
        versao_prompt="v1",
        confianca=0.5,
        acao="HUMAN_REVIEW",
        tokens_entrada=1,
        tokens_saida=1,
        quando=QUANDO,
    )


def test_criar_e_buscar(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    achada = repo.buscar(a, c.id)
    assert achada.id == c.id and achada.blocos == [] and achada.finalizada_em is None and achada.tipo == "consulta"


def test_paciente_de_outro_medico_nao_vira_consulta(ambiente):
    repo, _, b, paciente = ambiente
    with pytest.raises(ConsultaNaoEncontrada):
        repo.criar(b, nova(paciente))


def test_consulta_de_outro_medico_nao_existe(ambiente):
    repo, a, b, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    with pytest.raises(ConsultaNaoEncontrada):
        repo.buscar(b, c.id)
    with pytest.raises(ConsultaNaoEncontrada):
        repo.buscar(a, uuid4())


def test_gravar_bloco_substitui_e_zera_desatualizado(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)
    repo.desatualizar(a, c.id, ["exame"])
    assert repo.buscar(a, c.id).bloco("exame").desatualizado
    repo.gravar_bloco(a, c.id, "exame", "oficializado", EXAME, QUANDO)
    b = repo.buscar(a, c.id).bloco("exame")
    assert (b.estado, b.desatualizado, b.oficializado_em) == ("oficializado", False, QUANDO)
    assert b.conteudo["exame"]["morfologia"] == "Pápulas"


def test_desatualizar_so_as_existentes(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)
    repo.desatualizar(a, c.id, ["exame", "historia", "conduta"])
    assert [b.etapa for b in repo.buscar(a, c.id).blocos] == ["exame"]


def test_documento_um_por_tipo(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    repo.gravar_documento(a, c.id, Documento(tipo="receita", estado="rascunho", texto="v1", registro=None))
    repo.gravar_documento(a, c.id, Documento(tipo="receita", estado="enviado", texto="v2", registro=None))
    [d] = repo.documentos(a, c.id)
    assert (d.estado, d.texto) == ("enviado", "v2")


def test_finalizada_recusa_qualquer_escrita(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    repo.registrar_proposta(a, c.id, registro(), {"x": 1})
    repo.finalizar(a, c.id, DADOS_MINIMOS, {}, QUANDO)
    assert repo.buscar(a, c.id).finalizada_em == QUANDO
    with pytest.raises(ConsultaFinalizada):
        repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)
    with pytest.raises(ConsultaFinalizada):
        repo.gravar_documento(a, c.id, Documento(tipo="receita", estado="rascunho", texto="x", registro=None))
    with pytest.raises(ConsultaFinalizada):
        repo.registrar_proposta(a, c.id, registro(), None)
    with pytest.raises(ConsultaFinalizada):
        repo.finalizar(a, c.id, DADOS_MINIMOS, {}, QUANDO)
    with pytest.raises(ConsultaFinalizada):
        repo.desatualizar(a, c.id, ["exame"])


def test_adendo_so_depois_de_finalizar(ambiente):
    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    with pytest.raises(ConsultaAberta):
        repo.adicionar_adendo(a, c.id, "texto", "motivo", QUANDO)
    repo.finalizar(a, c.id, DADOS_MINIMOS, {}, QUANDO)
    repo.adicionar_adendo(a, c.id, "Biópsia: carcinoma basocelular.", "resultado de exame", QUANDO)
    [e] = repo.prontuario(a, paciente)
    assert [x.texto for x in e.adendos] == ["Biópsia: carcinoma basocelular."]


def test_prontuario_mais_recente_no_topo_com_titulo(ambiente):
    repo, a, b, paciente = ambiente
    c1 = repo.criar(a, nova(paciente, datetime(2026, 10, 1, 8, 0, tzinfo=BRT)))
    c2 = repo.criar(a, nova(paciente, datetime(2026, 11, 1, 9, 30, tzinfo=BRT), tipo="retorno"))
    aberta = repo.criar(a, nova(paciente, datetime(2026, 11, 20, 8, 0, tzinfo=BRT)))
    repo.finalizar(a, c1.id, DADOS_MINIMOS, {}, QUANDO)
    repo.finalizar(a, c2.id, DADOS_MINIMOS, {"hda": "editada"}, QUANDO)
    entradas = repo.prontuario(a, paciente)
    assert [(e.titulo, e.hora) for e in entradas] == [("Consulta 1 — Retorno", "09:30"), ("Consulta 1", "08:00")]
    assert entradas[0].edicoes == {"hda": "editada"} and aberta.id not in {e.id for e in entradas}
    assert repo.prontuario(b, paciente) == []


def _oficial(repo, a, cid, etapa, conteudo):
    repo.gravar_bloco(a, cid, etapa, "oficializado", conteudo, QUANDO)


def test_gravar_bloco_desatualiza_as_seguintes_junto(ambiente):
    from tests.fabrica import ANAMNESE, HISTORIA

    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    _oficial(repo, a, c.id, "anamnese", ANAMNESE)
    _oficial(repo, a, c.id, "historia", HISTORIA)
    repo.gravar_bloco(a, c.id, "anamnese", "revisado_medico", ANAMNESE, None, desatualizar=["exame", "historia"])
    assert repo.buscar(a, c.id).bloco("historia").desatualizado


def test_rascunho_ia_so_grava_se_nada_mudou(ambiente):
    from tests.fabrica import HISTORIA

    repo, a, _, paciente = ambiente
    c = repo.criar(a, nova(paciente))
    _oficial(repo, a, c.id, "exame", EXAME)
    em = repo.buscar(a, c.id).bloco("exame").oficializado_em
    assert repo.gravar_rascunho_ia(a, c.id, "historia", HISTORIA, "exame", em) == "gravado"
    assert repo.gravar_rascunho_ia(a, c.id, "historia", HISTORIA, "exame", em) == "gravado"  # rascunho é trocado
    repo.gravar_bloco(a, c.id, "historia", "revisado_medico", HISTORIA, None)
    assert repo.gravar_rascunho_ia(a, c.id, "historia", HISTORIA, "exame", em) == "revisado"
    repo.gravar_bloco(a, c.id, "exame", "revisado_medico", EXAME, None)  # o médico mexeu no exame
    assert repo.gravar_rascunho_ia(a, c.id, "historia", HISTORIA, "exame", em) == "mudou"


def test_data_e_hora_no_fuso_do_consultorio(ambiente):
    from datetime import timedelta, timezone

    repo, a, _, paciente = ambiente
    noite = datetime(2026, 11, 13, 22, 0, tzinfo=timezone(timedelta(hours=-3)))  # 01:00 do dia 14 em UTC
    c = repo.criar(a, nova(paciente, noite.astimezone(UTC)))
    repo.finalizar(a, c.id, DADOS_MINIMOS, {}, QUANDO)
    [e] = repo.prontuario(a, paciente)
    assert (str(e.data), e.hora) == ("2026-11-13", "22:00")
