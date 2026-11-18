import pytest

from app.especialidades.pacote import PacoteInvalido
from app.especialidades.prompts import carregar_prompt


def test_prompt_sem_versao_e_invalido(tmp_path):
    (tmp_path / "dermatologia" / "prompts").mkdir(parents=True)
    (tmp_path / "dermatologia" / "prompts" / "x.md").write_text("Sem versão.\n", encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="versao"):
        carregar_prompt("dermatologia", "x", raiz=tmp_path)


def test_prompt_inexistente_e_invalido(tmp_path):
    with pytest.raises(PacoteInvalido, match="não encontrado"):
        carregar_prompt("dermatologia", "nada", raiz=tmp_path)


def test_prompt_da_historia_tem_versao_e_texto_sem_a_linha_da_versao():
    p = carregar_prompt("dermatologia", "historia")
    assert p.versao == "historia-derm-2"
    assert "versao:" not in p.texto and "não examinado" in p.texto
