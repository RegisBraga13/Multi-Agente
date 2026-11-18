from conftest import caso_minimo, sinal

from casos_de_teste import carregar
from casos_de_teste.__main__ import main
from casos_de_teste.folha import montar_folha
from casos_de_teste.formato import Caso

SINAIS = [
    sinal("angioedema", "Inchaço de lábios/língua ou falta de ar"),
    sinal("gestacao-ou-plano", "Gestante", "muda_tratamento"),
]


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


def test_certeza_aparece_no_diagnostico():
    d = caso_minimo()
    d["esperado"]["diagnosticos"]["principal"].update(nome="Melanoma", cid="C43.5", certeza="suspeita")
    assert "Entre os 3 diagnósticos: suspeita de Melanoma (C43.5)" in folha(d)


def test_conduta_mostra_urgencia_criterios_e_receita_proibida():
    d = caso_minimo()
    d["esperado"]["conduta"].update(
        urgencia="imediata", proibidos=["Tratar em ambulatório"], remedios_proibidos=["isotretinoína"]
    )
    html = folha(d)
    assert "Urgência: imediata" in html
    assert "Tratamento tópico para acne" in html and "Tratar em ambulatório" in html
    assert "Não pode estar na receita: isotretinoína" in html


def test_historia_mostra_fatos_negativas_e_desconhecidos():
    d = caso_minimo()
    d["esperado"]["historia"].update(negativas=["febre"], desconhecidos=["história familiar"])
    html = folha(d)
    assert "Espinhas no rosto há 6 meses" in html
    assert "Tem de constar como negado: febre" in html
    assert "Não perguntado ou não examinado (não pode virar afirmação nem “nega”): história familiar" in html


def test_sinais_nao_perguntados_sao_ditos():
    d = caso_minimo()
    d["entrada"]["sinais"] = [{"sinal": "angioedema", "resposta": "f"}]
    html = folha(d)
    assert "Inchaço de lábios/língua ou falta de ar — Não" in html
    assert "Não perguntados: Gestante" in html


def test_lista_de_sinais_mostra_tipo_prazo_e_acao():
    html = folha(caso_minimo())
    assert "Urgência imediata" in html and "Muda o tratamento" in html
    assert "imediato" in html and "Agir" in html


def test_folha_mostra_perguntado_sem_resposta():
    d = caso_minimo()
    d["esperado"]["historia"]["sem_resposta"] = ["duração"]
    assert "Perguntado, mas o paciente não soube: duração" in folha(d)
