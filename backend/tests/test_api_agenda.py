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


def test_medico_abre_um_pedido_pelo_id(agenda):
    c = cliente(agenda)
    pid = pedir(c).json()["id"]
    assert c.get(f"/agenda/pedidos/{pid}").json()["nome"] == "Maria Teste"
    assert cliente(agenda, MEDICO_B).get(f"/agenda/pedidos/{pid}").status_code == 404


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


def test_formulario_aceita_receita_ou_laudo_em_pdf(agenda):
    c = cliente(agenda)
    criado = pedir(c).json()
    pdf = base64.b64encode(b"%PDF-1.4 laudo").decode()
    corpo = {
        "dados": {**DADOS, "sexo": "I", "nomeSocial": "Mar"},
        "fotos": {"documentos_1": {"tipo": "application/pdf", "base64": pdf}},
    }
    assert c.post(f"/publico/formularios/{criado['tokenFormulario']}", json=corpo).status_code == 204
    r = c.get(f"/agenda/pedidos/{criado['id']}/fotos/documentos_1")
    assert r.headers["content-type"] == "application/pdf" and r.content == b"%PDF-1.4 laudo"
    word = {"dados": DADOS, "fotos": {"documentos_1": {"tipo": "application/msword", "base64": pdf}}}
    assert c.post(f"/publico/formularios/{criado['tokenFormulario']}", json=word).status_code == 422


def test_formulario_aceita_duas_fotos_e_dez_documentos(agenda):
    c = cliente(agenda)
    token = pedir(c).json()["tokenFormulario"]
    png = {"tipo": "image/png", "base64": base64.b64encode(b"png").decode()}
    fotos = {"foto_perto": png, "foto_longe": png, **{f"documentos_{i}": png for i in range(1, 11)}}
    assert c.post(f"/publico/formularios/{token}", json={"dados": DADOS, "fotos": fotos}).status_code == 204
    demais = {**fotos, "documentos_11": png}
    assert c.post(f"/publico/formularios/{token}", json={"dados": DADOS, "fotos": demais}).status_code == 422


def test_medico_preenche_a_identificacao_na_chegada(agenda):
    # "preencher na consulta": sem a Identificação a consulta não começa; o médico preenche por ela no computador
    c = cliente(agenda)
    criado = pedir(c).json()
    pid = criado["id"]
    assert cliente(agenda, MEDICO_B).post(f"/agenda/pedidos/{pid}/identificacao", json=DADOS).status_code == 404
    r = c.post(f"/agenda/pedidos/{pid}/identificacao", json=DADOS)
    assert r.status_code == 200
    p = r.json()
    assert p["situacaoFicha"] == "pronta"
    assert p["formulario"]["dados"]["nascimento"] == "1990-05-02"
    assert p["formulario"]["respostas"] == {} and p["formulario"]["fotos"] == []


def test_identificacao_pelo_medico_nao_apaga_formulario_enviado(agenda):
    c = cliente(agenda)
    criado = pedir(c).json()
    corpo = {"dados": DADOS, "respostas": {"alergias": "Não tenho alergia"}}
    assert c.post(f"/publico/formularios/{criado['tokenFormulario']}", json=corpo).status_code == 204
    r = c.post(f"/agenda/pedidos/{criado['id']}/identificacao", json=DADOS)
    assert r.status_code == 422
    assert c.get(f"/agenda/pedidos/{criado['id']}").json()["formulario"]["respostas"] == {
        "alergias": "Não tenho alergia"
    }


def test_identificacao_incompleta_e_recusada(agenda):
    c = cliente(agenda)
    pid = pedir(c).json()["id"]
    assert c.post(f"/agenda/pedidos/{pid}/identificacao", json={**DADOS, "nascimento": ""}).status_code == 422
    assert c.get(f"/agenda/pedidos/{pid}").json()["formulario"] is None


def test_medico_confirma_o_pedido_e_ele_deixa_de_ser_novo(agenda):
    c = cliente(agenda)
    pid = pedir(c).json()["id"]
    assert cliente(agenda, MEDICO_B).post(f"/agenda/pedidos/{pid}/confirmar").status_code == 404
    r = c.post(f"/agenda/pedidos/{pid}/confirmar")
    assert r.status_code == 200 and r.json()["status"] == "confirmado"
    assert c.post(f"/agenda/pedidos/{pid}/confirmar").json()["status"] == "confirmado"  # tocar de novo não muda nada


def test_avisar_cancela_o_pedido_e_o_horario_volta_a_ficar_livre(agenda):
    c = cliente(agenda)
    pid = pedir(c).json()["id"]
    assert cliente(agenda, MEDICO_B).post(f"/agenda/pedidos/{pid}/cancelar").status_code == 404
    r = c.post(f"/agenda/pedidos/{pid}/cancelar")
    assert r.status_code == 200 and r.json()["status"] == "cancelado"
    assert c.get("/publico/medicos/ana-souza/ocupados", params={"de": "2026-11-20", "ate": "2026-11-20"}).json() == []
    assert pedir(c).status_code == 201  # outro paciente pode pegar o mesmo horário


def test_retornos_do_periodo_so_do_medico_e_do_periodo(agenda):
    from uuid import uuid4

    from app.contratos.agenda import RetornoMarcado

    paciente, origem = uuid4(), uuid4()
    agenda.criar_retorno(
        MEDICO_A, paciente, "João Lima", origem, RetornoMarcado(data="2026-11-20", inicio="14:00", modalidade="online")
    )
    agenda.criar_retorno(
        MEDICO_A, paciente, "João Lima", uuid4(), RetornoMarcado(data="2026-12-20", inicio="14:00", modalidade="online")
    )
    agenda.criar_retorno(
        MEDICO_B, uuid4(), "Outra", uuid4(), RetornoMarcado(data="2026-11-20", inicio="15:00", modalidade="presencial")
    )
    r = cliente(agenda).get("/agenda/retornos", params={"de": "2026-11-20", "ate": "2026-11-21"})
    assert r.status_code == 200
    assert [(x["pacienteNome"], x["inicio"], x["modalidade"], x["consultaOrigemId"]) for x in r.json()] == [
        ("João Lima", "14:00", "online", str(origem))
    ]


def test_retornos_periodo_longo_demais_e_recusado_como_os_pedidos(agenda):
    r = cliente(agenda).get("/agenda/retornos", params={"de": "2026-01-01", "ate": "2026-12-31"})
    assert r.status_code == 422
