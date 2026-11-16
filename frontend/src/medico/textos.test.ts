import { describe, expect, it } from 'vitest'
import { diaComSemana, horaCurta } from './textos'

describe('textos curtos do aviso de pedido', () => {
  it('dia como 20/11 (sexta)', () => {
    expect(diaComSemana('2026-11-20')).toBe('20/11 (sexta)')
    expect(diaComSemana('2026-11-21')).toBe('21/11 (sábado)')
    expect(diaComSemana('2026-12-07')).toBe('07/12 (segunda)')
  })
  it('hora como 09h ou 09h30', () => {
    expect(horaCurta('09:00')).toBe('09h')
    expect(horaCurta('18:30')).toBe('18h30')
  })
})
