from datetime import date

import pytest

from app.agenda.repositorio import RepositorioAgendaMemoria
from app.consulta.repositorio import RepositorioConsultasMemoria
from app.contratos.agenda import NovoPedido, RetornoMarcado
from tests.fabrica import ANAMNESE, diagnosticos
from tests.test_api_consultas import MEDICO_A, cliente, eventos, js, nova_consulta


def consulta_pronta(c):
    cid = nova_consulta(c)
    etapas_ate_conduta(c, cid)
    return cid


def etapas_ate_conduta(c, cid):
    c.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE))
    c.post(f"/consultas/{cid}/anamnese/oficializar")
    from tests.fabrica import EXAME

    c.put(f"/consultas/{cid}/exame", json=js(EXAME))
    c.post(f"/consultas/{cid}/exame/oficializar")
    eventos(c.post(f"/consultas/{cid}/historia/gerar").text)
    c.post(f"/consultas/{cid}/historia/oficializar")
    eventos(c.post(f"/consultas/{cid}/diagnosticos/gerar").text)
    c.put(f"/consultas/{cid}/diagnosticos", json=js(diagnosticos("confirmada")))
    c.post(f"/consultas/{cid}/diagnosticos/oficializar")
    pronto = eventos(c.post(f"/consultas/{cid}/conduta/gerar").text)[-1][1]
    c.put(
        f"/consultas/{cid}/conduta",
        json=pronto["conteudo"] | {"textos": ["Rotina.", "", "", "Avaliação em 8 semanas."]},
    )
    assert c.post(f"/consultas/{cid}/conduta/oficializar").status_code == 200


def test_prontuario_proposto(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    r = c.get(f"/consultas/{cid}/prontuario")
    assert r.status_code == 200 and r.json()["qp"] == "Espinhas." and r.json()["avaliacao"] == "em 8 semanas."
    assert r.json()["diagnosticos"][0]["situacao"] == "assinalado"


def test_finalizar_grava_e_aparece_no_prontuario_do_paciente(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {"hda": "HDA ditada pelo médico."}})
    assert r.status_code == 200 and r.json()["titulo"] == "Consulta 1"
    paciente = c.get(f"/consultas/{cid}").json()["pacienteId"]
    [e] = c.get(f"/pacientes/{paciente}/prontuario").json()
    assert e["edicoes"] == {"hda": "HDA ditada pelo médico."} and e["dados"]["qp"] == "Espinhas."
    assert c.get(f"/consultas/{cid}").json()["finalizadaEm"] is not None


def test_prontuario_proposto_e_finalizar_com_etapa_faltando_e_409(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    r = c.get(f"/consultas/{cid}/prontuario")
    assert r.status_code == 409 and r.json()["detail"] == "Oficialize Anamnese antes"
    assert c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}}).status_code == 409


def test_finalizar_com_etapa_desatualizada_e_409(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    c.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE))
    c.post(f"/consultas/{cid}/anamnese/oficializar")
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    assert r.status_code == 409 and r.json()["detail"] == "Oficialize Exame físico antes"


def test_finalizar_com_documento_nao_enviado_e_409(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    c.put(
        f"/consultas/{cid}/documentos/receita",
        json={"tipo": "receita", "estado": "assinado", "texto": "x", "registro": None},
    )
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    assert r.status_code == 409 and r.json()["detail"] == "Envie os documentos antes de finalizar"


def test_adendo_so_depois_de_finalizar(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    adendo = {"texto": "Biópsia confirmou."}
    r = c.post(f"/consultas/{cid}/adendos", json=adendo)
    assert r.status_code == 409 and r.json()["detail"] == "adendo só em consulta finalizada"
    c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    assert c.post(f"/consultas/{cid}/adendos", json=adendo).status_code == 201
    paciente = c.get(f"/consultas/{cid}").json()["pacienteId"]
    assert c.get(f"/pacientes/{paciente}/prontuario").json()[0]["adendos"][0]["texto"] == "Biópsia confirmou."
    assert c.post(f"/consultas/{cid}/adendos", json={"texto": "   "}).status_code == 422


def test_entrada_finalizada_nao_muda(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    assert c.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE)).status_code == 409
    assert c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}}).status_code == 409


def test_prontuario_de_paciente_de_outro_medico_e_vazio(mundo):
    from tests.test_api_consultas import MEDICO_B

    c = cliente(mundo)
    cid = consulta_pronta(c)
    c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    paciente = c.get(f"/consultas/{cid}").json()["pacienteId"]
    assert cliente(mundo, MEDICO_B).get(f"/pacientes/{paciente}/prontuario").status_code == 404


