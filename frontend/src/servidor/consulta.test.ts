import { describe, expect, it } from 'vitest'
import { lerEventos, urlDaGeracao, urlDoDocumento } from './consulta'

describe('lerEventos (fluxo de eventos do servidor)', () => {
  it('lê os eventos na ordem, com o JSON de cada um', () => {
    const texto = 'event: parcial\ndata: {"qp":"Esp"}\n\nevent: pronto\ndata: {"gravado":true}\n\n'
    expect(lerEventos(texto)).toEqual([
      { evento: 'parcial', dados: { qp: 'Esp' } },
      { evento: 'pronto', dados: { gravado: true } },
    ])
  })
  it('ignora o bloco incompleto no fim', () => {
    expect(lerEventos('event: parcial\ndata: {"a":1}\n\nevent: pronto\ndata: {"gra')).toEqual([{ evento: 'parcial', dados: { a: 1 } }])
  })
  it('texto vazio não tem eventos', () => {
    expect(lerEventos('')).toEqual([])
  })
})

describe('urlDaGeracao', () => {
  it('monta o endereço de cada etapa que a IA escreve', () => {
    expect(urlDaGeracao('abc', 'historia')).toBe('/api/consultas/abc/historia/gerar')
    expect(urlDaGeracao('abc', 'diagnosticos')).toBe('/api/consultas/abc/diagnosticos/gerar')
  })
})

describe('urlDaGeracao da conduta', () => {
  it('monta o endereço da conduta', () => {
    expect(urlDaGeracao('abc', 'conduta')).toBe('/api/consultas/abc/conduta/gerar')
  })
})

describe('urlDoDocumento', () => {
  it('monta o endereço de cada documento da consulta', () => {
    expect(urlDoDocumento('abc', 'atestado')).toBe('/api/consultas/abc/documentos/atestado')
    expect(urlDoDocumento('abc', 'receita')).toBe('/api/consultas/abc/documentos/receita')
  })
})
