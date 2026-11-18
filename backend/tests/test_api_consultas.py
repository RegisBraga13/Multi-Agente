import json
from uuid import UUID

from fastapi.testclient import TestClient

from app.aplicacao import Dependencias, criar_app
from app.identidade import MedicoLocal
from tests.fabrica import ANAMNESE, DADOS_MINIMOS, EXAME, diagnosticos
from tests.test_geracao_consulta import Roteiro

MEDICO_A = UUID("00000000-0000-4000-8000-000000000001")
MEDICO_B = UUID("00000000-0000-4000-8000-000000000002")
PACIENTE = {"nome": "Mariana Souza", "nascimento": "1992-03-10", "sexo": "F", "cpf": "12345678909"}


def cliente(mundo, medico=MEDICO_A, provedor=None):
    pacientes, consultas = mundo
    dep = Dependencias(
        identidade=MedicoLocal(medico), pacientes=pacientes, consultas=consultas, provedor=provedor or Roteiro()
    )
    return TestClient(criar_app(dep))


def js(modelo):
    return modelo.model_dump(by_alias=True, mode="json")


def eventos(texto: str) -> list[tuple[str, dict]]:
    saida = []
    for bloco in texto.strip().split("\n\n"):
        linhas = dict(linha.split(": ", 1) for linha in bloco.splitlines())
        saida.append((linhas["event"], json.loads(linhas["data"])))
    return saida


def nova_consulta(c: TestClient) -> str:
    p = c.post("/pacientes", json=PACIENTE).json()
    r = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    )
    assert r.status_code == 201
    return r.json()["id"]


def ate_exame(c, cid):
    assert c.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE)).status_code == 200
    assert c.post(f"/consultas/{cid}/anamnese/oficializar").status_code == 200
    assert c.put(f"/consultas/{cid}/exame", json=js(EXAME)).status_code == 200
    assert c.post(f"/consultas/{cid}/exame/oficializar").status_code == 200


