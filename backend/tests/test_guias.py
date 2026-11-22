import pytest

from app.especialidades.guias import carregar_guias
from app.especialidades.pacote import PacoteInvalido


def test_carrega_os_guias_da_dermatologia():
    guias = carregar_guias("dermatologia")
    assert [g.id for g in guias] == [
        "acne",
        "infeccoes-da-pele",
        "lesao-suspeita-de-cancer-de-pele",
        "psoriase-e-dermatites",
        "queda-de-cabelo-e-unhas",
        "urticaria-e-reacao-a-medicamento",
    ]
    assert all(g.situacao == "aprovado" and g.titulo and g.texto for g in guias)  # revisados pelo autor em 22/11/2026
    assert not any("Rascunho" in g.texto for g in guias)  # a IA lê o texto: nada de aviso de rascunho nele


def test_guia_sem_titulo_e_invalido(tmp_path):
    pasta = tmp_path / "dermatologia" / "guias"
    pasta.mkdir(parents=True)
    (pasta / "x.md").write_text("situacao: pendente\nTexto.\n", encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="x.md"):
        carregar_guias("dermatologia", raiz=tmp_path)


def test_guia_com_situacao_desconhecida_ou_texto_vazio_e_invalido(tmp_path):
    pasta = tmp_path / "dermatologia" / "guias"
    pasta.mkdir(parents=True)
    (pasta / "a.md").write_text("titulo: A\nsituacao: talvez\nTexto.\n", encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="a.md"):
        carregar_guias("dermatologia", raiz=tmp_path)
    (pasta / "a.md").write_text("titulo: A\nsituacao: aprovado\n\n", encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="a.md"):
        carregar_guias("dermatologia", raiz=tmp_path)


def test_especialidade_sem_pasta_de_guias_devolve_lista_vazia(tmp_path):
    assert carregar_guias("geriatria", raiz=tmp_path) == []
