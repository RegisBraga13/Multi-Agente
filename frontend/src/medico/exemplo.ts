// Dados de exemplo da página do médico. Nada aqui vem do banco ainda.
import type { Agenda, DiaAgenda, Medico, Modalidade } from './tipos'

export const MEDICO_EXEMPLO: Medico = {
  slug: 'ana-souza',
  nome: 'Ana Souza',
  tratamento: 'Dra.',
  especialidade: 'dermatologia',
  crm: '12345',
  uf: 'CE',
  endereco: 'Av. Santos Dumont, 1500, sala 804 · Aldeota',
  cidade: 'Fortaleza',
  atendeOnline: true,
  whatsappConsultorio: '5585991018813',
  convenios: ['Unimed', 'Hapvida', 'Bradesco Saúde', 'SulAmérica', 'Cassi', 'Camed'],
}

/** Médico fictício de Reumatologia, só para testar o módulo (autor, 24/11/2026); contatos iguais aos da Dra. Ana Souza. */
export const MEDICO_REUMATO: Medico = { ...MEDICO_EXEMPLO, slug: 'paulo-mendes', nome: 'Paulo Mendes', tratamento: 'Dr.', especialidade: 'reumatologia', crm: '54321' }

const MEDICOS: Medico[] = [MEDICO_EXEMPLO, MEDICO_REUMATO]

export function buscarMedico(slug: string): Medico | undefined {
  return MEDICOS.find((m) => m.slug === slug)
}

/** O médico de exemplo de cada módulo (sem login: a tela do módulo fala com o servidor em nome dele). */
export function medicoDoModulo(especialidade: string): Medico | undefined {
  return MEDICOS.find((m) => m.especialidade === especialidade)
}

const DIAS_NA_AGENDA = 14

/** Data local no formato YYYY-MM-DD (nunca toISOString, que usa UTC). */
export function dataLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Horários de 30 em 30 minutos, de `de` até `ate` inclusive (HH:MM). */
function faixa(de: string, ate: string): string[] {
  const min = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3))
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const out: string[] = []
  for (let m = min(de); m <= min(ate); m += 30) out.push(fmt(m))
  return out
}

/** Expediente de exemplo por dia da semana (0 = domingo). */
function expediente(modalidade: Modalidade, diaSemana: number): string[] {
  if (modalidade === 'presencial') {
    if (diaSemana >= 1 && diaSemana <= 5) return faixa('08:00', '11:30')
    if (diaSemana === 6) return faixa('08:00', '10:30')
    return []
  }
  if (diaSemana >= 1 && diaSemana <= 4) return faixa('18:00', '20:30')
  return []
}

/** 14 dias a partir de amanhã; um horário a cada três fica ocupado. */
export function gerarAgenda(hoje: Date): Agenda {
  const agenda: Agenda = { presencial: [], online: [] }
  for (let i = 1; i <= DIAS_NA_AGENDA; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
    for (const m of ['presencial', 'online'] as const) {
      const inicios = expediente(m, d.getDay())
      if (!inicios.length) continue
      const dia: DiaAgenda = { data: dataLocal(d), horarios: inicios.map((inicio, k) => ({ inicio, livre: k % 3 !== 1 })) }
      agenda[m].push(dia)
    }
  }
  return agenda
}

/** Dia mostrado na agenda: o que o paciente tocou, senão o do horário escolhido, senão o primeiro. */
export function diaAberto(
  dias: DiaAgenda[],
  diaTocado: string | null,
  selecionado: { data: string; inicio: string } | null,
): string | undefined {
  const existe = (d?: string | null) => (d && dias.some((x) => x.data === d) ? d : undefined)
  return existe(diaTocado) ?? existe(selecionado?.data) ?? dias[0]?.data
}

export function horarioExiste(agenda: Agenda, modalidade: Modalidade, data: string, inicio: string): boolean {
  return !!agenda[modalidade].find((d) => d.data === data)?.horarios.some((h) => h.inicio === inicio && h.livre)
}

/** Horários já pedidos por outros pacientes (vêm do servidor) deixam de estar livres, nas duas modalidades. */
export function marcarOcupados(agenda: Agenda, ocupados: readonly { data: string; inicio: string }[]): Agenda {
  if (!ocupados.length) return agenda
  const tomado = new Set(ocupados.map((o) => `${o.data} ${o.inicio}`))
  const marcar = (dias: DiaAgenda[]) =>
    dias.map((d) => ({ ...d, horarios: d.horarios.map((h) => (tomado.has(`${d.data} ${h.inicio}`) ? { ...h, livre: false } : h)) }))
  return { presencial: marcar(agenda.presencial), online: marcar(agenda.online) }
}
