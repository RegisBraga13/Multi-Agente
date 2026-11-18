"""Ajudantes dos testes: um caso mínimo válido e um gravador de YAML."""
from pathlib import Path

import pytest
import yaml


def caso_minimo() -> dict:
    """Dicionário válido para `Caso` — cada teste altera só o que quer provar."""
    return {
        "versao_formato": 1,
        "id": "derm-001-teste",
        "especialidade": "dermatologia",
        "titulo": "Caso de teste",
        "objetivo": "Quadro típico.",
        "revisao": {"situacao": "pendente"},
        "entrada": {
            "paciente": {"idade": 34, "sexo": "F"},
            "falas": [
                {"quem": "Médico", "texto": "Bom dia! Me conta o que trouxe você aqui hoje."},
                {"quem": "Paciente", "texto": "Espinhas no rosto há 6 meses."},
            ],
            "sinais": [],
            "exame": {
                "morfologia": "Pápulas e pústulas",
                "localizacao": "Face",
                "extensao": "7 lesões",
                "gravidade": "Moderada",
                "achados": "Sem cicatrizes",
            },
        },
        "esperado": {
            "historia": {"deve_conter": {"hda": ["6 meses"]}, "vazias": ["hf"]},
            "diagnosticos": {"principal": {"nome": "Acne vulgar", "cid": "L70.0"}},
            "sinais": {"disparados": []},
            "conduta": {"protocolo": "acne"},
        },
    }


@pytest.fixture
def escrever_caso(tmp_path: Path):
    def escrever(nome: str, dados: dict) -> Path:
        caminho = tmp_path / f"{nome}.yaml"
        caminho.write_text(yaml.safe_dump(dados, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return caminho
    return escrever
