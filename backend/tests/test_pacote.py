import pytest
import yaml

from app.especialidades.pacote import PacoteInvalido, carregar_sinais


def test_dermatologia_tem_os_sinais_obrigatorios():
    ids = {s.id for s in carregar_sinais("dermatologia")}
    assert {"lesao-pigmentada-abcde", "ferida-nao-cicatriza", "bolhas-mucosas", "angioedema", "zoster-oftalmico"} <= ids


def test_id_repetido_e_recusado(tmp_path):
    (tmp_path / "x").mkdir()
    sinal = {
        "id": "angioedema",
        "texto": "Inchaço",
        "porque": "Risco de vida.",
        "tipo": "urgencia_imediata",
        "acao": ["Avaliar via aérea"],
        "prazo": "imediato",
    }
    dados = {"revisao": {"situacao": "pendente"}, "sinais": [sinal, sinal]}
    (tmp_path / "x" / "sinais_alerta.yaml").write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="repetido"):
        carregar_sinais("x", raiz=tmp_path)


def test_especialidade_sem_lista(tmp_path):
    with pytest.raises(PacoteInvalido, match="não encontrad"):
        carregar_sinais("psiquiatria", raiz=tmp_path)


def test_urgencias_imediatas_tem_acao_de_emergencia():
    imediatos = {s.id: s for s in carregar_sinais("dermatologia") if s.tipo == "urgencia_imediata"}
    assert {"bolhas-mucosas", "febre-erupcao-difusa", "angioedema", "zoster-oftalmico"} <= set(imediatos)
    assert all(s.acao and s.prazo == "imediato" for s in imediatos.values())


def test_gravidez_muda_o_tratamento():
    sinais = {s.id: s for s in carregar_sinais("dermatologia")}
    assert sinais["gestacao-ou-plano"].tipo == "muda_tratamento"
    assert sinais["imunossupressao"].tipo == "muda_tratamento"


def test_sinal_sem_acao_e_recusado(tmp_path):
    (tmp_path / "x").mkdir()
    sinal = {
        "id": "angioedema",
        "texto": "Inchaço",
        "porque": "Via aérea.",
        "tipo": "urgencia_imediata",
        "acao": [],
        "prazo": "imediato",
    }
    dados = {"revisao": {"situacao": "pendente"}, "sinais": [sinal]}
    (tmp_path / "x" / "sinais_alerta.yaml").write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    with pytest.raises(PacoteInvalido):
        carregar_sinais("x", raiz=tmp_path)
