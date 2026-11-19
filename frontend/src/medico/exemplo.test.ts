import { describe, expect, it } from 'vitest'
import { buscarMedico, diaAberto, gerarAgenda, horarioExiste, marcarOcupados } from './exemplo'

describe('gerarAgenda', () => {
  it('começa amanhã, mesmo tarde da noite', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 23, 30)) // seg 16/11
    expect(a.presencial[0].data).toBe('2026-11-17')
  })

  it('não tem domingo e cobre 14 dias', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const datas = [...a.presencial, ...a.online].map((d) => d.data)
    expect(datas).not.toContain('2026-11-22') // domingo
    expect(datas.every((d) => d >= '2026-11-17' && d <= '2026-11-30')).toBe(true)
  })

  it('sábado só presencial, de manhã', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const sab = a.presencial.find((d) => d.data === '2026-11-21')!
    expect(sab.horarios.map((h) => h.inicio)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'])
    expect(a.online.find((d) => d.data === '2026-11-21')).toBeUndefined()
  })

  it('online seg–qui à noite, com horários ocupados', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const ter = a.online.find((d) => d.data === '2026-11-17')!
    expect(ter.horarios[0]).toEqual({ inicio: '18:00', livre: true })
    expect(ter.horarios[1].livre).toBe(false)
    expect(a.online.find((d) => d.data === '2026-11-20')).toBeUndefined() // sexta
  })
})

describe('horarioExiste', () => {
  it('só vale para horário livre da mesma modalidade', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    expect(horarioExiste(a, 'presencial', '2026-11-17', '08:00')).toBe(true)
    expect(horarioExiste(a, 'presencial', '2026-11-17', '08:30')).toBe(false) // ocupado
    expect(horarioExiste(a, 'online', '2026-11-17', '08:00')).toBe(false) // outra modalidade
  })
})

describe('diaAberto', () => {
  const dias = gerarAgenda(new Date(2026, 10, 16, 9, 0)).presencial
  it('abre o primeiro dia quando nada foi tocado', () => {
    expect(diaAberto(dias, null, null)).toBe('2026-11-17')
  })
  it('o dia tocado vale mesmo com um horário já escolhido em outro dia', () => {
    expect(diaAberto(dias, '2026-11-19', { data: '2026-11-17', inicio: '08:00' })).toBe('2026-11-19')
  })
  it('sem dia tocado, abre o dia do horário escolhido', () => {
    expect(diaAberto(dias, null, { data: '2026-11-18', inicio: '08:00' })).toBe('2026-11-18')
  })
  it('dia tocado que não existe nesta modalidade cai no primeiro', () => {
    expect(diaAberto(dias, '2026-11-22', null)).toBe('2026-11-17') // domingo
  })
})

describe('buscarMedico', () => {
  it('acha a médica de exemplo e recusa slug desconhecido', () => {
    expect(buscarMedico('ana-souza')?.crm).toBe('12345')
    expect(buscarMedico('nao-existe')).toBeUndefined()
  })
})

describe('marcarOcupados', () => {
  it('horário pedido por outro paciente deixa de estar livre nas duas modalidades', () => {
    const agenda = gerarAgenda(new Date(2026, 10, 16)) // segunda; amanhã = terça 17/11
    const dia = agenda.presencial[0]
    const livre = dia.horarios.find((h) => h.livre)!
    const marcada = marcarOcupados(agenda, [{ data: dia.data, inicio: livre.inicio }])
    expect(horarioExiste(marcada, 'presencial', dia.data, livre.inicio)).toBe(false)
    expect(horarioExiste(agenda, 'presencial', dia.data, livre.inicio)).toBe(true) // a original não muda
    expect(marcarOcupados(agenda, [])).toEqual(agenda)
  })
})
