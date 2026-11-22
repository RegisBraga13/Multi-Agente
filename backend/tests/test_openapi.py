from app.openapi import esquema_openapi


def test_openapi_publica_pacientes():
    esquema = esquema_openapi()
    assert "/pacientes" in esquema["paths"] and "/pacientes/{paciente_id}" in esquema["paths"]
    assert "estadoCivil" in esquema["components"]["schemas"]["Paciente"]["properties"]


def test_openapi_publica_consultas():
    caminhos = esquema_openapi()["paths"]
    assert "/consultas" in caminhos and "/consultas/{consulta_id}/{etapa}/gerar" in caminhos
    assert "/consultas/{consulta_id}/anamnese" in caminhos and "/consultas/{consulta_id}/documentos/{tipo}" in caminhos


def test_openapi_publica_retornos():
    esquema = esquema_openapi()
    assert "/agenda/retornos" in esquema["paths"]
    assert "retornoMarcado" in esquema["components"]["schemas"]["Finalizacao"]["properties"]
