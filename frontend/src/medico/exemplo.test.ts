import { describe, expect, it } from 'vitest'
import { buscarMedico, gerarAgenda, horarioExiste } from './exemplo'

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

describe('buscarMedico', () => {
  it('acha a médica de exemplo e recusa slug desconhecido', () => {
    expect(buscarMedico('ana-souza')?.crm).toBe('12345')
    expect(buscarMedico('nao-existe')).toBeUndefined()
  })
})
