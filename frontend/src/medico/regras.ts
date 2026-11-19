// Regras do agendamento pela página do médico (funções puras, testadas).
import type { NovoPedido } from '../servidor/agenda'
import { EMAIL_REGEX, UFS } from '../cadastro/validacao'
import type { Modalidade } from './tipos'

export type FormaFormulario = 'whatsapp' | 'pagina' | 'consulta'
export type Transcricao = 'aceita' | 'recusada'

export type RascunhoPedido = {
  modalidade: Modalidade
  data: string | null
  inicio: string | null
  nome: string
  whatsapp: string
  /** particular ou convênio: escolhido no agendamento, porque o consultório precisa dele para confirmar */
  atendimento: 'particular' | 'convenio' | null
  /** nome do convênio (da lista do médico, ou digitado em "Outro") */
  convenio: string
  transcricao: Transcricao | null
  forma: FormaFormulario | null
}

export type ErrosPedido = Partial<Record<'horario' | 'nome' | 'whatsapp' | 'atendimento' | 'convenio' | 'transcricao' | 'forma', string>>

/** Celular brasileiro → '55' + DDD + 9 dígitos; null se não for um celular válido. */
export function normalizarWhatsapp(texto: string): string | null {
  let n = texto.replace(/\D/g, '')
  if (n.length === 13 && n.startsWith('55')) n = n.slice(2)
  if (n.length !== 11) return null
  if (Number(n.slice(0, 2)) < 11 || n[2] !== '9') return null
  return '55' + n
}

/** '5585991018813' → '(85) 99101-8813' */
export function formatarWhatsapp(normalizado: string): string {
  const n = normalizado.slice(2)
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
}

export function validarContato(r: Pick<RascunhoPedido, 'nome' | 'whatsapp'>): ErrosPedido {
  const e: ErrosPedido = {}
  if (r.nome.trim().length < 3) e.nome = 'Informe seu nome.'
  if (!normalizarWhatsapp(r.whatsapp)) e.whatsapp = 'Informe um celular com WhatsApp, com DDD.'
  return e
}

export function validarAtendimento(r: Pick<RascunhoPedido, 'atendimento' | 'convenio'>): ErrosPedido {
  if (!r.atendimento) return { atendimento: 'Escolha particular ou convênio.' }
  if (r.atendimento === 'convenio' && !r.convenio.trim()) return { convenio: 'Escolha o seu convênio.' }
  return {}
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** O convênio digitado está na lista do médico? (sem diferenciar maiúsculas, acentos e espaços) */
export function convenioAtendido(lista: readonly string[], nome: string): boolean {
  const alvo = semAcento(nome)
  return lista.some((c) => semAcento(c) === alvo)
}

export function validarPedido(r: RascunhoPedido): ErrosPedido {
  const e: ErrosPedido = {}
  if (!r.data || !r.inicio) e.horario = 'Escolha o dia e o horário.'
  Object.assign(e, validarContato(r), validarAtendimento(r))
  if (!r.transcricao) e.transcricao = 'Responda se concorda com a transcrição.'
  if (!r.forma) e.forma = 'Escolha como prefere preencher o formulário.'
  return e
}

export type EstadoCivil = 'solteiro' | 'casado' | 'uniao-estavel' | 'separado' | 'divorciado' | 'viuvo'
/** Opções do formulário (rótulo para o paciente escolher). */
export const ESTADOS_CIVIS: { valor: EstadoCivil; rotulo: string }[] = [
  { valor: 'solteiro', rotulo: 'Solteiro(a)' }, { valor: 'casado', rotulo: 'Casado(a)' }, { valor: 'uniao-estavel', rotulo: 'União estável' },
  { valor: 'separado', rotulo: 'Separado(a)' }, { valor: 'divorciado', rotulo: 'Divorciado(a)' }, { valor: 'viuvo', rotulo: 'Viúvo(a)' },
]
/** Estado civil no texto clínico, concordando com o sexo ("casado"/"casada"; sexo "outro" → "casado(a)"). */
export function estadoCivilNoTexto(e: EstadoCivil, sexo: 'F' | 'M' | 'outro' | ''): string {
  if (e === 'uniao-estavel') return 'em união estável'
  const m = { solteiro: 'solteiro', casado: 'casado', separado: 'separado', divorciado: 'divorciado', viuvo: 'viúvo' }[e]
  return sexo === 'F' ? `${m.slice(0, -1)}a` : sexo === 'M' ? m : `${m}(a)`
}

export type DadosPessoais = {
  nomeCompleto: string
  nascimento: string // YYYY-MM-DD
  sexo: 'F' | 'M' | 'outro' | ''
  whatsapp: string
  email: string
  cidade: string
  uf: string
  estadoCivil: EstadoCivil | '' // opcional
  profissao: string // opcional
  trabalhoExposto: 'sim' | 'nao' | '' // ao ar livre, ao sol ou a produtos químicos; opcional
}

/** Anos completos na data de hoje; null se a data de nascimento não for válida. */
export function calcularIdade(nascimento: string, hoje: Date): number | null {
  if (!nascimentoValido(nascimento, hoje)) return null
  const [a, m, d] = nascimento.split('-').map(Number)
  let idade = hoje.getFullYear() - a
  // ainda não fez aniversário este ano (29/02 conta como 01/03 nos anos comuns)
  if (new Date(hoje.getFullYear(), m - 1, d) > new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) idade--
  return idade
}

function nascimentoValido(iso: string, hoje: Date): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return false
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(a, me - 1, d)
  if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== d) return false
  const limite = new Date(hoje.getFullYear() - 120, hoje.getMonth(), hoje.getDate())
  return dt <= hoje && dt >= limite
}

export function validarDadosPessoais(d: DadosPessoais, hoje: Date): Partial<Record<keyof DadosPessoais, string>> {
  const e: Partial<Record<keyof DadosPessoais, string>> = {}
  if (d.nomeCompleto.trim().split(/\s+/).filter(Boolean).length < 2) e.nomeCompleto = 'Informe nome e sobrenome.'
  if (!nascimentoValido(d.nascimento, hoje)) e.nascimento = 'Informe uma data de nascimento válida.'
  if (!d.sexo) e.sexo = 'Escolha uma opção.'
  if (!normalizarWhatsapp(d.whatsapp)) e.whatsapp = 'Informe um celular com WhatsApp, com DDD.'
  if (d.email.trim() && !EMAIL_REGEX.test(d.email.trim())) e.email = 'Informe um e-mail válido ou deixe em branco.'
  if (!d.cidade.trim()) e.cidade = 'Informe a cidade.'
  if (!(UFS as readonly string[]).includes(d.uf)) e.uf = 'Escolha a UF.'
  return e
}

export const FOTO_MAX_BYTES = 10 * 1024 * 1024

export function validarFoto(f: { type: string; size: number }): string | null {
  if (!f.type.startsWith('image/')) return 'Envie uma foto (imagem).'
  if (f.size > FOTO_MAX_BYTES) return 'A foto passa de 10 MB. Envie uma menor.'
  return null
}

/** O pedido no formato do servidor. Só chamar depois de `validarPedido` sem erros. */
export function pedidoParaServidor(r: RascunhoPedido): NovoPedido {
  return {
    modalidade: r.modalidade, data: r.data!, inicio: r.inicio!, nome: r.nome.trim(), whatsapp: normalizarWhatsapp(r.whatsapp)!,
    pagamento: r.atendimento === 'convenio' ? r.convenio.trim() : 'Particular', transcricao: r.transcricao!, forma: r.forma!,
  }
}
