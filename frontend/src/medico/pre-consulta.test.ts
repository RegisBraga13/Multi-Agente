import { describe, expect, it } from 'vitest'
import { ESPECIALIDADES } from '../especialidades'
import { perguntasPreConsulta } from './pre-consulta'

describe('perguntasPreConsulta', () => {
  it('dermatologia tem as próprias perguntas, com foto da lesão', () => {
    const p = perguntasPreConsulta('dermatologia')
    expect(p.map((x) => x.rotulo)).toEqual([
      'O que trouxe você à consulta?',
      'Desde quando?',
      'Medicamentos e cremes que usa ou já usou',
      'Alergia a algum medicamento?',
      'Foto da lesão (opcional)',
    ])
    expect(p[p.length - 1].tipo).toBe('foto')
  })

  it('especialidade sem pacote próprio recebe as perguntas gerais, sem foto', () => {
    const p = perguntasPreConsulta('cardiologia')
    expect(p.map((x) => x.rotulo)).toContain('Medicamentos que usa ou já usou')
    expect(p.some((x) => x.tipo === 'foto')).toBe(false)
  })

  it('toda especialidade pergunta sobre alergia e não repete ids', () => {
    for (const e of ESPECIALIDADES) {
      const p = perguntasPreConsulta(e.slug)
      expect(p.some((x) => x.id === 'alergias')).toBe(true)
      expect(new Set(p.map((x) => x.id)).size).toBe(p.length)
      expect(p.filter((x) => x.tipo === 'foto').length).toBeLessThanOrEqual(1)
    }
  })
})
