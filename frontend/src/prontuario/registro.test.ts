import { beforeEach, describe, expect, it } from 'vitest'
import { chavePaciente, entradas, salvarEntrada, tituloNovaEntrada, type EntradaProntuario } from './registro'

// localStorage de mentira (o teste roda fora do navegador)
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(), key: () => null, get length() { return mem.size },
} as Storage

const JOAO = chavePaciente({ nome: 'João Pedro Lima', nascimento: '1974-08-02' })
const MARIANA = chavePaciente({ nome: 'Mariana Costa', nascimento: '1992-03-14' })
const entrada = (tipo: EntradaProntuario['tipo'], data: string): Omit<EntradaProntuario, 'titulo'> => ({ tipo, data, hora: '08:00', secoes: [{ titulo: '', linhas: [{ rotulo: 'QP', texto: 'x' }] }] })

beforeEach(() => mem.clear())

describe('prontuário do paciente', () => {
  it('chave sem acentos, com o nascimento', () => {
    expect(JOAO).toBe('1974-08-02-joao-pedro-lima')
  })
  it('títulos: Consulta 1, Consulta 1 — Retorno, Consulta 2, Consulta 2 — Retorno', () => {
    const t: EntradaProntuario[] = []
    for (const tipo of ['consulta', 'retorno', 'consulta', 'retorno'] as const) t.push({ ...entrada(tipo, '2026-01-01'), titulo: tituloNovaEntrada(t, tipo) })
    expect(t.map((x) => x.titulo)).toEqual(['Consulta 1', 'Consulta 1 — Retorno', 'Consulta 2', 'Consulta 2 — Retorno'])
  })
  it('paciente sem nada salvo: vazio; o exemplo do João já tem a Consulta 1', () => {
    expect(entradas(MARIANA)).toEqual([])
    expect(entradas(JOAO).map((e) => e.titulo)).toEqual(['Consulta 1'])
  })
  it('salvar: o retorno do João vira "Consulta 1 — Retorno" e fica no topo; salvar de novo não duplica', () => {
    salvarEntrada(JOAO, entrada('retorno', '2026-11-13'))
    salvarEntrada(JOAO, entrada('retorno', '2026-11-13'))
    expect(entradas(JOAO).map((e) => e.titulo)).toEqual(['Consulta 1 — Retorno', 'Consulta 1'])
  })
  it('a primeira consulta da Mariana vira "Consulta 1"', () => {
    salvarEntrada(MARIANA, entrada('consulta', '2026-11-13'))
    expect(entradas(MARIANA)[0].titulo).toBe('Consulta 1')
  })
  it('dado estragado no navegador é ignorado (nada inventado)', () => {
    mem.set(`especialista:prontuario:${MARIANA}`, JSON.stringify([{ titulo: 'x' }, 'lixo']))
    expect(entradas(MARIANA)).toEqual([])
    mem.set(`especialista:prontuario:${MARIANA}`, '{quebrado')
    expect(entradas(MARIANA)).toEqual([])
  })
})
