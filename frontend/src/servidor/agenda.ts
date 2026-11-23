// Conversa com o servidor da agenda (FastAPI). A página chama /api/...; o Vite repassa ao servidor.
// Formatos iguais aos contratos do servidor (backend/app/contratos/agenda.py), em camelCase.
import type { DadosPessoais, FormaFormulario, Transcricao } from '../medico/regras'
import type { Modalidade } from '../medico/tipos'

export const BASE = '/api'

export type SituacaoFicha = 'sem-ficha' | 'link-enviado' | 'pronta'
export type HorarioOcupado = { data: string; inicio: string }

export type NovoPedido = {
  modalidade: Modalidade; data: string; inicio: string; nome: string; whatsapp: string
  pagamento: string; transcricao: Transcricao; forma: FormaFormulario
}

export type Respostas = Record<string, string | string[]>

export type FormularioRecebido = {
  dados: Omit<DadosPessoais, 'nascimento' | 'sexo' | 'nomeSocial'> & { nascimento: string; sexo: 'F' | 'M' | 'I'; /** formulários antigos não têm */ nomeSocial?: string }
  respostas: Respostas
  fotos: string[]
  recebidoEm: string
}

export type PedidoNaAgenda = NovoPedido & {
  id: string; tokenFormulario: string; situacaoFicha: SituacaoFicha
  status: 'novo' | 'confirmado' | 'cancelado'; criadoEm: string; formulario: FormularioRecebido | null
}

export type PedidoDoLink = {
  medicoSlug: string; data: string; inicio: string; modalidade: Modalidade; nome: string; whatsapp: string
  situacaoFicha: SituacaoFicha
}

/** O retorno marcado, como cartão da agenda (nasce ao finalizar a consulta de origem). */
export type RetornoNaAgenda = {
  id: string; pacienteId: string; pacienteNome: string; consultaOrigemId: string
  data: string; inicio: string; modalidade: Modalidade
}

export type FotoParaEnviar = { tipo: string; base64: string }

/** Erro com a mensagem do servidor (já escrita para quem está usando a tela). */
export class ErroServidor extends Error {
  readonly status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

const SEM_CONEXAO = 'Não foi possível falar com o consultório. Confira a internet e tente de novo.'

export async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(BASE + caminho, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  } catch {
    throw new ErroServidor(0, SEM_CONEXAO)
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null) as { detail?: unknown } | null
    const detalhe = typeof corpo?.detail === 'string' ? corpo.detail : r.status >= 500 ? SEM_CONEXAO : 'Confira os dados e tente de novo.'
    throw new ErroServidor(r.status, detalhe)
  }
  return (r.status === 204 ? undefined : await r.json()) as T
}

export const horariosOcupados = (slug: string, de: string, ate: string) =>
  chamar<HorarioOcupado[]>(`/publico/medicos/${encodeURIComponent(slug)}/ocupados?de=${de}&ate=${ate}`)

export const pedirConsulta = (slug: string, pedido: NovoPedido) =>
  chamar<{ id: string; tokenFormulario: string }>(`/publico/medicos/${encodeURIComponent(slug)}/pedidos`, {
    method: 'POST', body: JSON.stringify(pedido),
  })

export const abrirFormulario = (token: string) => chamar<PedidoDoLink>(`/publico/formularios/${encodeURIComponent(token)}`)

export const enviarFormulario = (
  token: string, corpo: { dados: FormularioRecebido['dados']; respostas: Respostas; fotos: Record<string, FotoParaEnviar> },
) => chamar<void>(`/publico/formularios/${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify(corpo) })

export const pedidosDaAgenda = (de: string, ate: string) => chamar<PedidoNaAgenda[]>(`/agenda/pedidos?de=${de}&ate=${ate}`)

export const retornosDaAgenda = (de: string, ate: string) => chamar<RetornoNaAgenda[]>(`/agenda/retornos?de=${de}&ate=${ate}`)

export const buscarRetorno = (id: string) => chamar<RetornoNaAgenda>(`/agenda/retornos/${id}`)

export const buscarPedido = (id: string) => chamar<PedidoNaAgenda>(`/agenda/pedidos/${id}`)

export const marcarLinkEnviado = (id: string) => chamar<PedidoNaAgenda>(`/agenda/pedidos/${id}/link-enviado`, { method: 'POST' })

/** O médico preenche a Identificação na chegada (paciente que escolheu "preencher na consulta"). */
export const gravarIdentificacao = (id: string, dados: FormularioRecebido['dados']) =>
  chamar<PedidoNaAgenda>(`/agenda/pedidos/${id}/identificacao`, { method: 'POST', body: JSON.stringify(dados) })

/** Pedido novo vira confirmado (a etiqueta "Pedido novo" some da agenda). */
export const confirmarPedido = (id: string) => chamar<PedidoNaAgenda>(`/agenda/pedidos/${id}/confirmar`, { method: 'POST' })

/** Avisar: o médico não pode atender; o pedido sai da agenda e o horário volta a ficar livre. */
export const cancelarPedido = (id: string) => chamar<PedidoNaAgenda>(`/agenda/pedidos/${id}/cancelar`, { method: 'POST' })

export const enderecoFoto = (id: string, pergunta: string) => `${BASE}/agenda/pedidos/${id}/fotos/${pergunta}`

/** Arquivo escolhido → base64 sem o prefixo "data:...;base64,". */
export function lerComoBase64(arquivo: File): Promise<FotoParaEnviar> {
  return new Promise((resolver, falhar) => {
    const leitor = new FileReader()
    leitor.onload = () => resolver({ tipo: arquivo.type || 'image/jpeg', base64: String(leitor.result).split(',', 2)[1] ?? '' })
    leitor.onerror = () => falhar(leitor.error)
    leitor.readAsDataURL(arquivo)
  })
}
