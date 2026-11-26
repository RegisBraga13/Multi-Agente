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

/** Médicos fictícios de Cardiologia, Gastroenterologia, Neurologia, Endocrinologia, Hematologia, Infectologia, Oncologia, Nefrologia, Ginecologia e Urologia, só para testar os módulos (26/11/2026). */
export const MEDICO_CARDIO: Medico = { ...MEDICO_EXEMPLO, slug: 'helena-prado', nome: 'Helena Prado', tratamento: 'Dra.', especialidade: 'cardiologia', crm: '65432' }
export const MEDICO_GASTRO: Medico = { ...MEDICO_EXEMPLO, slug: 'marcos-lima', nome: 'Marcos Lima', tratamento: 'Dr.', especialidade: 'gastroenterologia', crm: '76543' }

export const MEDICO_NEURO: Medico = { ...MEDICO_EXEMPLO, slug: 'lucia-ramos', nome: 'Lúcia Ramos', tratamento: 'Dra.', especialidade: 'neurologia', crm: '87654' }
export const MEDICO_ENDO: Medico = { ...MEDICO_EXEMPLO, slug: 'tiago-nunes', nome: 'Tiago Nunes', tratamento: 'Dr.', especialidade: 'endocrinologia', crm: '98765' }

export const MEDICO_HEMATO: Medico = { ...MEDICO_EXEMPLO, slug: 'clara-souto', nome: 'Clara Souto', tratamento: 'Dra.', especialidade: 'hematologia', crm: '19876' }
export const MEDICO_INFECTO: Medico = { ...MEDICO_EXEMPLO, slug: 'renato-alves', nome: 'Renato Alves', tratamento: 'Dr.', especialidade: 'infectologia', crm: '29876' }

export const MEDICO_ONCO: Medico = { ...MEDICO_EXEMPLO, slug: 'marina-teles', nome: 'Marina Teles', tratamento: 'Dra.', especialidade: 'oncologia', crm: '39876' }
export const MEDICO_NEFRO: Medico = { ...MEDICO_EXEMPLO, slug: 'felipe-rocha', nome: 'Felipe Rocha', tratamento: 'Dr.', especialidade: 'nefrologia', crm: '49876' }

export const MEDICO_GINECO: Medico = { ...MEDICO_EXEMPLO, slug: 'beatriz-lins', nome: 'Beatriz Lins', tratamento: 'Dra.', especialidade: 'ginecologia', crm: '59876' }
export const MEDICO_URO: Medico = { ...MEDICO_EXEMPLO, slug: 'andre-matos', nome: 'André Matos', tratamento: 'Dr.', especialidade: 'urologia', crm: '69876' }

/** Médicos fictícios de Geriatria, Pediatria, Psiquiatria e Otorrinolaringologia, só para testar os módulos (26/11/2026). */
export const MEDICO_GERIATRA: Medico = { ...MEDICO_EXEMPLO, slug: 'sergio-paiva', nome: 'Sérgio Paiva', tratamento: 'Dr.', especialidade: 'geriatria', crm: '79876' }
export const MEDICO_PEDIATRA: Medico = { ...MEDICO_EXEMPLO, slug: 'livia-campos', nome: 'Lívia Campos', tratamento: 'Dra.', especialidade: 'pediatria', crm: '89876' }
export const MEDICO_PSIQUIATRA: Medico = { ...MEDICO_EXEMPLO, slug: 'joana-freitas', nome: 'Joana Freitas', tratamento: 'Dra.', especialidade: 'psiquiatria', crm: '99876' }
export const MEDICO_OTORRINO: Medico = { ...MEDICO_EXEMPLO, slug: 'caio-moura', nome: 'Caio Moura', tratamento: 'Dr.', especialidade: 'otorrinolaringologia', crm: '18765' }

/** Médicos fictícios de Pneumologia e Hepatologia, só para testar os módulos (26/11/2026). */
export const MEDICO_PNEUMO: Medico = { ...MEDICO_EXEMPLO, slug: 'rafael-dias', nome: 'Rafael Dias', tratamento: 'Dr.', especialidade: 'pneumologia', crm: '28765' }
export const MEDICO_HEPATO: Medico = { ...MEDICO_EXEMPLO, slug: 'teresa-vale', nome: 'Teresa Vale', tratamento: 'Dra.', especialidade: 'hepatologia', crm: '38765' }

/** Médico fictício de Cirurgia Geral, só para testar o módulo (26/11/2026). */
export const MEDICO_CIRURGIA: Medico = { ...MEDICO_EXEMPLO, slug: 'paulo-nunes', nome: 'Paulo Nunes', tratamento: 'Dr.', especialidade: 'cirurgia-geral', crm: '48765' }

const MEDICOS: Medico[] = [MEDICO_EXEMPLO, MEDICO_REUMATO, MEDICO_CARDIO, MEDICO_GASTRO, MEDICO_NEURO, MEDICO_ENDO, MEDICO_HEMATO, MEDICO_INFECTO,
  MEDICO_ONCO, MEDICO_NEFRO, MEDICO_GINECO, MEDICO_URO, MEDICO_GERIATRA, MEDICO_PEDIATRA, MEDICO_PSIQUIATRA, MEDICO_OTORRINO,
  MEDICO_PNEUMO, MEDICO_HEPATO, MEDICO_CIRURGIA]

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
