import pytest

from app.prontuario.titulo import titulo_nova_entrada


@pytest.mark.parametrize(
    ("antes", "tipo", "titulo"),
    [
        ([], "consulta", "Consulta 1"),
        ([("consulta", "2026-11-01", "08:00")], "consulta", "Consulta 2"),
        ([("consulta", "2026-11-01", "08:00")], "retorno", "Consulta 1 — Retorno"),
        (
            [("retorno", "2026-11-10", "08:00"), ("consulta", "2026-11-01", "08:00")],
            "retorno",
            "Consulta 1 — Retorno 2",
        ),
        ([], "retorno", "Consulta 1 — Retorno"),
        (
            [
                ("consulta", "2026-10-01", "08:00"),
                ("retorno", "2026-10-20", "08:00"),
                ("consulta", "2026-11-01", "08:00"),
            ],
            "retorno",
            "Consulta 2 — Retorno",
        ),
    ],
)
def test_titulo_consulta_e_retornos(antes, tipo, titulo):
    assert titulo_nova_entrada(antes, tipo) == titulo