def test_finalizar_aplica_a_edicao_da_hda_e_guarda_a_do_diagnostico(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {"S.hda": "HDA editada.", "A.hd": "Linha do HD"}})
    assert r.status_code == 200
    paciente = c.get(f"/consultas/{cid}").json()["pacienteId"]
    [e] = c.get(f"/pacientes/{paciente}/prontuario").json()
    assert e["dados"]["hda"] == "HDA editada." and e["edicoes"] == {"A.hd": "Linha do HD"}


def test_lista_de_prontuarios_so_com_consulta_finalizada(mundo):
    from tests.test_api_consultas import MEDICO_B

    c = cliente(mundo)
    assert c.get("/prontuarios").json() == []
    cid = consulta_pronta(c)
    assert c.get("/prontuarios").json() == []  # consulta aberta não conta
    c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}})
    [p] = c.get("/prontuarios").json()
    paciente = c.get(f"/consultas/{cid}").json()
    assert p["id"] == paciente["pacienteId"] and p["entradas"] == 1 and p["nome"] and p["nascimento"] and p["ultima"]
    assert cliente(mundo, MEDICO_B).get("/prontuarios").json() == []  # outro médico não vê


# ---- retorno marcado (parte 1 do retorno) ----

FUTURO = date(2099, 1, 5)
RETORNO = {"data": FUTURO.isoformat(), "inicio": "14:00", "modalidade": "online"}


def com_agenda(mundo):
    agenda = RepositorioAgendaMemoria({"ana": MEDICO_A})
    return cliente(mundo, agenda=agenda), agenda


def test_finalizar_com_retorno_cria_cartao_e_grava_dia(mundo):
    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})
    assert r.status_code == 200 and r.json()["dados"]["retornoMarcado"] == RETORNO
    [cartao] = agenda.retornos(MEDICO_A, FUTURO, FUTURO)
    assert (cartao.inicio, cartao.modalidade, cartao.paciente_nome) == ("14:00", "online", "Mariana Souza")
    assert str(cartao.consulta_origem_id) == cid


def test_finalizar_sem_retorno_nao_cria_cartao(mundo):
    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": None})
    assert r.status_code == 200 and r.json()["dados"]["retornoMarcado"] is None
    assert agenda.retornos(MEDICO_A, FUTURO, FUTURO) == []


def test_finalizar_com_horario_ocupado_e_409_e_consulta_continua_aberta(mundo):
    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    agenda.criar_pedido(
        MEDICO_A,
        NovoPedido(
            data=FUTURO,
            inicio="14:00",
            modalidade="presencial",
            nome="Outra Pessoa",
            whatsapp="5585999990000",
            pagamento="Particular",
            transcricao="aceita",
            forma="pagina",
        ),
        "t" * 32,
    )
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})
    assert r.status_code == 409 and "ocupado" in r.json()["detail"]
    assert c.get(f"/consultas/{cid}").json()["finalizadaEm"] is None
    outro = RETORNO | {"inicio": "15:00"}
    assert c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": outro}).status_code == 200


def test_finalizar_com_horario_no_passado_e_409(mundo):
    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    passado = RETORNO | {"data": "2020-01-06"}
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": passado})
    assert r.status_code == 409 and "passou" in r.json()["detail"]
    assert c.get(f"/consultas/{cid}").json()["finalizadaEm"] is None


def test_finalizar_duas_vezes_nao_duplica_o_cartao(mundo):
    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    corpo = {"edicoes": {}, "retornoMarcado": RETORNO}
    assert c.post(f"/consultas/{cid}/finalizar", json=corpo).status_code == 200
    assert c.post(f"/consultas/{cid}/finalizar", json=corpo).status_code == 409
    assert len(agenda.retornos(MEDICO_A, FUTURO, FUTURO)) == 1


def test_finalizar_que_falha_desfaz_o_retorno(mundo):
    class Quebrado(RepositorioConsultasMemoria):
        def finalizar(self, *args, **kwargs):
            raise RuntimeError("banco caiu")

    pacientes, _ = mundo
    c, agenda = com_agenda((pacientes, Quebrado(pacientes)))
    cid = consulta_pronta(c)
    with pytest.raises(RuntimeError):
        c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})
    assert agenda.retornos(MEDICO_A, FUTURO, FUTURO) == []


def test_finalizar_com_retorno_orfao_da_mesma_consulta_funciona(mundo):
    """Um cartão que sobrou de uma tentativa que caiu no meio não trava a consulta."""
    from uuid import UUID

    c, agenda = com_agenda(mundo)
    cid = consulta_pronta(c)
    paciente = UUID(c.get(f"/consultas/{cid}").json()["pacienteId"])
    agenda.criar_retorno(MEDICO_A, paciente, "Mariana Souza", UUID(cid), RetornoMarcado(**RETORNO))
    r = c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})
    assert r.status_code == 200 and len(agenda.retornos(MEDICO_A, FUTURO, FUTURO)) == 1


