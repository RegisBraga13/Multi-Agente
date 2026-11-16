import { describe, expect, it } from 'vitest'
import { vistaDoDia } from './vista'

describe('vistaDoDia', () => {
  it('o próximo avança com o relógio', () => {
    expect(vistaDoDia('2026-11-16', new Date(2026, 10, 16, 8, 10)).proximo).toBe('2026-11-16-08:30')
    expect(vistaDoDia('2026-11-16', new Date(2026, 10, 16, 14, 10)).proximo).toBe('2026-11-16-15:00')
  })

  it('depois da meia-noite o dia anterior fica todo atendido e sem próximo', () => {
    const v = vistaDoDia('2026-11-16', new Date(2026, 10, 17, 0, 5))
    expect(v.ehHoje).toBe(false)
    expect(v.proximo).toBeNull()
    expect(v.atendidos).toBe(v.lista.length)
  })

  it('domingo vazio', () => {
    const v = vistaDoDia('2026-11-22', new Date(2026, 10, 22, 9, 0))
    expect(v.lista).toEqual([])
    expect(v.proximo).toBeNull()
  })
})
