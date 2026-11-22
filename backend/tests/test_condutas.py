import shutil

import pytest
import yaml

from app.especialidades.condutas import (
    aplicar_protocolo,
    carregar_protocolos,
    emergencia_por_sinais,
    protocolo_do_cid,
    urgencia_por_sinais,
)
from app.especialidades.pacote import PASTA_ESPECIALIDADES, PacoteInvalido, carregar_sinais
from app.motores.sinais import SinalDisparado

LISTA = {s.id: s for s in carregar_sinais("dermatologia")}
PROTOCOLOS = carregar_protocolos("dermatologia")
ACNE = PROTOCOLOS["acne"]


def sinal(id_: str) -> SinalDisparado:
    s = LISTA[id_]
    return SinalDisparado(
        id=s.id, texto=s.texto, tipo=s.tipo, acao=s.acao, prazo=s.prazo, origem="respondido", trecho=None
    )


def opcao(p, grupo: str, id_: str):
    g = next(g for g in p.grupos if g.id == grupo)
    return next(o for linha in g.linhas for o in linha.opcoes if o.id == id_)


def ids(proposta, grupo: str) -> list[str]:
    g = next(g for g in proposta.grupos if g.id == grupo)
    return [o.id for linha in g.linhas for o in linha.opcoes]


def test_acne_carrega_e_bate_com_o_frontend():
    adap = opcao(ACNE, "topico", "adapaleno-bpo")
    [item] = adap.receita
    assert (item.nome, item.forma, item.concentracao) == ("Adapaleno + peróxido de benzoíla", "GEL", "0,1% + 2,5%")
    assert (item.quantidade.n, item.quantidade.unidade, item.duracao) == (1, "bisn. 30g", "8sem")
    assert item.posologia == (
        "Aplicar camada fina no rosto à noite, sobre a pele limpa e seca, evitando olhos, cantos do nariz e lábios."
    )
    iso = opcao(ACNE, "sistemico", "isotretinoina").receita[0]
    assert iso.controlado is True and iso.duracao == "30 dias" and iso.via == "oral"
    assert opcao(ACNE, "orientacoes", "8s").dias == 56
    assert [g.id for g in ACNE.grupos] == ["cuidados", "topico", "sistemico", "orientacoes"]


def test_protocolo_pelo_cid():
    assert protocolo_do_cid(PROTOCOLOS, "L70.0").chave == "acne"
    assert protocolo_do_cid(PROTOCOLOS, "L40.0") is None


def test_sem_sinal_nada_bloqueado_e_origem_com_versao():
    t = aplicar_protocolo(ACNE, [])
    assert t.bloqueadas == [] and t.origem == "protocolo acne v1"
    assert ids(t, "topico")[0] == "adapaleno-bpo"


def test_gestacao_bloqueia_e_poe_azelaico_primeiro():
    t = aplicar_protocolo(ACNE, [sinal("gestacao-ou-suspeita")])
    assert "isotretinoina" not in ids(t, "sistemico") and ids(t, "topico")[0] == "azelaico"
    assert {b.opcao for b in t.bloqueadas} >= {"isotretinoina", "adapaleno", "doxiciclina", "espironolactona"}
    assert t.motivos_ordem["topico"] == "gestacao-ou-suspeita"


def test_plano_de_gravidez_futura_nao_tira_nada_e_poe_azelaico_primeiro():
    t = aplicar_protocolo(ACNE, [sinal("plano-gravidez")])
    assert t.bloqueadas == [] and "isotretinoina" in ids(t, "sistemico")
    assert ids(t, "topico")[0] == "azelaico"


def test_virilizacao_poe_perfil_hormonal_e_gineco_primeiro():
    t = aplicar_protocolo(ACNE, [sinal("virilizacao")])
    assert ids(t, "orientacoes")[0] == "hormonal"
    enc = next(linha for g in t.grupos for linha in g.linhas if linha.id == "encaminhamento")
    assert enc.opcoes[0].id == "gineco" and enc.multipla


def test_urgencia_por_sinais():
    assert urgencia_por_sinais([]) == "rotina"
    assert urgencia_por_sinais([sinal("gestacao-ou-suspeita")]) == "rotina"
    assert urgencia_por_sinais([sinal("lesao-pigmentada-abcde")]) == "prioritaria"
    assert urgencia_por_sinais([sinal("lesao-pigmentada-abcde"), sinal("angioedema")]) == "imediata"


def test_emergencia_so_de_urgencia_imediata():
    assert emergencia_por_sinais([sinal("angioedema")]) == LISTA["angioedema"].acao
    assert emergencia_por_sinais([sinal("lesao-pigmentada-abcde")]) == []


def test_emergencia_nao_repete_acao():
    dupla = emergencia_por_sinais([sinal("angioedema"), sinal("angioedema")])
    assert dupla == LISTA["angioedema"].acao


def _copia(tmp_path):
    destino = tmp_path / "dermatologia"
    shutil.copytree(PASTA_ESPECIALIDADES / "dermatologia", destino)
    return destino / "condutas" / "acne.yaml"


def test_regra_com_opcao_inexistente_e_pacote_invalido(tmp_path):
    arquivo = _copia(tmp_path)
    dados = yaml.safe_load(arquivo.read_text(encoding="utf-8"))
    dados["regras"][0]["opcoes"] = ["nao-existe"]
    arquivo.write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="nao-existe"):
        carregar_protocolos("dermatologia", raiz=tmp_path)


def test_contraindicacao_com_sinal_inexistente_e_pacote_invalido(tmp_path):
    arquivo = _copia(tmp_path)
    dados = yaml.safe_load(arquivo.read_text(encoding="utf-8"))
    dados["contraindicacoes"][0]["sinal"] = "sinal-inventado"
    arquivo.write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="sinal-inventado"):
        carregar_protocolos("dermatologia", raiz=tmp_path)


def test_cid_repetido_entre_protocolos_e_pacote_invalido(tmp_path):
    arquivo = _copia(tmp_path)
    dados = yaml.safe_load(arquivo.read_text(encoding="utf-8"))
    dados["chave"] = "acne-2"
    (arquivo.parent / "acne-2.yaml").write_text(yaml.safe_dump(dados, allow_unicode=True), encoding="utf-8")
    with pytest.raises(PacoteInvalido, match="L70.0"):
        carregar_protocolos("dermatologia", raiz=tmp_path)


def test_conduta_nao_chama_de_retorno_a_avaliacao_em_semanas():
    """ "Retorno" é só o marcado na agenda; a conduta recomenda "Avaliação em X semanas"."""
    for nome, p in PROTOCOLOS.items():
        for g in p.grupos:
            for linha in g.linhas:
                for o in linha.opcoes:
                    assert not o.texto.startswith("Retorno "), (nome, o.id)
    linha = next(li for g in ACNE.grupos for li in g.linhas if li.id == "retorno")
    assert linha.rotulo == "Avaliação" and opcao(ACNE, "orientacoes", "8s").texto == "Avaliação em 8 semanas."
