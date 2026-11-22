import json
from datetime import UTC, date, datetime
from uuid import uuid4

import pytest

from app.consulta.geracao import Contexto, gerar, gerar_perguntas
from app.consulta.repositorio import RepositorioConsultasMemoria
from app.consulta.servico import ErroEtapa, editar, oficializar
from app.contratos.consulta import Fala, SinalRespondido
from app.contratos.consulta_blocos import HistoriaBloco, NovaConsulta
from app.contratos.paciente import NovoPaciente
from app.especialidades.condutas import carregar_protocolos
from app.especialidades.pacote import PacoteInvalido, carregar_sinais
from app.especialidades.registro import Pacote
from app.motores.chamada import ErroPrivacidade
from app.pacientes.repositorio import RepositorioPacientesMemoria
from app.provedores.ia import PedidoIA, RespostaIA
from app.provedores.relogio import RelogioFixo
from tests.fabrica import ANAMNESE, EXAME, conduta, diagnosticos
from tests.fabrica import HISTORIA as HISTORIA_BLOCO

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


def perguntas_ia(p):
    q = {
        "texto": "A ferida sangra ao toque leve?",
        "seSim": "Refere sangramento ao toque leve.",
        "seNao": "Nega sangramento.",
        "sinalId": "lesao-sangra-facil",
    }
    return {"resultado": {"perguntas": [q]}, "meta": META}


