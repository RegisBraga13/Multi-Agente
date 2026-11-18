"""Um caso de teste vira a entrada desidentificada que os motores recebem."""

from app.contratos.consulta import (
    Alergia,
    EntradaConsulta,
    ExameComplementar,
    ExameDerm,
    Fala,
    ItemComplementar,
    SinalRespondido,
)
from app.especialidades.pacote import SinalAlerta
from app.privacidade import descrever_paciente
from casos_de_teste.formato import Caso


def entrada_do_caso(caso: Caso, sinais: dict[str, SinalAlerta]) -> EntradaConsulta:
    e, p = caso.entrada, caso.entrada.paciente
    return EntradaConsulta(
        paciente=descrever_paciente(p.idade, p.sexo, p.estado_civil, p.profissao),
        em_uso=list(p.em_uso),
        antecedentes=list(p.antecedentes),
        alergias=[Alergia(substancia=a.substancia, reacao=a.reacao) for a in p.alergias],
        falas=[Fala(quem=f.quem, texto=f.texto) for f in e.falas],
        sinais=[
            SinalRespondido(id=s.sinal, texto=sinais[s.sinal].texto, resposta="sim" if s.resposta == "v" else "nao")
            for s in e.sinais
        ],
        exame=ExameDerm(**e.exame.model_dump()),
        complementares=[
            ExameComplementar(
                exame=c.exame,
                data=c.data,
                origem="caso de teste",
                itens=[
                    ItemComplementar(
                        nome=i.nome,
                        valor=i.valor,
                        status="MISSING" if i.valor is None else "PRESENT",
                        aviso=None,
                        evidencia=None,
                    )
                    for i in c.itens
                ],
            )
            for c in e.complementares
        ],
    )