def test_falha_ao_desfazer_nao_esconde_o_erro_original(mundo):
    class Quebrado(RepositorioConsultasMemoria):
        def finalizar(self, *args, **kwargs):
            raise RuntimeError("banco caiu")

    class AgendaQueNaoDesfaz(RepositorioAgendaMemoria):
        def desfazer_retorno(self, *args, **kwargs):
            raise OSError("agenda caiu")

    pacientes, _ = mundo
    agenda = AgendaQueNaoDesfaz({"ana": MEDICO_A})
    c = cliente((pacientes, Quebrado(pacientes)), agenda=agenda)
    cid = consulta_pronta(c)
    with pytest.raises(RuntimeError, match="banco caiu"):
        c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})


def test_retorno_proposto_compara_com_a_consulta_de_origem(mundo):
    from tests.test_api_consultas import _cliente_com_agenda, _pedido_com_formulario

    c, agenda = _cliente_com_agenda(mundo)
    p = _pedido_com_formulario(agenda, MEDICO_A)
    origem = c.post(f"/consultas/do-pedido/{p.id}", json={"especialidade": "dermatologia"}).json()["id"]
    etapas_ate_conduta(c, origem)
    assert c.post(f"/consultas/{origem}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO}).status_code == 200
    [cartao] = agenda.retornos(MEDICO_A, FUTURO, FUTURO)
    rid = c.post(f"/consultas/do-retorno/{cartao.id}", json={"especialidade": "dermatologia"}).json()["id"]
    etapas_ate_conduta(c, rid)
    comp = c.get(f"/consultas/{rid}/prontuario").json()["comparacao"]
    assert comp["referencia"] == "Consulta 1" and comp["conduta"] == [] and comp["novasHipoteses"] == []
    assert [(d["nome"], d["pct"]) for d in comp["confirmados"]] == [
        (diagnosticos("confirmada").itens[0].hipotese.nome, None)
    ]
    r = c.post(f"/consultas/{rid}/finalizar", json={"edicoes": {"P.orientacoes": "Evitar sol."}})
    assert r.json()["dados"]["comparacao"]["orientacoes"] == "Evitar sol."
    assert c.get(f"/consultas/{origem}/prontuario").status_code == 409  # origem finalizada: sem proposta


def test_consulta_comum_nao_tem_comparacao(mundo):
    c = cliente(mundo)
    cid = consulta_pronta(c)
    assert c.get(f"/consultas/{cid}/prontuario").json()["comparacao"] is None


def test_titulo_fica_fixo_mesmo_com_consulta_marcada_mais_cedo(mundo):
    """Teste de consistência 24/11: a 2ª consulta marcada mais cedo no mesmo dia renomeava a Consulta 1."""
    from tests.test_api_consultas import _cliente_com_agenda, _pedido_com_formulario

    c, agenda = _cliente_com_agenda(mundo)
    p = _pedido_com_formulario(agenda, MEDICO_A)
    origem = c.post(f"/consultas/do-pedido/{p.id}", json={"especialidade": "dermatologia"}).json()["id"]
    etapas_ate_conduta(c, origem)
    c.post(f"/consultas/{origem}/finalizar", json={"edicoes": {}, "retornoMarcado": RETORNO})
    [cartao] = agenda.retornos(MEDICO_A, FUTURO, FUTURO)
    rid = c.post(f"/consultas/do-retorno/{cartao.id}", json={"especialidade": "dermatologia"}).json()["id"]
    etapas_ate_conduta(c, rid)
    c.post(f"/consultas/{rid}/finalizar", json={"edicoes": {}})
    paciente = c.get(f"/consultas/{origem}").json()["pacienteId"]
    marcada = c.get(f"/consultas/{origem}").json()["agendadaPara"]
    mais_cedo = c.post(
        "/consultas",
        json={
            "pacienteId": paciente,
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2020-01-01T08:00:00Z",
        },
    ).json()["id"]
    assert marcada > "2020-01-01"
    etapas_ate_conduta(c, mais_cedo)
    assert c.post(f"/consultas/{mais_cedo}/finalizar", json={"edicoes": {}}).json()["titulo"] == "Consulta 2"
    titulos = {e["id"]: e["titulo"] for e in c.get(f"/pacientes/{paciente}/prontuario").json()}
    assert titulos == {origem: "Consulta 1", rid: "Consulta 1 — Retorno", mais_cedo: "Consulta 2"}
