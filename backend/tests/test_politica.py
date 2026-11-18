import pytest

from app.consulta.politica import decidir


def test_invalida_rejeita():
    acao, motivos = decidir(False, None)
    assert acao == "REJECT" and motivos


@pytest.mark.parametrize("c", [None, 0.0, 0.5, 0.99, 1.0])
def test_valida_sempre_vai_ao_medico(c):
    assert decidir(True, c)[0] == "HUMAN_REVIEW"
