import pytest

from app.especialidades.pacote import SinalAlerta
from casos_de_teste.carregar import validar_pasta
from conftest import caso_minimo

SINAIS = [SinalAlerta(id="angioedema", texto="Inchaço de lábios/língua ou falta de ar", porque="Via aérea.")]


def test_pasta_valida(escrever_caso, tmp_path):
    escrever_caso("derm-001-teste", caso_minimo())
    r = validar_pasta(tmp_path, SINAIS)
    assert r.ok and len(r.casos) == 1


def test_texto_acentuado_carrega(escrever_caso, tmp_path):
    d = caso_minimo()
    d["entrada"]["falas"][1]["texto"] = "Coça à noite, não melhora com açúcar."
    escrever_caso("derm-001-teste", d)
    assert validar_pasta(tmp_path, SINAIS).casos[0].entrada.falas[1].texto.startswith("Coça à")


def test_id_diferente_do_arquivo(escrever_caso, tmp_path):
    escrever_caso("derm-002-outro", caso_minimo())
    assert any("derm-002-outro" in e and "nome do arquivo" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_id_repetido(escrever_caso, tmp_path):
    escrever_caso("derm-001-teste", caso_minimo())
    escrever_caso("derm-002-teste", caso_minimo())  # mesmo id derm-001-teste num arquivo de outro nome
    assert any("repetido" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_sinal_inexistente(escrever_caso, tmp_path):
    d = caso_minimo()
    d["esperado"]["sinais"]["disparados"] = ["angiodema"]
    escrever_caso("derm-001-teste", d)
    assert any("angiodema" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_sinal_perguntado_inexistente(escrever_caso, tmp_path):
    d = caso_minimo()
    d["entrada"]["sinais"] = [{"sinal": "febre", "resposta": "f"}]
    escrever_caso("derm-001-teste", d)
    assert any("febre" in e for e in validar_pasta(tmp_path, SINAIS).erros)


@pytest.mark.parametrize("texto", ["Meu CPF é 123.456.789-09.", "Liga no (11) 98765-4321.", "Manda para ana@email.com."])
def test_dado_de_identidade_e_recusado(escrever_caso, tmp_path, texto):
    d = caso_minimo()
    d["entrada"]["falas"][1]["texto"] = texto
    escrever_caso("derm-001-teste", d)
    assert any("identidade" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_dado_de_identidade_no_exame_e_recusado(escrever_caso, tmp_path):
    d = caso_minimo()
    d["entrada"]["exame"]["achados"] = "Contato: ana@email.com"
    escrever_caso("derm-001-teste", d)
    assert any("identidade" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_medidas_clinicas_nao_sao_confundidas_com_identidade(escrever_caso, tmp_path):
    d = caso_minimo()
    d["entrada"]["falas"][1]["texto"] = "Faz 6 meses; a lesão tem 8 mm e a glicemia deu 126 mg/dL em 2026."
    escrever_caso("derm-001-teste", d)
    assert validar_pasta(tmp_path, SINAIS).ok


def test_um_arquivo_ruim_nao_esconde_os_outros(escrever_caso, tmp_path):
    escrever_caso("derm-001-teste", caso_minimo())
    (tmp_path / "derm-002-quebrado.yaml").write_text("id: [", encoding="utf-8")
    r = validar_pasta(tmp_path, SINAIS)
    assert len(r.casos) == 1 and any("derm-002-quebrado" in e for e in r.erros)


def test_erro_de_formato_diz_o_campo(escrever_caso, tmp_path):
    d = caso_minimo()
    d["entrada"]["paciente"]["idade"] = 200
    escrever_caso("derm-001-teste", d)
    assert any("entrada.paciente.idade" in e for e in validar_pasta(tmp_path, SINAIS).erros)


def test_pasta_vazia(tmp_path):
    assert validar_pasta(tmp_path, SINAIS).erros == ["nenhum caso encontrado"]


@pytest.mark.parametrize("texto", ["Meu zap é 98765-4321.", "Liga no (11) 98765 4321.", "Liga no 11 98765 4321.", "É 9 8765 4321."])
def test_telefone_com_espacos_e_recusado(escrever_caso, tmp_path, texto):
    d = caso_minimo()
    d["entrada"]["falas"][1]["texto"] = texto
    escrever_caso("derm-001-teste", d)
    assert any("identidade" in e for e in validar_pasta(tmp_path, SINAIS).erros)


@pytest.mark.parametrize("texto", ["Plaquetas 250.000-300.000.", "Biópsia em 15/03/2024.", "Lesão de 120x80 mm.", "Infarto em 2019."])
def test_numeros_clinicos_nao_sao_telefone(escrever_caso, tmp_path, texto):
    d = caso_minimo()
    d["entrada"]["falas"][1]["texto"] = texto
    escrever_caso("derm-001-teste", d)
    assert validar_pasta(tmp_path, SINAIS).ok


def test_chave_repetida_no_yaml_e_recusada(escrever_caso, tmp_path):
    caminho = escrever_caso("derm-001-teste", caso_minimo())
    texto = caminho.read_text(encoding="utf-8").replace("      hda:\n", "      hda:\n      - meses\n      hda:\n", 1)
    caminho.write_text(texto, encoding="utf-8")
    assert any("repetida" in e for e in validar_pasta(tmp_path, SINAIS).erros)
