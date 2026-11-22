// Conversa com o servidor da consulta (FastAPI). Formatos iguais aos contratos do servidor
// (backend/app/contratos/consulta_blocos.py), em camelCase.
import { BASE, chamar, ErroServidor } from './agenda'

export type SinalServidor = { id: string; texto: string; resposta: 'sim' | 'nao' }
export type AnamneseServidor = {
  queixa: string
  falas: { quem: 'Médico' | 'Paciente'; texto: string }[]
  sinais: SinalServidor[]
  emUso: string[]
  antecedentes: string[]
  alergias: { substancia: string; reacao: string }[]
  texto: string
  perguntas: { texto: string; resposta: 'sim' | 'nao'; detalhe: string | null }[]
  formulario: { respostas: Record<string, string | string[]>; fotos: string[] } | null
}
export type ExameServidor = {
  exame: { morfologia: string | null; localizacao: string | null; extensao: string | null; gravidade: string | null; achados: string | null }
  /** os exames complementares seguem só na tela até a etapa da história */
  complementares: never[]
  observacoes: string
}
export type EtapaServidor = 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta'
export type BlocoServidor = { etapa: EtapaServidor; estado: 'rascunho_ia' | 'revisado_medico' | 'oficializado'; desatualizado: boolean; conteudo: Record<string, unknown>; oficializadoEm: string | null }
export type ConsultaServidor = {
  id: string; pacienteId: string; tipo: 'consulta' | 'retorno'; modalidade: 'presencial' | 'online'
  especialidade: string; pedidoId: string | null; finalizadaEm: string | null; blocos: BlocoServidor[]
}

const json = (corpo: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(corpo) })
const put = (corpo: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(corpo) })

/** Cria o paciente e a consulta do pedido da agenda (a mesma consulta se já aberta). */
export const abrirConsultaDoPedido = (pedidoId: string, especialidade: string) =>
  chamar<ConsultaServidor>(`/consultas/do-pedido/${pedidoId}`, json({ especialidade }))

export const buscarConsulta = (id: string) => chamar<ConsultaServidor>(`/consultas/${id}`)

export const salvarAnamnese = (id: string, corpo: AnamneseServidor) => chamar<ConsultaServidor>(`/consultas/${id}/anamnese`, put(corpo))

export const salvarExame = (id: string, corpo: ExameServidor) => chamar<ConsultaServidor>(`/consultas/${id}/exame`, put(corpo))

export const oficializarEtapa = (id: string, etapa: 'anamnese' | 'exame' | 'historia') =>
  chamar<ConsultaServidor>(`/consultas/${id}/${etapa}/oficializar`, { method: 'POST' })

/** A lista fixa de sinais de alerta da especialidade (sempre checada pelo servidor). */
export const sinaisDaEspecialidade = (slug: string) => chamar<{ id: string; texto: string }[]>(`/especialidades/${encodeURIComponent(slug)}/sinais`)

// ---------- História e perguntas contextuais ----------

export type SinalDisparadoServidor = {
  id: string; texto: string; tipo: 'urgencia_imediata' | 'prioridade' | 'muda_tratamento'
  acao: string[]; prazo: string; origem: 'respondido' | 'ia'; trecho: string | null
}
export type PerguntaServidor = { id: string; texto: string; seSim: string; seNao: string; sinalId: string | null; resposta: 'sim' | 'nao' | null }
export type HistoriaServidor = {
  historia: { qp: string; hda: string; ap: string; hp: string; hf: string; exameFisico: string; examesTexto: string }
  seguranca: { alergias: unknown[]; emUso: string[]; sinais: SinalDisparadoServidor[] }
  conflitos: unknown[]
  extrasIa: string[]
  perguntas: PerguntaServidor[]
}
export type ResultadoHistoria = { gravado: boolean; conteudo: HistoriaServidor | null; avisos: string[]; mensagem: string }

/** Lê o texto do fluxo de eventos (`event: x` + `data: {json}`, separados por linha em branco); ignora o bloco incompleto do fim. */
export function lerEventos(texto: string): { evento: string; dados: unknown }[] {
  const saida: { evento: string; dados: unknown }[] = []
  for (const bloco of texto.split('\n\n')) {
    const evento = /^event: (.+)$/m.exec(bloco)?.[1]
    const dados = /^data: (.+)$/m.exec(bloco)?.[1]
    if (!evento || dados === undefined) continue
    try { saida.push({ evento, dados: JSON.parse(dados) }) } catch { /* bloco incompleto */ }
  }
  return saida
}

const SEM_CONEXAO = 'Não foi possível falar com o consultório. Confira a internet e tente de novo.'

/** Pede ao servidor a história (a IA escreve; esperamos o evento final). Falha da IA ou da rede lança ErroServidor. */
export async function gerarHistoria(id: string): Promise<ResultadoHistoria> {
  let r: Response
  try { r = await fetch(`${BASE}/consultas/${id}/historia/gerar`, { method: 'POST' }) } catch { throw new ErroServidor(0, SEM_CONEXAO) }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null) as { detail?: unknown } | null
    throw new ErroServidor(r.status, typeof corpo?.detail === 'string' ? corpo.detail : SEM_CONEXAO)
  }
  const eventos = lerEventos(await r.text())
  const pronto = eventos.find((e) => e.evento === 'pronto')
  if (!pronto) {
    const erro = eventos.find((e) => e.evento === 'erro')?.dados as { detail?: string } | undefined
    throw new ErroServidor(500, erro?.detail ?? SEM_CONEXAO)
  }
  return pronto.dados as ResultadoHistoria
}

export const salvarHistoria = (id: string, bloco: HistoriaServidor) => chamar<ConsultaServidor>(`/consultas/${id}/historia`, put(bloco))

/** Perguntas de segurança escritas para este paciente (não grava: a tela salva junto com a história). */
export const gerarPerguntas = (id: string) =>
  chamar<{ perguntas: PerguntaServidor[]; avisos: string[]; iaFalhou: boolean }>(`/consultas/${id}/perguntas/gerar`, { method: 'POST' })
