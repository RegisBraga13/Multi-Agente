// Conversa com o servidor da consulta (FastAPI). Formatos iguais aos contratos do servidor
// (backend/app/contratos/consulta_blocos.py), em camelCase.
import { chamar } from './agenda'

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

export const oficializarEtapa = (id: string, etapa: 'anamnese' | 'exame') =>
  chamar<ConsultaServidor>(`/consultas/${id}/${etapa}/oficializar`, { method: 'POST' })

/** A lista fixa de sinais de alerta da especialidade (sempre checada pelo servidor). */
export const sinaisDaEspecialidade = (slug: string) => chamar<{ id: string; texto: string }[]>(`/especialidades/${encodeURIComponent(slug)}/sinais`)
