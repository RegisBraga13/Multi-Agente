"""Ajudantes dos testes: um caso mínimo válido e um gravador de YAML."""

from pathlib import Path

import pytest
import yaml


def caso_minimo() -> dict:
    """Dicionário válido para `Caso` — cada teste altera só o que quer provar."""
    return {
        "versao_formato": 2,
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
            "historia": {"fatos": ["Espinhas no rosto há 6 meses"], "vazias": ["hf"]},
            "diagnosticos": {"principal": {"nome": "Acne vulgar", "cid": "L70.0", "certeza": "clinico"}},
            "sinais": {"disparados": []},
            "conduta": {"protocolo": "acne", "urgencia": "rotina", "obrigatorios": ["Tratamento tópico para acne"]},
        },
    }


@pytest.fixture
def escrever_caso(tmp_path: Path):
    def escrever(nome: str, dados: dict) -> Path:
        caminho = tmp_path / f"{nome}.yaml"
        caminho.write_text(yaml.safe_dump(dados, allow_unicode=True, sort_keys=False), encoding="utf-8")
        return caminho

    return escrever


def sinal(id_: str, texto: str = "Texto do sinal", tipo: str = "urgencia_imediata"):
    """SinalAlerta para testes (prazo coerente com o tipo)."""
    from app.especialidades.pacote import SinalAlerta

    prazo = {"urgencia_imediata": "imediato", "prioridade": "em semanas", "muda_tratamento": "antes de prescrever"}[
        tipo
    ]
    return SinalAlerta(id=id_, texto=texto, porque="Motivo.", tipo=tipo, acao=["Agir"], prazo=prazo)


@pytest.fixture
def ambiente():
    """(repositório da consulta em memória, médico A, médico B, paciente do médico A)."""
    from datetime import date
    from uuid import uuid4

    from app.consulta.repositorio import RepositorioConsultasMemoria
    from app.contratos.paciente import NovoPaciente
    from app.pacientes.repositorio import RepositorioPacientesMemoria

    pacientes = RepositorioPacientesMemoria()
    a, b = uuid4(), uuid4()
    paciente = pacientes.criar(a, NovoPaciente(nome="Paciente Teste", nascimento=date(1992, 3, 10), sexo="F"))
    return RepositorioConsultasMemoria(pacientes), a, b, paciente.id
