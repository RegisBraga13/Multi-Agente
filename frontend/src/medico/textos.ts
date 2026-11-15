// Textos e formatação compartilhados pelas telas da página do médico.
import type { Modalidade } from './tipos'

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

// Decisão do autor (15/11/2026): nos textos para o paciente, sempre "seu médico",
// qualquer que seja a especialidade ou o gênero. O nome do médico continua onde aparece.

/** Mesma frase na seção Como funciona e no momento do consentimento. */
export const ACESSO_TRANSCRICAO = 'Apenas seu médico tem acesso, e o áudio é apagado depois de transcrito.'

/** Texto do consentimento, no agendamento. */
export const TEXTO_TRANSCRICAO = `Com a sua autorização, a conversa da consulta é transformada em texto para o prontuário. ${ACESSO_TRANSCRICAO} Você pode recusar: a consulta acontece do mesmo jeito.`
