"""Abrir a consulta a partir de um pedido da agenda: cria o paciente (ou reaproveita) e a consulta, uma vez só.

A consulta só começa com a Identificação preenchida (regra do autor): pedido sem formulário é recusado.
"""

from uuid import UUID

from app.agenda.repositorio import RepositorioAgenda, instante
from app.consulta.repositorio import RepositorioConsultas
from app.consulta.servico import ErroEtapa
from app.contratos.consulta_blocos import Consulta, NovaConsulta
from app.contratos.paciente import NovoPaciente
from app.pacientes.repositorio import RepositorioPacientes

SEM_IDENTIFICACAO = "Preencha a Identificação do paciente antes de abrir a consulta"


def abrir_do_pedido(
    agenda: RepositorioAgenda,
    pacientes: RepositorioPacientes,
    consultas: RepositorioConsultas,
    medico_id: UUID,
    pedido_id: UUID,
    especialidade: str,
) -> Consulta:
    pedido = agenda.pedido(medico_id, pedido_id)  # PedidoNaoEncontrado: pedido de outro médico também
    existente = consultas.do_pedido(medico_id, pedido_id)
    if existente is not None:
        return existente
    if pedido.formulario is None:
        raise ErroEtapa(SEM_IDENTIFICACAO)
    d = pedido.formulario.dados
    paciente = pacientes.procurar(medico_id, d.nome_completo, d.nascimento) or pacientes.criar(
        medico_id,
        NovoPaciente(
            nome=d.nome_completo,
            nascimento=d.nascimento,
            sexo=d.sexo,
            estado_civil=d.estado_civil or None,
            profissao=d.profissao or None,
            telefone=pedido.whatsapp,
        ),
    )
    nova = NovaConsulta(
        paciente_id=paciente.id,
        tipo="consulta",  # a próxima vez do paciente é nova consulta; só o cartão Retorno abre retorno
        modalidade=pedido.modalidade,
        agendada_para=instante(pedido.data, pedido.inicio),
        especialidade=especialidade,
    )
    return consultas.criar(medico_id, nova, pedido_id)


def abrir_do_retorno(
    agenda: RepositorioAgenda,
    consultas: RepositorioConsultas,
    medico_id: UUID,
    retorno_id: UUID,
    especialidade: str,
) -> Consulta:
    """Abre o retorno do cartão da agenda, uma vez só; o mesmo se já aberto (inclusive finalizado)."""
    cartao = agenda.retorno(medico_id, retorno_id)  # RetornoNaoEncontrado: cartão de outro médico também
    existente = consultas.do_retorno(medico_id, retorno_id)
    if existente is not None:
        return existente
    nova = NovaConsulta(
        paciente_id=cartao.paciente_id,
        tipo="retorno",
        modalidade=cartao.modalidade,
        agendada_para=instante(cartao.data, cartao.inicio),
        especialidade=especialidade,
    )
    return consultas.criar(medico_id, nova, retorno_id=retorno_id)
