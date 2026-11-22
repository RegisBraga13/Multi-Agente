// Retorno marcado na página 5 (Receita e anexos): rascunho só na tela. Nada vai ao servidor nem à agenda
// até Finalizar; trocar Sim↔Não ou o horário antes disso não deixa rastro.
import type { RetornoMarcado } from '../prontuario/registro'
import { dataBr } from './anexos'

export type RascunhoRetorno = { escolha: 'nao' } | { escolha: 'sim'; marcado: RetornoMarcado | null }

export const RASCUNHO_INICIAL: RascunhoRetorno = { escolha: 'nao' }

/** Trocar a escolha: "Não" descarta o horário; "Sim" estando em "Sim" mantém o horário já escolhido. */
export function escolher(r: RascunhoRetorno, escolha: 'sim' | 'nao'): RascunhoRetorno {
  if (escolha === 'nao') return { escolha: 'nao' }
  return r.escolha === 'sim' ? r : { escolha: 'sim', marcado: null }
}

/** O horário que o médico escolheu na agenda (marcar já é dizer "Sim"). */
export const horarioEscolhido = (_: RascunhoRetorno, marcado: RetornoMarcado): RascunhoRetorno => ({ escolha: 'sim', marcado })

/** O que vai no corpo do Finalizar: o horário, ou nulo (sem retorno, ou "Sim" ainda sem horário). */
export const retornoParaEnvio = (r: RascunhoRetorno): RetornoMarcado | null => (r.escolha === 'sim' ? r.marcado : null)

/** "Sim" sem horário escolhido não deixa salvar os anexos. */
export const podeSalvarAnexos = (r: RascunhoRetorno): boolean => r.escolha === 'nao' || r.marcado !== null

/** "05/12/2026 às 14:00, presencial" */
export const textoDoRetorno = (m: RetornoMarcado): string => `${dataBr(m.data)} às ${m.inicio}, ${m.modalidade}`
