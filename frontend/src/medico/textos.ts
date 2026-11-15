// Textos e formatação compartilhados pelas telas da página do médico.
import type { Medico, Modalidade } from './tipos'

const comoData = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}
const semPonto = (s: string) => s.replace('.', '')

export function rotuloDiaCurto(iso: string) {
  const d = comoData(iso)
  return {
    semana: semPonto(d.toLocaleDateString('pt-BR', { weekday: 'short' })),
    dia: d.getDate(),
    mes: semPonto(d.toLocaleDateString('pt-BR', { month: 'short' })),
  }
}

/** "terça-feira, 17 de novembro" */
export function rotuloDiaLongo(iso: string) {
  return comoData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const NOME_MODALIDADE: Record<Modalidade, string> = { presencial: 'Presencial', online: 'Online' }

/** "a médica" / "o médico" */
export const artigo = (m: Medico) => (m.tratamento === 'Dra.' ? 'a médica' : 'o médico')

/** Texto curto sobre a transcrição: aparece na seção e no momento do consentimento. */
export function textoTranscricao(m: Medico) {
  return `Com a sua autorização, a conversa da consulta é transformada em texto para o prontuário. Só ${artigo(m)} e a equipe clínica leem. O áudio é apagado logo depois de transcrito. Você pode recusar: a consulta acontece do mesmo jeito.`
}
