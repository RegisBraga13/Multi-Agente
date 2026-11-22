// Pedidos feitos na página do médico (servidor) entram na agenda do dia como atendimentos.
// Sem nascimento até o formulário chegar ('' = ainda não informado).
import { formatarWhatsapp, type DadosPessoais } from '../medico/regras'
import { horaCurta, rotuloDiaLongo } from '../medico/textos'
import type { Medico } from '../medico/tipos'
import type { PedidoNaAgenda, RetornoNaAgenda } from '../servidor/agenda'
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

/** O retorno marcado na consulta de origem, como cartão da agenda (o paciente já tem prontuário). */
export function atendimentoDoRetorno(r: RetornoNaAgenda, agora: Date): Atendimento {
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  return {
    id: `retorno-${r.id}`,
    inicio: r.inicio,
    paciente: { id: r.pacienteId, nome: r.pacienteNome, nascimento: '' },
    tipo: 'retorno',
    modalidade: r.modalidade,
    pagamento: '',
    ficha: { situacao: 'sem-ficha' },
    atendido: r.data < hoje,
    temHistorico: true,
    retornoMarcado: { id: r.id },
  }
}

/** Agenda do dia com os retornos marcados: o retorno ocupa o horário (sai o paciente de exemplo daquele horário). */
export function juntarRetornos(lista: Atendimento[], retornos: RetornoNaAgenda[], dia: string, agora: Date): Atendimento[] {
  const doDia = retornos.filter((r) => r.data === dia)
  const horas = new Set(doDia.map((r) => r.inicio))
  return ordenarPorHorario([...lista.filter((x) => !horas.has(x.inicio)), ...doDia.map((r) => atendimentoDoRetorno(r, agora))])
}

/** Mensagem pronta do consultório para o paciente, com o link do formulário. */
export function mensagemDoFormulario(p: PedidoNaAgenda, medico: Medico, endereco: string): string {
  const primeiro = p.nome.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Para a sua consulta com ${medico.tratamento} ${medico.nome}, ${rotuloDiaLongo(p.data)}, às ${horaCurta(p.inicio)}`
    + ` (${p.modalidade}), preencha o formulário: ${endereco}/formulario/${p.tokenFormulario}`
}

/** "Preencher na consulta": sem formulário, a consulta só abre depois da Identificação (o médico pode preencher na chegada). */
export const precisaIdentificacao = (p: PedidoNaAgenda) => p.formulario === null

/** Identificação para o médico preencher na chegada: já vem com o nome e o WhatsApp do pedido. */
export function identificacaoDaChegada(p: PedidoNaAgenda): DadosPessoais {
  return {
    nomeCompleto: p.nome, nomeSocial: '', nascimento: '', sexo: '', whatsapp: formatarWhatsapp(p.whatsapp), email: '', cidade: '', uf: '',
    estadoCivil: '', profissao: '', trabalhoExposto: '',
  }
}

/** Aviso no dia: quem escolheu "preencher na consulta" e ainda não preencheu (`hoje` = AAAA-MM-DD). */
export const lembrarHoje = (p: PedidoNaAgenda, hoje: string) => p.forma === 'consulta' && p.formulario === null && p.data === hoje

/** Mensagem pronta do aviso no dia (o app abre o WhatsApp com ela; quem envia é a pessoa). */
export function mensagemDoLembrete(p: PedidoNaAgenda, medico: Medico, endereco: string): string {
  const primeiro = p.nome.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Hoje é a sua consulta com ${medico.tratamento} ${medico.nome}, às ${horaCurta(p.inicio)} (${p.modalidade}).`
    + ` Se puder, preencha o formulário antes. Leva poucos minutos: ${endereco}/formulario/${p.tokenFormulario}`
}

/** Mensagem pronta do Confirmar (o app abre o WhatsApp com ela; quem envia é a pessoa). */
export function mensagemDaConfirmacao(p: PedidoNaAgenda, medico: Medico): string {
  const primeiro = p.nome.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Sua consulta com ${medico.tratamento} ${medico.nome} está confirmada: ${rotuloDiaLongo(p.data)}, às ${horaCurta(p.inicio)} (${p.modalidade}).`
}

/** Mensagem pronta do Avisar: o médico não vai poder atender; o paciente escolhe outro horário na página. */
export function mensagemDoAviso(p: PedidoNaAgenda, medico: Medico, endereco: string): string {
  const primeiro = p.nome.trim().split(/\s+/)[0]
  return `Olá, ${primeiro}! Infelizmente não será possível atender ${rotuloDiaLongo(p.data)}, às ${horaCurta(p.inicio)}.`
    + ` Escolha outro horário: ${endereco}/medico/${medico.slug}`
}
