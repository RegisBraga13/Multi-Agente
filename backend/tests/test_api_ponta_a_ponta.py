"""Uma consulta inteira pela API com o provedor de demonstração (o mesmo do servidor sem chave)."""

from fastapi.testclient import TestClient

from app.aplicacao import Dependencias, criar_app
from app.identidade import MedicoLocal
from app.provedores.ia_demonstracao import ProvedorDemonstracao
from tests.fabrica import ANAMNESE, EXAME
from tests.test_api_consultas import MEDICO_A, eventos, js


def test_consulta_ponta_a_ponta_com_demonstracao(mundo):
    pacientes, consultas = mundo
    c = TestClient(
        criar_app(
            Dependencias(
                identidade=MedicoLocal(MEDICO_A),
                pacientes=pacientes,
                consultas=consultas,
                provedor=ProvedorDemonstracao(),
            )
        )
    )
    p = c.post("/pacientes", json={"nome": "Joana Fictícia", "nascimento": "1990-01-01", "sexo": "F"}).json()
    cid = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    ).json()["id"]
    for etapa, conteudo in (("anamnese", ANAMNESE), ("exame", EXAME)):
        assert c.put(f"/consultas/{cid}/{etapa}", json=js(conteudo)).status_code == 200
        assert c.post(f"/consultas/{cid}/{etapa}/oficializar").status_code == 200
    evs = eventos(c.post(f"/consultas/{cid}/historia/gerar").text)
    assert len(evs) > 1 and evs[-1][1]["gravado"]  # escreveu ao vivo e gravou
    assert c.post(f"/consultas/{cid}/historia/oficializar").status_code == 200
    dd = eventos(c.post(f"/consultas/{cid}/diagnosticos/gerar").text)[-1][1]["conteudo"]
    dd["itens"][0]["decisao"] = "confirmada"
    assert c.put(f"/consultas/{cid}/diagnosticos", json=dd).status_code == 200
    assert c.post(f"/consultas/{cid}/diagnosticos/oficializar").status_code == 200
    conduta = eventos(c.post(f"/consultas/{cid}/conduta/gerar").text)[-1][1]["conteudo"]
    conduta["textos"] = ["Orientação.", "", "", "Avaliação em 4 semanas."]
    assert c.put(f"/consultas/{cid}/conduta", json=conduta).status_code == 200
    assert c.post(f"/consultas/{cid}/conduta/oficializar").status_code == 200
    assert c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}}).json()["titulo"] == "Consulta 1"
    [entrada] = c.get(f"/pacientes/{p['id']}/prontuario").json()
    assert (
        entrada["dados"]["avaliacao"] == "em 4 semanas."
        and entrada["dados"]["diagnosticos"][0]["situacao"] == "assinalado"
    )


def test_demonstracao_propoe_tres_perguntas_validas(mundo):
    pacientes, consultas = mundo
    c = TestClient(
        criar_app(
            Dependencias(
                identidade=MedicoLocal(MEDICO_A),
                pacientes=pacientes,
                consultas=consultas,
                provedor=ProvedorDemonstracao(),
            )
        )
    )
    p = c.post("/pacientes", json={"nome": "Joana Fictícia", "nascimento": "1990-01-01", "sexo": "F"}).json()
    cid = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    ).json()["id"]
    for etapa, conteudo in (("anamnese", ANAMNESE), ("exame", EXAME)):
        assert c.put(f"/consultas/{cid}/{etapa}", json=js(conteudo)).status_code == 200
        assert c.post(f"/consultas/{cid}/{etapa}/oficializar").status_code == 200
    c.post(f"/consultas/{cid}/historia/gerar")
    r = c.post(f"/consultas/{cid}/perguntas/gerar")
    assert r.status_code == 200 and r.json()["avisos"] == []
    perguntas = r.json()["perguntas"]
    assert len(perguntas) == 3
    assert sorted(x["sinalId"] for x in perguntas if x["sinalId"]) == ["angioedema", "lesao-sangra-facil"]


def test_demonstracao_propoe_quatro_hipoteses_e_um_nao_pode_perder(mundo):
    pacientes, consultas = mundo
    c = TestClient(
        criar_app(
            Dependencias(
                identidade=MedicoLocal(MEDICO_A),
                pacientes=pacientes,
                consultas=consultas,
                provedor=ProvedorDemonstracao(),
            )
        )
    )
    p = c.post("/pacientes", json={"nome": "Joana Fictícia", "nascimento": "1990-01-01", "sexo": "F"}).json()
    cid = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    ).json()["id"]
    for etapa, conteudo in (("anamnese", ANAMNESE), ("exame", EXAME)):
        assert c.put(f"/consultas/{cid}/{etapa}", json=js(conteudo)).status_code == 200
        assert c.post(f"/consultas/{cid}/{etapa}/oficializar").status_code == 200
    c.post(f"/consultas/{cid}/historia/gerar")
    assert c.post(f"/consultas/{cid}/historia/oficializar").status_code == 200
    dd = eventos(c.post(f"/consultas/{cid}/diagnosticos/gerar").text)[-1][1]["conteudo"]
    assert [i["hipotese"]["pct"] for i in dd["itens"]] == [70, 15, 10, 5]
    assert all(i["decisao"] == "pendente" and i["propria"] is False for i in dd["itens"])
    assert dd["naoPodePerder"] is not None


def test_demonstracao_propoe_conduta_com_grupos(mundo):
    pacientes, consultas = mundo
    c = TestClient(
        criar_app(
            Dependencias(
                identidade=MedicoLocal(MEDICO_A),
                pacientes=pacientes,
                consultas=consultas,
                provedor=ProvedorDemonstracao(),
            )
        )
    )
    p = c.post("/pacientes", json={"nome": "Joana Fictícia", "nascimento": "1990-01-01", "sexo": "F"}).json()
    cid = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    ).json()["id"]
    for etapa, conteudo in (("anamnese", ANAMNESE), ("exame", EXAME)):
        assert c.put(f"/consultas/{cid}/{etapa}", json=js(conteudo)).status_code == 200
        assert c.post(f"/consultas/{cid}/{etapa}/oficializar").status_code == 200
    c.post(f"/consultas/{cid}/historia/gerar")
    assert c.post(f"/consultas/{cid}/historia/oficializar").status_code == 200
    dd = eventos(c.post(f"/consultas/{cid}/diagnosticos/gerar").text)[-1][1]["conteudo"]
    dd["itens"][0]["decisao"] = "confirmada"
    assert c.put(f"/consultas/{cid}/diagnosticos", json=dd).status_code == 200
    assert c.post(f"/consultas/{cid}/diagnosticos/oficializar").status_code == 200
    proposta = eventos(c.post(f"/consultas/{cid}/conduta/gerar").text)[-1][1]["conteudo"]["proposta"]
    assert proposta["urgencia"] == "rotina" and proposta["emergencia"] == []
    grupos = {g["id"]: g["opcoes"] for g in proposta["ia"]["grupos"]}
    assert set(grupos) == {"cuidados", "topico", "sistemico", "orientacoes"}
    assert len(grupos["topico"]) == 2 and len(grupos["topico"][0]["receita"]) == 1
    assert len(grupos["sistemico"][0]["receita"]) == 1 and grupos["sistemico"][0]["receita"][0]["via"] == "oral"
