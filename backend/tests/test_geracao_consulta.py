import json
from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.consulta.geracao import Contexto, gerar
from app.consulta.repositorio import RepositorioConsultasMemoria
from app.consulta.servico import ErroEtapa, editar, oficializar
from app.contratos.consulta import Fala, SinalRespondido
from app.contratos.consulta_blocos import NovaConsulta
from app.contratos.paciente import NovoPaciente
from app.especialidades.condutas import carregar_protocolos
from app.especialidades.pacote import carregar_sinais
from app.motores.chamada import ErroPrivacidade
from app.pacientes.repositorio import RepositorioPacientesMemoria
from app.provedores.ia import PedidoIA, RespostaIA
from app.provedores.relogio import RelogioFixo
from tests.fabrica import ANAMNESE, EXAME, conduta, diagnosticos

QUANDO = datetime(2026, 11, 13, 8, 0, tzinfo=UTC)
META = {"confianca": 0.9, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}
LISTA = carregar_sinais("dermatologia")


def historia_ia(p):
    h = {
        "qp": "Espinhas.",
        "hda": "Paciente, 34 anos, feminino, refere espinhas no rosto há 6 meses.",
        "ap": "",
        "hp": "",
        "hf": "",
        "exameFisico": "Pápulas e pústulas em face.",
        "examesTexto": "",
    }
    return {"resultado": h, "meta": META}


def dd_ia(p):
    ev = {"lado": "favor", "texto": "x", "secao": "exameFisico", "trecho": "Pápulas e pústulas"}
    hip = {"nome": "Acne vulgar", "cid": "L70.0", "certeza": "clinico", "pct": 85, "evidencias": [ev]}
    return {"resultado": {"hipoteses": [hip], "naoPodePerder": None, "rastrear": []}, "meta": META}


PADRAO = {
    "sinais": lambda p: {"resultado": {"detectados": [], "extras": []}, "meta": META},
    "historia": historia_ia,
    "diagnosticos": dd_ia,
    "conduta-complemento": lambda p: {"resultado": {"orientacoes": ["Orientar"], "alertas": []}, "meta": META},
    "conduta": lambda p: {"resultado": {"grupos": [], "alertas": []}, "meta": META},
}


class Roteiro:
    def __init__(self, **trocas):
        self.respostas = PADRAO | trocas
        self.pedidos: list[PedidoIA] = []

    def gerar(self, pedido, esquema, ao_escrever=None):
        self.pedidos.append(pedido)
        r = self.respostas[pedido.motor](pedido)
        if isinstance(r, str):
            return RespostaIA(None, "falso", "0", 1, 1, r)
        if ao_escrever:
            ao_escrever(json.dumps(r)[:20])
            ao_escrever(json.dumps(r))
        return RespostaIA(r, "falso", "0", 1, 1, None)


@pytest.fixture
def cenario():
    pacientes = RepositorioPacientesMemoria()
    medico = uuid4()
    p = pacientes.criar(
        medico,
        NovoPaciente(
            nome="Mariana Souza", nascimento=date(1992, 3, 10), sexo="F", cpf="12345678909", telefone="11987654321"
        ),
    )
    repo = RepositorioConsultasMemoria(pacientes)
    c = repo.criar(
        medico, NovaConsulta(paciente_id=p.id, tipo="consulta", modalidade="presencial", agendada_para=QUANDO)
    )
    return repo, pacientes, medico, c.id


def contexto(cenario, provedor):
    repo, pacientes, *_ = cenario
    return Contexto(
        repo=repo,
        pacientes=pacientes,
        provedor=provedor,
        relogio=RelogioFixo(QUANDO),
        sinais=LISTA,
        protocolos=carregar_protocolos("dermatologia"),
    )


def oficializar_ate_exame(cenario, anamnese=ANAMNESE):
    repo, _, medico, cid = cenario
    editar(repo, medico, cid, "anamnese", anamnese)
    oficializar(repo, medico, cid, "anamnese", QUANDO)
    editar(repo, medico, cid, "exame", EXAME)
    oficializar(repo, medico, cid, "exame", QUANDO)


def test_gerar_sem_predecessor_oficializado_e_409_sem_chamar_ia(cenario):
    provedor = Roteiro()
    with pytest.raises(ErroEtapa, match="Oficialize Exame físico antes"):
        gerar(contexto(cenario, provedor), cenario[2], cenario[3], "historia")
    assert provedor.pedidos == []


