import { describe, expect, it } from 'vitest'
import cid10 from '../dados/cid10.json'
import { buscarCid, type Cid } from './cid10'

const lista: Cid[] = [
  ['L40', 'Psoríase'], ['L40.0', 'Psoríase vulgar'], ['L40.1', 'Psoríase pustulosa generalizada'], ['L41', 'Parapsoríase'],
  ['L70.0', 'Acne vulgar'], ['L21', 'Dermatite seborreica'], ['C44.3', 'Neoplasia maligna da pele da face'],
]
const codigos = (r: Cid[]) => r.map((x) => x[0])

describe('buscarCid', () => {
  it('acha pelo nome sem diferenciar acento nem maiúscula', () => {
    expect(codigos(buscarCid(lista, 'PSORIASE'))).toContain('L40.0')
    expect(codigos(buscarCid(lista, 'psoríase vulgar'))).toEqual(['L40.0'])
  })
  it('as palavras podem vir em qualquer ordem', () => {
    expect(codigos(buscarCid(lista, 'vulgar psoriase'))).toEqual(['L40.0'])
  })
  it('pelo código: prefixo, com ou sem ponto, em ordem de código', () => {
    expect(codigos(buscarCid(lista, 'l40'))).toEqual(['L40', 'L40.0', 'L40.1'])
    expect(codigos(buscarCid(lista, 'L40.0'))).toEqual(['L40.0'])
    expect(codigos(buscarCid(lista, 'l400'))).toEqual(['L40.0'])
  })
  it('quem começa com o termo vem antes de quem só contém', () => {
    expect(codigos(buscarCid(lista, 'psoriase'))[0]).toBe('L40')
    expect(codigos(buscarCid(lista, 'psoriase')).indexOf('L41')).toBeGreaterThan(codigos(buscarCid(lista, 'psoriase')).indexOf('L40.1'))
  })
  it('respeita o limite', () => {
    expect(buscarCid(lista, 'l', 2)).toHaveLength(0) // 1 letra só: não busca
    expect(buscarCid(lista, 'ps', 2)).toHaveLength(2)
  })
  it('termo vazio, de 1 letra ou sem resultado devolve lista vazia', () => {
    expect(buscarCid(lista, '')).toEqual([])
    expect(buscarCid(lista, '   ')).toEqual([])
    expect(buscarCid(lista, 'zzzz')).toEqual([])
  })
})

describe('a tabela do CID-10 do DATASUS', () => {
  it('tem os códigos comuns da dermatologia, com acento', () => {
    const m = new Map(cid10 as unknown as Cid[])
    expect(m.get('L40.0')).toBe('Psoríase vulgar')
    expect(m.get('L70.0')).toBe('Acne vulgar')
    expect(m.get('C44.3')).toMatch(/^Neoplasia maligna da pele/)
    expect(m.size).toBeGreaterThan(14000)
  })
  it('a busca real acha "psoriase" e "L40"', () => {
    expect(codigos(buscarCid(cid10 as unknown as Cid[], 'psoriase vulgar'))).toContain('L40.0')
    expect(codigos(buscarCid(cid10 as unknown as Cid[], 'L40'))[0]).toBe('L40')
  })
})
