// Tipos da página do médico. Já no formato que o banco vai ter, para a ligação
// ao Supabase não exigir refazer a tela.

export type Modalidade = 'presencial' | 'online'

export type Medico = {
  slug: string
  nome: string
  tratamento: 'Dra.' | 'Dr.'
  /** slug da especialidade (src/especialidades.ts) */
  especialidade: string
  crm: string
  uf: string
  /** opcional: só aparece se o médico tiver */
  rqe?: string
  foto?: string
  endereco: string
  cidade: string
  atendeOnline: boolean
  whatsappConsultorio: string
  /** convênios que o médico atende; ele mesmo edita no app (Configurações do consultório). Particular sempre. */
  convenios: string[]
}

export type Horario = { inicio: string /* 'HH:MM' */; livre: boolean }

export type DiaAgenda = { data: string /* 'YYYY-MM-DD' */; horarios: Horario[] }

export type Agenda = Record<Modalidade, DiaAgenda[]>