def test_gerar_historia_grava_rascunho_e_propostas(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    r = gerar(contexto(cenario, Roteiro()), medico, cid, "historia")
    assert r.acao == "HUMAN_REVIEW" and r.gravado
    b = repo.buscar(medico, cid).bloco("historia")
    assert b.estado == "rascunho_ia" and b.conteudo["historia"]["exameFisico"] == "Pápulas e pústulas em face."
    motores = [reg.motor for reg, _ in repo._dados[cid].propostas]
    assert motores == ["sinais", "historia"]


def test_historia_transmite_parciais(cenario):
    oficializar_ate_exame(cenario)
    parciais: list = []
    gerar(contexto(cenario, Roteiro()), cenario[2], cenario[3], "historia", ao_escrever=parciais.append)
    assert parciais and parciais[-1]["qp"] == "Espinhas."


def test_historia_leva_sinais_respondidos_mesmo_com_ia_falhando(cenario):
    sinal = next(s for s in LISTA if s.id == "angioedema")
    anamnese = ANAMNESE.model_copy(update={"sinais": [SinalRespondido(id=sinal.id, texto=sinal.texto, resposta="sim")]})
    oficializar_ate_exame(cenario, anamnese)
    r = gerar(contexto(cenario, Roteiro(sinais=lambda p: "timeout")), cenario[2], cenario[3], "historia")
    assert [s["id"] for s in r.conteudo["seguranca"]["sinais"]] == ["angioedema"]


def test_nome_na_fala_e_422_sem_chamar_ia(cenario):
    anamnese = ANAMNESE.model_copy(update={"falas": [Fala(quem="Paciente", texto="Sou a Mariana, tenho espinhas.")]})
    oficializar_ate_exame(cenario, anamnese)
    provedor = Roteiro()
    with pytest.raises(ErroPrivacidade):
        gerar(contexto(cenario, provedor), cenario[2], cenario[3], "historia")
    assert provedor.pedidos == []


def test_reject_nao_sobrescreve(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    r = gerar(contexto(cenario, Roteiro(historia=lambda p: "timeout")), medico, cid, "historia")
    assert (r.acao, r.gravado, r.conteudo) == ("REJECT", False, None)
    assert r.mensagem == "A IA não conseguiu; escreva ou tente de novo"
    assert repo.buscar(medico, cid).bloco("historia") is None


def test_bloco_revisado_nao_e_sobrescrito(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    ctx = contexto(cenario, Roteiro())
    gerar(ctx, medico, cid, "historia")
    b = repo.buscar(medico, cid).bloco("historia")
    from app.contratos.consulta_blocos import HistoriaBloco

    editado = HistoriaBloco.model_validate(b.conteudo)
    editado.historia.qp = "Escrita pelo médico."
    editar(repo, medico, cid, "historia", editado)
    r = gerar(ctx, medico, cid, "historia")
    assert not r.gravado and "Sugestão da IA ao lado" in r.mensagem and r.conteudo is not None
    assert repo.buscar(medico, cid).bloco("historia").conteudo["historia"]["qp"] == "Escrita pelo médico."


def test_diagnosticos_e_conduta(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    ctx = contexto(cenario, Roteiro())
    gerar(ctx, medico, cid, "historia")
    oficializar(repo, medico, cid, "historia", QUANDO)
    r = gerar(ctx, medico, cid, "diagnosticos")
    assert r.gravado and r.conteudo["itens"][0]["decisao"] == "pendente"
    editar(repo, medico, cid, "diagnosticos", diagnosticos("descartada", "confirmada"))
    oficializar(repo, medico, cid, "diagnosticos", QUANDO)
    provedor = Roteiro()
    r = gerar(contexto(cenario, provedor), medico, cid, "conduta")
    assert r.gravado and r.conteudo["diagnostico"]["cid"] == "L71.9"  # o primeiro CONFIRMADO (Rosácea)
    assert r.conteudo["textos"] == ["", "", "", ""] and provedor.pedidos[0].motor == "conduta"


def test_conduta_usa_a_seguranca_da_historia(cenario):
    sinal = next(s for s in LISTA if s.id == "angioedema")
    anamnese = ANAMNESE.model_copy(update={"sinais": [SinalRespondido(id=sinal.id, texto=sinal.texto, resposta="sim")]})
    oficializar_ate_exame(cenario, anamnese)
    repo, _, medico, cid = cenario
    ctx = contexto(cenario, Roteiro())
    gerar(ctx, medico, cid, "historia")
    oficializar(repo, medico, cid, "historia", QUANDO)
    editar(repo, medico, cid, "diagnosticos", diagnosticos("confirmada"))
    oficializar(repo, medico, cid, "diagnosticos", QUANDO)
    r = gerar(ctx, medico, cid, "conduta")
    assert r.conteudo["proposta"]["urgencia"] == "imediata" and r.conteudo["proposta"]["emergencia"] == sinal.acao


def test_pedido_nao_leva_nome_nem_cpf(cenario):
    oficializar_ate_exame(cenario)
    provedor = Roteiro()
    gerar(contexto(cenario, provedor), cenario[2], cenario[3], "historia")
    texto = json.dumps([p.dados for p in provedor.pedidos], ensure_ascii=False)
    assert "Mariana" not in texto and "Souza" not in texto and "12345678909" not in texto


def test_conduta_rejeitada_nao_grava(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    ctx = contexto(cenario, Roteiro())
    gerar(ctx, medico, cid, "historia")
    oficializar(repo, medico, cid, "historia", QUANDO)
    editar(repo, medico, cid, "diagnosticos", diagnosticos("descartada", "confirmada"))
    oficializar(repo, medico, cid, "diagnosticos", QUANDO)
    r = gerar(contexto(cenario, Roteiro(conduta=lambda p: "timeout")), medico, cid, "conduta")
    assert (r.acao, r.gravado) == ("REJECT", False) and repo.buscar(medico, cid).bloco("conduta") is None
    assert conduta  # fábrica disponível para outros testes
