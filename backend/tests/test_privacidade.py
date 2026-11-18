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
