"""Agenda pela API: o paciente pede e envia o formulário; o médico vê na agenda dele."""

import base64
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.agenda.repositorio import RepositorioAgendaMemoria
from app.aplicacao import Dependencias, criar_app
from app.identidade import MedicoLocal
from app.pacientes.repositorio import RepositorioPacientesMemoria
from app.provedores.relogio import RelogioFixo

MEDICO_A = UUID("00000000-0000-4000-8000-000000000001")
MEDICO_B = UUID("00000000-0000-4000-8000-000000000002")
AGORA = datetime(2026, 11, 19, 12, 0, tzinfo=UTC)  # 09:00 em Fortaleza/São Paulo
PEDIDO = {
    "modalidade": "presencial",
    "data": "2026-11-20",
    "inicio": "10:00",
    "nome": "Maria Teste",
    "whatsapp": "5585999990000",
    "pagamento": "Particular",
    "transcricao": "aceita",
    "forma": "whatsapp",
}
DADOS = {
    "nomeCompleto": "Maria Teste da Silva",
    "nascimento": "1990-05-02",
    "sexo": "F",
    "whatsapp": "(85) 99999-0000",
    "cidade": "Fortaleza",
    "uf": "CE",
}


@pytest.fixture
def agenda():
    return RepositorioAgendaMemoria({"ana-souza": MEDICO_A, "outro": MEDICO_B})


def cliente(agenda, medico=MEDICO_A):
    dep = Dependencias(
        identidade=MedicoLocal(medico),
        pacientes=RepositorioPacientesMemoria(),
        agenda=agenda,
        relogio=RelogioFixo(AGORA),
    )
    return TestClient(criar_app(dep))


def pedir(c, **mudar):
    return c.post("/publico/medicos/ana-souza/pedidos", json={**PEDIDO, **mudar})


def test_pedido_aparece_na_agenda_do_medico(agenda):
    c = cliente(agenda)
    r = pedir(c)
    assert r.status_code == 201
    assert len(r.json()["tokenFormulario"]) >= 32
    lista = c.get("/agenda/pedidos", params={"de": "2026-11-20", "ate": "2026-11-20"}).json()
    assert [(p["nome"], p["inicio"], p["situacaoFicha"], p["status"]) for p in lista] == [
        ("Maria Teste", "10:00", "sem-ficha", "novo")
    ]


def test_horario_pedido_fica_ocupado_e_nao_aceita_outro(agenda):
    c = cliente(agenda)
    pedir(c)
    ocupados = c.get("/publico/medicos/ana-souza/ocupados", params={"de": "2026-11-20", "ate": "2026-11-21"})
    assert ocupados.json() == [{"data": "2026-11-20", "inicio": "10:00"}]
    r = pedir(c, nome="Outra Pessoa", modalidade="online")
    assert r.status_code == 409
    assert r.json()["detail"] == "Esse horário acabou de ser ocupado. Escolha outro."


def test_horario_que_ja_passou_e_recusado(agenda):
    r = pedir(cliente(agenda), data="2026-11-19", inicio="08:30")
    assert r.status_code == 422 and r.json()["detail"] == "Esse horário já passou. Escolha outro."


def test_pagina_inexistente_404(agenda):
    r = cliente(agenda).post("/publico/medicos/ninguem/pedidos", json=PEDIDO)
    assert r.status_code == 404


def test_whatsapp_sem_normalizar_e_recusado(agenda):
    assert pedir(cliente(agenda), whatsapp="(85) 99999-0000").status_code == 422


def test_medico_nao_ve_pedido_de_outro(agenda):
    pedir(cliente(agenda))
    outro = cliente(agenda, MEDICO_B)
    assert outro.get("/agenda/pedidos", params={"de": "2026-11-20", "ate": "2026-11-20"}).json() == []


def test_link_do_formulario_mostra_o_pedido_e_o_medico(agenda):
    c = cliente(agenda)
    token = pedir(c).json()["tokenFormulario"]
    r = c.get(f"/publico/formularios/{token}")
    assert r.status_code == 200
    assert r.json() == {
        "data": "2026-11-20",
        "inicio": "10:00",
        "medicoSlug": "ana-souza",
        "modalidade": "presencial",
        "nome": "Maria Teste",
        "whatsapp": "5585999990000",
        "situacaoFicha": "sem-ficha",
    }
    assert c.get("/publico/formularios/token-que-nao-existe").status_code == 404


def test_medico_manda_o_link_e_a_ficha_fica_link_enviado(agenda):
    c = cliente(agenda)
    pid = pedir(c).json()["id"]
    assert c.post(f"/agenda/pedidos/{pid}/link-enviado").json()["situacaoFicha"] == "link-enviado"
    assert cliente(agenda, MEDICO_B).post(f"/agenda/pedidos/{pid}/link-enviado").status_code == 404


def test_formulario_enviado_chega_ao_medico_com_a_foto(agenda):
    c = cliente(agenda)
    criado = pedir(c).json()
    foto = base64.b64encode(b"\x89PNG imagem").decode()
    corpo = {
        "dados": DADOS,
        "respostas": {"alergias": "Não tenho alergia", "sintomas": ["Coça"]},
        "fotos": {"foto_perto": {"tipo": "image/png", "base64": foto}},
    }
    assert c.post(f"/publico/formularios/{criado['tokenFormulario']}", json=corpo).status_code == 204
    [p] = c.get("/agenda/pedidos", params={"de": "2026-11-20", "ate": "2026-11-20"}).json()
    assert p["situacaoFicha"] == "pronta"
    assert p["formulario"]["respostas"] == {"alergias": "Não tenho alergia", "sintomas": ["Coça"]}
    assert p["formulario"]["dados"]["nascimento"] == "1990-05-02"
    assert p["formulario"]["fotos"] == ["foto_perto"]
    r = c.get(f"/agenda/pedidos/{criado['id']}/fotos/foto_perto")
    assert r.status_code == 200 and r.content == b"\x89PNG imagem" and r.headers["content-type"] == "image/png"


def test_foto_ilegivel_e_recusada_sem_gravar(agenda):
    c = cliente(agenda)
    token = pedir(c).json()["tokenFormulario"]
    corpo = {"dados": DADOS, "fotos": {"foto_perto": {"tipo": "image/png", "base64": "não é base64!"}}}
    r = c.post(f"/publico/formularios/{token}", json=corpo)
    assert r.status_code == 422
    [p] = c.get("/agenda/pedidos", params={"de": "2026-11-20", "ate": "2026-11-20"}).json()
    assert p["situacaoFicha"] == "sem-ficha"


def test_periodo_longo_demais_e_recusado(agenda):
    r = cliente(agenda).get("/agenda/pedidos", params={"de": "2026-01-01", "ate": "2026-12-31"})
    assert r.status_code == 422