PADRAO = {
    "perguntas": perguntas_ia,
    "sinais": lambda p: {"resultado": {"detectados": [], "extras": []}, "meta": META},
    "historia": historia_ia,
    "diagnosticos": dd_ia,
    "conduta": lambda p: {"resultado": {"grupos": []}, "meta": META},
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
        pacote=lambda _esp: Pacote(sinais=LISTA, protocolos=carregar_protocolos("dermatologia")),
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


def test_nome_com_particula_gera_normalmente():
    pacientes = RepositorioPacientesMemoria()
    medico = uuid4()
    p = pacientes.criar(medico, NovoPaciente(nome="Maria das Graças dos Santos", nascimento=date(1980, 1, 1), sexo="F"))
    repo = RepositorioConsultasMemoria(pacientes)
    c = repo.criar(
        medico, NovaConsulta(paciente_id=p.id, tipo="consulta", modalidade="presencial", agendada_para=QUANDO)
    )
    cen = (repo, pacientes, medico, c.id)
    oficializar_ate_exame(cen)
    r = gerar(contexto(cen, Roteiro()), medico, c.id, "historia")
    assert r.gravado


class MexeDuranteAGeracao(Roteiro):
    def __init__(self, acao, **trocas):
        super().__init__(**trocas)
        self.acao = acao

    def gerar(self, pedido, esquema, ao_escrever=None):
        if pedido.motor == "historia":
            self.acao()
        return super().gerar(pedido, esquema, ao_escrever)


def test_anterior_mudou_durante_a_geracao(cenario):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    provedor = MexeDuranteAGeracao(lambda: editar(repo, medico, cid, "exame", EXAME))
    r = gerar(contexto(cenario, provedor), medico, cid, "historia")
    assert not r.gravado and "mudou durante a geração" in r.mensagem
    assert repo.buscar(medico, cid).bloco("historia") is None


def test_medico_salvou_a_etapa_durante_a_geracao(cenario):
    from tests.fabrica import HISTORIA

    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    provedor = MexeDuranteAGeracao(lambda: editar(repo, medico, cid, "historia", HISTORIA))
    r = gerar(contexto(cenario, provedor), medico, cid, "historia")
    assert not r.gravado and "Sugestão da IA ao lado" in r.mensagem
    assert repo.buscar(medico, cid).bloco("historia").estado == "revisado_medico"


def test_idade_pelo_dia_da_consulta_no_fuso_do_consultorio():
    from datetime import timedelta, timezone

    pacientes = RepositorioPacientesMemoria()
    medico = uuid4()
    p = pacientes.criar(medico, NovoPaciente(nome="Joana Teste", nascimento=date(1992, 11, 14), sexo="F"))
    repo = RepositorioConsultasMemoria(pacientes)
    noite = datetime(2026, 11, 13, 23, 30, tzinfo=timezone(timedelta(hours=-3)))  # já é dia 14 em UTC
    c = repo.criar(
        medico,
        NovaConsulta(paciente_id=p.id, tipo="consulta", modalidade="presencial", agendada_para=noite.astimezone(UTC)),
    )
    cen = (repo, pacientes, medico, c.id)
    oficializar_ate_exame(cen)
    provedor = Roteiro()
    gerar(contexto(cen, provedor), medico, c.id, "historia")
    assert provedor.pedidos[0].dados["consulta"]["paciente"].startswith("Paciente, 33 anos")


def test_a_especialidade_da_consulta_escolhe_o_pacote():
    pedidas: list[str] = []
    pacientes = RepositorioPacientesMemoria()
    medico = uuid4()
    p = pacientes.criar(
        medico,
        NovoPaciente(nome="Ana Lima", nascimento=date(1990, 1, 1), sexo="F", cpf="12345678909", telefone="11987654321"),
    )
    repo = RepositorioConsultasMemoria(pacientes)
    c = repo.criar(
        medico,
        NovaConsulta(
            paciente_id=p.id, tipo="consulta", modalidade="presencial", agendada_para=QUANDO, especialidade="geriatria"
        ),
    )

    def pacote(esp):
        pedidas.append(esp)
        return Pacote(sinais=LISTA, protocolos={})

    ctx = Contexto(repo=repo, pacientes=pacientes, provedor=Roteiro(), relogio=RelogioFixo(QUANDO), pacote=pacote)
    editar(repo, medico, c.id, "anamnese", ANAMNESE)
    oficializar(repo, medico, c.id, "anamnese", QUANDO)
    editar(repo, medico, c.id, "exame", EXAME)
    oficializar(repo, medico, c.id, "exame", QUANDO)
    with pytest.raises(PacoteInvalido):  # Geriatria ainda não tem prompts: o servidor pediu a pasta dela
        gerar(ctx, medico, c.id, "historia")
    assert pedidas == ["geriatria"]


def test_perguntas_usam_a_especialidade_da_consulta():
    pedidas: list[str] = []
    pacientes = RepositorioPacientesMemoria()
    medico = uuid4()
    p = pacientes.criar(
        medico,
        NovoPaciente(nome="Ana Lima", nascimento=date(1990, 1, 1), sexo="F", cpf="12345678909", telefone="11987654321"),
    )
    repo = RepositorioConsultasMemoria(pacientes)
    c = repo.criar(
        medico,
        NovaConsulta(
            paciente_id=p.id, tipo="consulta", modalidade="presencial", agendada_para=QUANDO, especialidade="geriatria"
        ),
    )
    editar(repo, medico, c.id, "anamnese", ANAMNESE)
    editar(repo, medico, c.id, "exame", EXAME)
    repo.gravar_bloco(medico, c.id, "historia", "rascunho_ia", HISTORIA_BLOCO, None)

    def pacote(esp):
        pedidas.append(esp)
        return Pacote(sinais=LISTA, protocolos={})

    ctx = Contexto(repo=repo, pacientes=pacientes, provedor=Roteiro(), relogio=RelogioFixo(QUANDO), pacote=pacote)
    with pytest.raises(PacoteInvalido):  # Geriatria ainda não tem prompts: o servidor pediu a pasta dela
        gerar_perguntas(ctx, medico, c.id)
    assert pedidas == ["geriatria"]


def _ate_historia_com_perguntas(cenario, perguntas):
    oficializar_ate_exame(cenario)
    repo, _, medico, cid = cenario
    ctx = contexto(cenario, Roteiro())
    gerar(ctx, medico, cid, "historia")
    h = repo.buscar(medico, cid).bloco("historia").conteudo
    editar(repo, medico, cid, "historia", HistoriaBloco.model_validate(h | {"perguntas": perguntas}))
    oficializar(repo, medico, cid, "historia", QUANDO)
    return repo, medico, cid, ctx


def _pergunta(id_, sinal_id, resposta, texto="A?"):
    return {"id": id_, "texto": texto, "seSim": "Refere.", "seNao": "Nega.", "sinalId": sinal_id, "resposta": resposta}


def test_dd_recebe_so_as_respondidas_e_a_historia_nao_e_reescrita(cenario):
    perguntas = [_pergunta("p1", None, "sim", "Sangra?"), _pergunta("p2", None, None, "Dói?")]
    repo, medico, cid, ctx = _ate_historia_com_perguntas(cenario, perguntas)
    antes = repo.buscar(medico, cid).bloco("historia").conteudo
    provedor = Roteiro()
    gerar(contexto(cenario, provedor), medico, cid, "diagnosticos")
    dd = next(p for p in provedor.pedidos if p.motor == "diagnosticos")
    assert dd.dados["respostasDeAlerta"] == [{"texto": "Sangra?", "resposta": "sim"}]
    assert repo.buscar(medico, cid).bloco("historia").conteudo == antes


def test_dd_sem_respostas_nao_leva_a_chave_nova(cenario):
    repo, medico, cid, ctx = _ate_historia_com_perguntas(cenario, [_pergunta("p1", None, None)])
    provedor = Roteiro()
    gerar(contexto(cenario, provedor), medico, cid, "diagnosticos")
    assert "respostasDeAlerta" not in next(p for p in provedor.pedidos if p.motor == "diagnosticos").dados


def test_urgencia_respondida_sim_vai_para_a_conduta_com_a_resposta_fixa(cenario):
    sinal = next(s for s in LISTA if s.id == "angioedema")
    repo, medico, cid, ctx = _ate_historia_com_perguntas(cenario, [_pergunta("p1", "angioedema", "sim")])
    gerar(ctx, medico, cid, "diagnosticos")
    editar(repo, medico, cid, "diagnosticos", diagnosticos("confirmada"))
    oficializar(repo, medico, cid, "diagnosticos", QUANDO)
    r = gerar(ctx, medico, cid, "conduta")
    assert r.conteudo["proposta"]["urgencia"] == "imediata" and r.conteudo["proposta"]["emergencia"] == sinal.acao


def test_nao_ou_sem_resposta_nao_mudam_a_conduta(cenario):
    repo, medico, cid, ctx = _ate_historia_com_perguntas(
        cenario, [_pergunta("p1", "angioedema", "nao"), _pergunta("p2", "virilizacao", None)]
    )
    gerar(ctx, medico, cid, "diagnosticos")
    editar(repo, medico, cid, "diagnosticos", diagnosticos("confirmada"))
    oficializar(repo, medico, cid, "diagnosticos", QUANDO)
    r = gerar(ctx, medico, cid, "conduta")
    assert r.conteudo["proposta"]["urgencia"] != "imediata"
