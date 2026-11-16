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

  it('conta as fichas só de quem ainda vai ser atendido (muda a cada atendimento)', () => {
    const cedo = vistaDoDia('2026-11-16', new Date(2026, 10, 16, 7, 0))
    expect(cedo.fichasProntas + cedo.semFicha).toBe(cedo.lista.length)
    const tarde = vistaDoDia('2026-11-16', new Date(2026, 10, 16, 14, 30))
    const aSeguir = tarde.lista.filter((x) => !x.atendido)
    expect(tarde.fichasProntas).toBe(aSeguir.filter((x) => x.ficha.situacao === 'pronta').length)
    expect(tarde.fichasProntas + tarde.semFicha).toBe(aSeguir.length)
    expect(tarde.fichasProntas).toBeLessThan(cedo.fichasProntas)
  })

  it('domingo vazio', () => {
    const v = vistaDoDia('2026-11-22', new Date(2026, 10, 22, 9, 0))
    expect(v.lista).toEqual([])
    expect(v.proximo).toBeNull()
  })
})
