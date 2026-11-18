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
    conduta["textos"] = ["Orientação.", "", "", "Retorno em 4 semanas."]
    assert c.put(f"/consultas/{cid}/conduta", json=conduta).status_code == 200
    assert c.post(f"/consultas/{cid}/conduta/oficializar").status_code == 200
    assert c.post(f"/consultas/{cid}/finalizar", json={"edicoes": {}}).json()["titulo"] == "Consulta 1"
    [entrada] = c.get(f"/pacientes/{p['id']}/prontuario").json()
    assert (
        entrada["dados"]["retorno"] == "em 4 semanas."
        and entrada["dados"]["diagnosticos"][0]["situacao"] == "assinalado"
    )
