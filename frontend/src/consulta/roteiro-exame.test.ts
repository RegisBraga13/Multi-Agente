import { describe, expect, it } from 'vitest'
import { alternarMarca, camposDoRoteiro, roteiroDoExame, textoDaParte } from './roteiro-exame'

const r = roteiroDoExame('reumatologia')!
const parte = (id: string) => r.find((p) => p.id === id)!

describe('roteiro do exame (reumatologia, autor 24/11/2026)', () => {
  it('5 partes na ordem; dermatologia não tem roteiro', () => {
    expect(r.map((p) => p.titulo)).toEqual(['GALS', 'Mapa articular', 'IPAM', 'Padrão', 'Extra-articular'])
    expect(roteiroDoExame('dermatologia')).toBeUndefined()
  })

  it('linha de uma resposta troca; de várias acumula; tocar de novo desmarca', () => {
    let m = alternarMarca({}, 'gals.marcha', 'Normal', false)
    m = alternarMarca(m, 'gals.marcha', 'Claudicante', false)
    expect(m['gals.marcha']).toEqual(['Claudicante'])
    m = alternarMarca(m, 'mapa.mcf', 'D', true)
    m = alternarMarca(m, 'mapa.mcf', 'E', true)
    expect(m['mapa.mcf']).toEqual(['D', 'E'])
    expect(alternarMarca(m, 'gals.marcha', 'Claudicante', false)['gals.marcha']).toBeUndefined()
  })

  it('texto de cada parte só com o que foi marcado; parte vazia = não examinada (null)', () => {
    const m = {
      'gals.marcha': ['Claudicante'], 'gals.pernas': ['Alterado'], 'gals.bracos': ['Normal'],
      'mapa.ombro': ['D'], 'mapa.mcf': ['D', 'E'], 'mapa.lombar': ['Sim'],
      'ipam.inspecao': ['Edema articular'], 'ipam.palpacao': ['Calor local'], 'ipam.adm_ativa': ['Limitada por dor/fraqueza'],
      'ipam.mao': ['Phalen', 'Finkelstein'],
      'padrao.numero': ['Poli (≥ 5)'], 'padrao.simetria': ['Simétrico'],
    }
    expect(textoDaParte(parte('gals'), m)).toBe('Marcha claudicante; braços normais; pernas alteradas.')
    expect(textoDaParte(parte('mapa'), m)).toBe('Ombro D; MCFs D e E; coluna lombar.')
    expect(textoDaParte(parte('ipam'), m)).toBe('Inspeção: edema articular. Palpação: calor local. ADM ativa limitada por dor/fraqueza. Manobras positivas: Phalen, Finkelstein (mão/punho).')
    expect(textoDaParte(parte('padrao'), m)).toBe('Poli (≥ 5), simétrico.')
    expect(textoDaParte(parte('extra'), m)).toBeNull()
    expect(camposDoRoteiro(r, m).map((c) => c.rotulo)).toEqual(['GALS', 'Articulações acometidas', 'IPAM', 'Padrão', 'Extra-articular'])
  })
})
