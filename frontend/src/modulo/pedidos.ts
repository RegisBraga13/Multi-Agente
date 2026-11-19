// Pedidos feitos na página do médico (servidor) entram na agenda do dia como atendimentos.
// Sem nascimento até o formulário chegar ('' = ainda não informado).
import { horaCurta, rotuloDiaLongo } from '../medico/textos'
import type { Medico } from '../medico/tipos'
import type { PedidoNaAgenda } from '../servidor/agenda'
import { ordenarPorHorario } from './dia'
import type { Atendimento, Ficha } from './tipos'

const SEM_ALERGIA = 'Não tenho alergia'

const hora = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()
const lista = (v: string | string[] | undefined) => (texto(v) ? [texto(v)] : [])

function fichaDoPedido(p: PedidoNaAgenda): Ficha {
  const f = p.formulario
  if (p.situacaoFicha !== 'pronta' || !f) return { situacao: p.situacaoFicha === 'link-enviado' ? 'link-enviado' : 'sem-ficha' }
  const alergia = texto(f.respostas.alergias)
  return {
    situacao: 'pronta',
    recebidaAs: hora(f.recebidoEm),
    sexo: f.dados.sexo,
    estadoCivil: f.dados.estadoCivil,
    profissao: f.dados.profissao,
    queixa: texto(f.respostas.queixa),
    emUso: lista(f.respostas.medicamentos),
    antecedentes: lista(f.respostas.doencas),
    alergias: alergia && alergia !== SEM_ALERGIA ? [{ substancia: alergia, reacao: '' }] : [],
    transcricao: p.transcricao,
  }
}

export function atendimentoDoPedido(p: PedidoNaAgenda, agora: Date): Atendimento {
  const d = p.formulario?.dados
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  return {
    id: `pedido-${p.id}`,
    inicio: p.inicio,
    paciente: { id: `pedido-${p.id}`, nome: d?.nomeCompleto || p.nome, nascimento: d?.nascimento ?? '' },
    tipo: 'consulta',
    modalidade: p.modalidade,
    pagamento: p.pagamento,
    ficha: fichaDoPedido(p),
    atendido: p.data < hoje,
    temHistorico: false,
    pedido: { id: p.id, whatsapp: p.whatsapp, token: p.tokenFormulario, novo: p.status === 'novo', chegouAs: hora(p.criadoEm) },
  }
}

/** Agenda do dia com os pedidos: o pedido ocupa o horário (sai o paciente de exemplo daquele horário). */
export function juntarPedidos(lista: Atendimento[], pedidos: PedidoNaAgenda[], dia: string, agora: Date): Atendimento[] {
  const doDia = pedidos.filter((p) => p.data === dia && p.status !== 'cancelado')
  const horas = new Set(doDia.map((p) => p.inicio))
  return ordenarPorHorario([...lista.filter((x) => !horas.has(x.inicio)), ...doDia.map((p) => atendimentoDoPedido(p, agora))])
}

/** Mensagem pronta do consultório para o paciente, com o link do formulário. */
export function mensagemDoFormulario(p: PedidoNaAgenda, medico: Medico, endereco: string): string {
  const primeiro = p.nome.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Para a sua consulta com ${medico.tratamento} ${medico.nome}, ${rotuloDiaLongo(p.data)}, às ${horaCurta(p.inicio)}`
    + ` (${p.modalidade}), preencha o formulário: ${endereco}/formulario/${p.tokenFormulario}`
}
