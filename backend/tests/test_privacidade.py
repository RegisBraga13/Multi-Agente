import pytest

from app.privacidade import descrever_paciente, encontrar_identidade


def test_descreve_sem_identidade():
    assert descrever_paciente(52, "M", "casado", "comerciante") == "Paciente, 52 anos, masculino, casado, comerciante"
    assert descrever_paciente(34, "F", None, None) == "Paciente, 34 anos, feminino"


def test_descreve_um_ano():
    assert descrever_paciente(1, "F", None, None) == "Paciente, 1 ano, feminino"


@pytest.mark.parametrize(
    "texto,tipo", [("CPF 123.456.789-09", "CPF"), ("zap 98765-4321", "telefone"), ("ana@x.com", "e-mail")]
)
def test_encontra_identidade(texto, tipo):
    assert tipo in encontrar_identidade(texto)


def test_numero_clinico_nao_e_identidade():
    assert encontrar_identidade("Plaquetas 250.000-300.000; lesão de 8 mm em 2019") == []


def test_cpf_com_espacos():
    assert "CPF" in encontrar_identidade("CPF 123 456 789 10")


def test_descrever_paciente_intersexo():
    assert descrever_paciente(40, "I", None, None) == "Paciente, 40 anos, intersexo"


def test_idade_de_bebe_em_meses():
    from datetime import date

    from app.privacidade import idade_em_texto

    hoje = date(2026, 11, 26)
    assert idade_em_texto(date(2026, 11, 14), hoje) == "12 dias"
    assert idade_em_texto(date(2026, 10, 26), hoje) == "1 mês"
    assert idade_em_texto(date(2026, 3, 27), hoje) == "7 meses"
    assert idade_em_texto(date(2024, 11, 27), hoje) == "23 meses"
    assert idade_em_texto(date(2024, 11, 26), hoje) == "2 anos"
    assert idade_em_texto(date(1974, 1, 1), hoje) == "52 anos"
    assert descrever_paciente(idade_em_texto(date(2026, 3, 27), hoje), "F", None, None) == "Paciente, 7 meses, feminino"