def test_fluxo_ate_a_conduta(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    ate_exame(c, cid)
    r = c.post(f"/consultas/{cid}/historia/gerar")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    assert eventos(r.text)[-1][1]["gravado"] is True
    assert c.post(f"/consultas/{cid}/historia/oficializar").status_code == 200
    assert eventos(c.post(f"/consultas/{cid}/diagnosticos/gerar").text)[-1][1]["gravado"] is True
    assert c.put(f"/consultas/{cid}/diagnosticos", json=js(diagnosticos("confirmada"))).status_code == 200
    assert c.post(f"/consultas/{cid}/diagnosticos/oficializar").status_code == 200
    pronto = eventos(c.post(f"/consultas/{cid}/conduta/gerar").text)[-1][1]
    conduta = pronto["conteudo"] | {"textos": ["Rotina para pele oleosa.", "", "", "Retorno em 8 semanas."]}
    assert c.put(f"/consultas/{cid}/conduta", json=conduta).status_code == 200
    r = c.post(f"/consultas/{cid}/conduta/oficializar")
    assert r.status_code == 200
    assert [(b["etapa"], b["estado"]) for b in r.json()["blocos"]] == [
        (e, "oficializado") for e in ("anamnese", "exame", "historia", "diagnosticos", "conduta")
    ]


def test_gerar_transmite_parciais_e_termina_com_pronto(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    ate_exame(c, cid)
    evs = eventos(c.post(f"/consultas/{cid}/historia/gerar").text)
    assert [e for e, _ in evs][-1] == "pronto" and all(e == "parcial" for e, _ in evs[:-1]) and len(evs) > 1
    assert evs[-2][1]["qp"] == "Espinhas."
    assert c.get(f"/consultas/{cid}").json()["blocos"][2]["estado"] == "rascunho_ia"


def test_gerar_fora_de_ordem_e_409(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    r = c.post(f"/consultas/{cid}/historia/gerar")
    assert r.status_code == 409 and r.json()["detail"] == "Oficialize Exame físico antes"
    assert c.post(f"/consultas/{cid}/exame/oficializar").status_code == 409


def test_corpo_invalido_e_422(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    assert c.put(f"/consultas/{cid}/anamnese", json={"queixa": "x"}).status_code == 422
    assert c.post(f"/consultas/{cid}/prescricao/oficializar").status_code == 422


def test_consulta_de_outro_medico_e_404(mundo):
    cid = nova_consulta(cliente(mundo))
    b = cliente(mundo, MEDICO_B)
    chamadas = [
        b.get(f"/consultas/{cid}"),
        b.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE)),
        b.post(f"/consultas/{cid}/anamnese/oficializar"),
        b.post(f"/consultas/{cid}/historia/gerar"),
        b.get(f"/consultas/{cid}/documentos"),
        b.put(
            f"/consultas/{cid}/documentos/receita",
            json={"tipo": "receita", "estado": "rascunho", "texto": "x", "registro": None},
        ),
    ]
    assert [r.status_code for r in chamadas] == [404] * len(chamadas)
    paciente = cliente(mundo).post("/pacientes", json=PACIENTE | {"cpf": None}).json()["id"]
    r = b.post(
        "/consultas",
        json={
            "pacienteId": paciente,
            "tipo": "consulta",
            "modalidade": "online",
            "agendadaPara": "2026-11-13T08:00:00Z",
        },
    )
    assert r.status_code == 404


def test_documentos(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    doc = {"tipo": "receita", "estado": "enviado", "texto": "Receita.", "registro": None}
    assert c.put(f"/consultas/{cid}/documentos/receita", json=doc).status_code == 204
    assert c.get(f"/consultas/{cid}/documentos").json() == [doc]
    assert c.put(f"/consultas/{cid}/documentos/laudo", json=doc).status_code == 422  # tipo do corpo ≠ do caminho


def test_finalizada_e_409_use_adendo(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    mundo[1].finalizar(MEDICO_A, UUID(cid), DADOS_MINIMOS, {}, __import__("datetime").datetime.now())
    r = c.put(f"/consultas/{cid}/anamnese", json=js(ANAMNESE))
    assert r.status_code == 409 and r.json()["detail"] == "consulta finalizada; use adendo"
    assert c.post(f"/consultas/{cid}/historia/gerar").status_code == 409


def test_privacidade_e_422(mundo):
    c = cliente(mundo)
    cid = nova_consulta(c)
    anamnese = js(ANAMNESE) | {"falas": [{"quem": "Paciente", "texto": "Sou a Mariana."}]}
    c.put(f"/consultas/{cid}/anamnese", json=anamnese)
    c.post(f"/consultas/{cid}/anamnese/oficializar")
    c.put(f"/consultas/{cid}/exame", json=js(EXAME))
    c.post(f"/consultas/{cid}/exame/oficializar")
    r = c.post(f"/consultas/{cid}/historia/gerar")
    assert r.status_code == 422 and r.json()["detail"] == "dado de identidade no pedido à IA; nada foi enviado"


def test_erro_no_meio_do_fluxo_vira_evento_erro(mundo):
    class QuebraNaHistoria(Roteiro):
        def gerar(self, pedido, esquema, ao_escrever=None):
            if pedido.motor == "historia":
                ao_escrever and ao_escrever('{"resultado": {"qp": "Esp')
                raise RuntimeError("falha de rede")
            return super().gerar(pedido, esquema, ao_escrever)

    c = cliente(mundo, provedor=QuebraNaHistoria())
    cid = nova_consulta(c)
    ate_exame(c, cid)
    evs = eventos(c.post(f"/consultas/{cid}/historia/gerar").text)
    assert evs[0][0] == "parcial" and evs[-1][0] == "erro"


def test_horario_sem_fuso_e_422(mundo):
    c = cliente(mundo)
    p = c.post("/pacientes", json=PACIENTE).json()
    r = c.post(
        "/consultas",
        json={
            "pacienteId": p["id"],
            "tipo": "consulta",
            "modalidade": "presencial",
            "agendadaPara": "2026-11-13T08:00:00",
        },
    )
    assert r.status_code == 422
