import { describe, expect, it } from 'vitest'
import { vistaDoEndereco } from './use-vista'

describe('vistaDoEndereco', () => {
  it('cada atalho abre a sua página; o resto volta ao início', () => {
    expect(vistaDoEndereco('#como-funciona')).toBe('como')
    expect(vistaDoEndereco('#duvidas')).toBe('duvidas')
    expect(vistaDoEndereco('#agenda')).toBe('agenda')
    for (const h of ['', '#', '#inicio', '#qualquer']) expect(vistaDoEndereco(h)).toBe('inicio')
  })
})
