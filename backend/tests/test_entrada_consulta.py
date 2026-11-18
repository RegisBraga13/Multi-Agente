from app.contratos.consulta import SinalRespondido
from app.especialidades.pacote import carregar_sinais
from casos_de_teste.carregar import PASTA_CASOS, validar_pasta
from casos_de_teste.entrada import entrada_do_caso
from casos_de_teste.formato import Caso
from tests.conftest import caso_minimo

SINAIS = carregar_sinais("dermatologia")
POR_ID = {s.id: s for s in SINAIS}


def _caso(**entrada: object) -> Caso:
    dados = caso_minimo()
    dados["entrada"].update(entrada)
    return Caso.model_validate(dados)


def test_entrada_do_caso_desidentificada():
    caso = _caso(
        paciente={
            "idade": 34,
            "sexo": "F",
            "estado_civil": "casada",
            "alergias": [{"substancia": "Dipirona", "reacao": "urticária"}],
        }
    )
    e = entrada_do_caso(caso, POR_ID)
    assert e.paciente == "Paciente, 34 anos, feminino, casada"
    assert e.exame.morfologia == "Pápulas e pústulas"
    assert e.alergias[0].substancia == "Dipirona"
    assert [f.quem for f in e.falas] == ["Médico", "Paciente"]


def test_sinal_respondido_leva_o_texto_da_lista_fixa():
    caso = _caso(sinais=[{"sinal": "angioedema", "resposta": "v"}, {"sinal": "virilizacao", "resposta": "f"}])
    e = entrada_do_caso(caso, POR_ID)
    assert e.sinais[0] == SinalRespondido(
        id="angioedema", texto="Inchaço de lábios/língua ou falta de ar", resposta="sim"
    )
    assert e.sinais[1].resposta == "nao"


def test_exame_nao_examinado_fica_none():
    caso = _caso(
        exame={"morfologia": "Pápulas", "localizacao": None, "extensao": None, "gravidade": None, "achados": None}
    )
    assert entrada_do_caso(caso, POR_ID).exame.localizacao is None


def test_todos_os_casos_aprovados_viram_entrada():
    casos = validar_pasta(PASTA_CASOS, SINAIS).casos
    assert len(casos) == 20
    for caso in casos:
        entrada_do_caso(caso, POR_ID)
