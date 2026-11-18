from app.especialidades.pacote import SinalAlerta
from casos_de_teste import carregar
from casos_de_teste.__main__ import main
from casos_de_teste.folha import montar_folha
from casos_de_teste.formato import Caso
from conftest import caso_minimo

SINAIS = [SinalAlerta(id="angioedema", texto="Inchaço de lábios/língua ou falta de ar", porque="Via aérea.")]


def folha(d: dict) -> str:
    return montar_folha([Caso.model_validate(d)], SINAIS)


def test_texto_do_caso_e_escapado():
    d = caso_minimo()
    d["entrada"]["exame"]["extensao"] = "lesão < 6 mm & única"
    html = folha(d)
    assert "lesão &lt; 6 mm &amp; única" in html and "< 6 mm" not in html


def test_sinal_aparece_pelo_texto_e_nao_pelo_id():
    d = caso_minimo()
    d["esperado"]["sinais"]["disparados"] = ["angioedema"]
    assert "Inchaço de lábios/língua ou falta de ar" in folha(d)


def test_exame_nao_feito_aparece_como_nao_examinado():
    d = caso_minimo()
    d["entrada"]["exame"]["achados"] = None
    assert "não examinado" in folha(d)


def test_paciente_em_linguagem_de_prontuario():
    d = caso_minimo()
    d["entrada"]["paciente"].update(estado_civil="casada", profissao="professora")
    assert "Paciente, 34 anos, feminino, casada, professora" in folha(d)


def test_resposta_esperada_em_linguagem_de_medico():
    html = folha(caso_minimo())
    assert "Entre os 3 diagnósticos: Acne vulgar (L70.0)" in html
    assert "Conduta pela tabela: acne" in html
    assert "HF" in html and "6 meses" in html


def test_sem_protocolo_diz_que_a_ia_sugere():
    d = caso_minimo()
    d["esperado"]["conduta"]["protocolo"] = None
    assert "Sem protocolo na tabela" in folha(d)


def test_folha_sem_recurso_externo():
    html = folha(caso_minimo())
    assert "<script" not in html and "http" not in html


def test_cli_validar_falha_com_codigo_1(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(carregar, "PASTA_CASOS", tmp_path)
    assert main(["validar"]) == 1 and "nenhum caso" in capsys.readouterr().out


def test_cli_validar_conta_por_situacao(tmp_path, monkeypatch, capsys, escrever_caso):
    escrever_caso("derm-001-teste", caso_minimo())
    monkeypatch.setattr(carregar, "PASTA_CASOS", tmp_path)
    assert main(["validar"]) == 0
    assert "1 caso válido — 0 aprovados, 1 pendente, 0 a corrigir" in capsys.readouterr().out


def test_cli_folha_grava_o_arquivo(tmp_path, monkeypatch, escrever_caso):
    escrever_caso("derm-001-teste", caso_minimo())
    monkeypatch.setattr(carregar, "PASTA_CASOS", tmp_path)
    assert main(["folha"]) == 0
    assert "Casos de teste" in (tmp_path / "revisao.html").read_text(encoding="utf-8")
