from app.openapi import esquema_openapi


def test_openapi_publica_pacientes():
    esquema = esquema_openapi()
    assert "/pacientes" in esquema["paths"] and "/pacientes/{paciente_id}" in esquema["paths"]
    assert "estadoCivil" in esquema["components"]["schemas"]["Paciente"]["properties"]
