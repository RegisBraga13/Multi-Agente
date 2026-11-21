from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.contratos.consulta import ExameDerm, Fala, entrada_da_consulta, termos_do_paciente
from app.contratos.consulta_blocos import (
    CONTEUDO,
    ETAPAS,
    ETAPAS_IA,
    AnamneseBloco,
    CondutaBloco,
    ExameBloco,
)
from app.contratos.paciente import Paciente

PACIENTE = Paciente(
    id=uuid4(),
    criado_em=datetime(2026, 11, 1, tzinfo=UTC),
    nome="Mariana da Souza",
    nascimento=date(1992, 3, 10),
    sexo="F",
    estado_civil="casada",
    profissao="professora",
    cpf="12345678909",
    telefone="11987654321",
)
ANAMNESE = AnamneseBloco(
    queixa="Espinhas no rosto",
    falas=[Fala(quem="Paciente", texto="Espinhas no rosto há 6 meses.")],
    sinais=[],
    em_uso=[],
    antecedentes=[],
    alergias=[],
)
EXAME = ExameBloco(
    exame=ExameDerm(morfologia="Pápulas", localizacao="Face", extensao=None, gravidade=None, achados=None),
    complementares=[],
)


def test_entrada_da_consulta_e_desidentificada():
    e = entrada_da_consulta(PACIENTE, ANAMNESE, EXAME, date(2026, 11, 13))
    assert e.paciente == "Paciente, 34 anos, feminino, casada, professora"
    texto = e.model_dump_json()
    assert "Mariana" not in texto and "Souza" not in texto and "12345678909" not in texto
    assert e.falas[0].texto == "Espinhas no rosto há 6 meses." and e.exame.morfologia == "Pápulas"


def test_idade_na_data_da_consulta():
    assert entrada_da_consulta(PACIENTE, ANAMNESE, EXAME, date(2026, 3, 9)).paciente.startswith("Paciente, 33 anos")
    assert entrada_da_consulta(PACIENTE, ANAMNESE, EXAME, date(2026, 3, 10)).paciente.startswith("Paciente, 34 anos")


def test_termos_do_paciente():
    assert termos_do_paciente(PACIENTE) == ["Mariana", "Souza", "12345678909", "11987654321"]


def test_termos_sem_cpf_nem_telefone():
    p = PACIENTE.model_copy(update={"cpf": None, "telefone": None, "nome": "Ana Li"})
    assert termos_do_paciente(p) == ["Ana"]


def test_etapas_em_ordem():
    assert ETAPAS == ("anamnese", "exame", "historia", "diagnosticos", "conduta")
    assert ETAPAS_IA == ("historia", "diagnosticos", "conduta") and set(CONTEUDO) == set(ETAPAS)


def test_conteudo_por_etapa_valida():
    assert CONTEUDO["anamnese"].model_validate(ANAMNESE.model_dump(by_alias=True)) == ANAMNESE
    assert CONTEUDO["exame"].model_validate(EXAME.model_dump(by_alias=True)) == EXAME


def test_conduta_bloco_exige_4_textos():
    base = {
        "proposta": {
            "urgencia": "rotina",
            "emergencia": [],
            "tabela": None,
            "ia": None,
            "origem": "sugestão da IA",
            "avisos": [],
            "acao": "REJECT",
            "iaFalhou": True,
        },
        "diagnostico": {"nome": "Acne vulgar", "cid": "L70.0", "certeza": "clinico"},
        "escolha": {},
        "receita": [],
        "livres": [],
    }
    CondutaBloco.model_validate(base | {"textos": ["", "", "", ""]})
    with pytest.raises(ValidationError):
        CondutaBloco.model_validate(base | {"textos": ["", "", ""]})


def test_particulas_do_nome_nao_viram_termo():
    p = PACIENTE.model_copy(update={"nome": "José dos Santos de Souza e Silva", "cpf": None, "telefone": None})
    assert termos_do_paciente(p) == ["José", "Santos", "Souza", "Silva"]


ANAMNESE_ANTIGA = {"queixa": "Manchas", "falas": [], "sinais": [], "emUso": [], "antecedentes": [], "alergias": []}
EXAME_ANTIGO = {
    "exame": {"morfologia": None, "localizacao": None, "extensao": None, "gravidade": None, "achados": None},
    "complementares": [],
}


def test_anamnese_antiga_continua_valida():
    b = AnamneseBloco.model_validate(ANAMNESE_ANTIGA)
    assert (b.texto, b.perguntas, b.formulario) == ("", [], None)


def test_anamnese_com_perguntas_e_formulario_ida_e_volta():
    dados = {
        **ANAMNESE_ANTIGA,
        "texto": "Paciente refere manchas.",
        "perguntas": [{"texto": "Usa protetor solar?", "resposta": "sim", "detalhe": "todo dia"}],
        "formulario": {"respostas": {"desde_quando": "2 anos", "areas": ["rosto", "mãos"]}, "fotos": ["foto_rosto"]},
    }
    b = AnamneseBloco.model_validate(dados)
    assert AnamneseBloco.model_validate(b.model_dump(by_alias=True, mode="json")) == b
    assert b.perguntas[0].detalhe == "todo dia" and b.formulario.fotos == ["foto_rosto"]


def test_exame_antigo_continua_valido():
    assert ExameBloco.model_validate(EXAME_ANTIGO).observacoes == ""
