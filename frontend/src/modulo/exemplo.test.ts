import { describe, expect, it } from 'vitest'
import { agendaDoDia } from './exemplo'

const AGORA = new Date(2026, 10, 16, 10, 0) // segunda 16/11, 10h

describe('agendaDoDia', () => {
  it('domingo sem pacientes', () => {
    expect(agendaDoDia('2026-11-22', AGORA)).toEqual([])
  })

  it('segunda: 9 pacientes em ordem, atendidos até a hora atual', () => {
    const dia = agendaDoDia('2026-11-16', AGORA)
    expect(dia).toHaveLength(9)
    const horas = dia.map((x) => x.inicio)
    expect(horas).toEqual([...horas].sort())
    for (const x of dia) expect(x.atendido).toBe(x.inicio < '10:00')
    expect(dia.some((x) => x.tipo === 'retorno')).toBe(true)
    expect(dia.some((x) => x.modalidade === 'online')).toBe(true)
    expect(dia.some((x) => x.formulario === 'pendente')).toBe(true)
    expect(dia.filter((x) => x.tipo === 'retorno').every((x) => x.temHistorico)).toBe(true)
  })

  it('dia passado todo atendido; dia futuro nada atendido', () => {
    expect(agendaDoDia('2026-11-13', AGORA).every((x) => x.atendido)).toBe(true)
    expect(agendaDoDia('2026-11-17', AGORA).some((x) => x.atendido)).toBe(false)
  })

  it('sábado só de manhã', () => {
    const sab = agendaDoDia('2026-11-21', AGORA)
    expect(sab.length).toBeGreaterThan(0)
    expect(sab.every((x) => x.inicio < '12:00')).toBe(true)
  })

  it('mesma data, mesma lista', () => {
    expect(agendaDoDia('2026-11-18', AGORA)).toEqual(agendaDoDia('2026-11-18', AGORA))
  })
})
