from tests.fabrica import ANAMNESE, diagnosticos
from tests.test_api_consultas import cliente, eventos, js, nova_consulta


def consulta_pronta(c):
    cid = nova_consulta(c)
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
        f"/consultas/{cid}/conduta", json=pronto["conteudo"] | {"textos": ["Rotina.", "", "", "Avaliação em 8 semanas."]}
    )
    assert c.post(f"/consultas/{cid}/conduta/oficializar").status_code == 200
    return cid


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
