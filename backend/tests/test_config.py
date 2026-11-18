import importlib
import sys
from uuid import UUID

import pytest

from app.config import ErroConfiguracao, carregar_configuracao

ID = "00000000-0000-4000-8000-000000000001"


def test_configuracao_completa():
    c = carregar_configuracao({"DATABASE_URL": "postgresql://x", "MEDICO_LOCAL_ID": ID})
    assert c.database_url == "postgresql://x" and c.medico_local_id == UUID(ID)


def test_falta_database_url():
    with pytest.raises(ErroConfiguracao, match="DATABASE_URL"):
        carregar_configuracao({"MEDICO_LOCAL_ID": ID})


def test_falta_medico_local_id():
    with pytest.raises(ErroConfiguracao, match="MEDICO_LOCAL_ID"):
        carregar_configuracao({"DATABASE_URL": "postgresql://x"})


def test_medico_id_invalido():
    with pytest.raises(ErroConfiguracao, match="MEDICO_LOCAL_ID"):
        carregar_configuracao({"DATABASE_URL": "x", "MEDICO_LOCAL_ID": "abc"})


def test_servidor_sem_configuracao_falha_na_partida(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("MEDICO_LOCAL_ID", raising=False)
    sys.modules.pop("app.main", None)
    with pytest.raises(ErroConfiguracao):
        importlib.import_module("app.main")


def test_ia_provedor_padrao_e_demonstracao():
    c = carregar_configuracao({"DATABASE_URL": "x", "MEDICO_LOCAL_ID": ID})
    assert c.ia_provedor == "demonstracao"


def test_anthropic_sem_chave_falha_na_partida():
    with pytest.raises(ErroConfiguracao, match="ANTHROPIC_API_KEY"):
        carregar_configuracao({"DATABASE_URL": "x", "MEDICO_LOCAL_ID": ID, "IA_PROVEDOR": "anthropic"})
    c = carregar_configuracao(
        {"DATABASE_URL": "x", "MEDICO_LOCAL_ID": ID, "IA_PROVEDOR": "anthropic", "ANTHROPIC_API_KEY": "sk-ant-x"}
    )
    assert c.ia_provedor == "anthropic"


def test_ia_provedor_desconhecido_falha():
    with pytest.raises(ErroConfiguracao, match="IA_PROVEDOR"):
        carregar_configuracao({"DATABASE_URL": "x", "MEDICO_LOCAL_ID": ID, "IA_PROVEDOR": "outro"})
