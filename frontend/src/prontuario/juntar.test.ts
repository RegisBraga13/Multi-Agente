import { describe, expect, it } from 'vitest'
import { adendoValido, juntarEntradas, juntarPacientes } from './juntar'
import type { EntradaProntuario } from './registro'

const entrada = (id: string, data: string, hora = '09:00', tipo: 'consulta' | 'retorno' = 'consulta'): EntradaProntuario => ({
  id, pacienteId: 'p1', titulo: id, tipo, modalidade: 'presencial', data, hora, edicoes: {}, adendos: [],
  dados: { qp: '', hda: '', ap: '', hp: '', hf: '', exameFisico: '', examesTexto: '', exames: [], diagnosticos: [], receita: null, condutaTexto: '', solicitado: [], encaminhado: [], orientacoes: '', retorno: '', documentos: [], fotos: [] },
})

describe('juntarEntradas', () => {
  it('soma local e servidor, mais recente no topo', () => {
    const r = juntarEntradas([entrada('a', '2026-10-01')], [entrada('b', '2026-11-01'), entrada('c', '2026-10-15', '08:00')])
    expect(r.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
  it('o mesmo id não repete e a do servidor vence', () => {
    const local = entrada('x', '2026-11-01')
    const servidor = { ...entrada('x', '2026-11-01'), adendos: [{ quando: '22/11/2026 10:00', texto: 'Ajuste.' }] }
    const r = juntarEntradas([local], [servidor])
    expect(r).toHaveLength(1)
    expect(r[0].adendos).toHaveLength(1)
  })
  it('um lado vazio devolve o outro', () => {
    expect(juntarEntradas([], [entrada('a', '2026-11-01')])).toHaveLength(1)
    expect(juntarEntradas([entrada('a', '2026-11-01')], [])).toHaveLength(1)
  })
  it('retorno_enxerga_consulta_do_servidor', () => {
    expect(juntarEntradas([], [entrada('s', '2026-11-01')]).find((e) => e.tipo === 'consulta')).toBeDefined()
  })
})

describe('juntarPacientes', () => {
  const local = (id: string, entradas: number, ultima: string) => ({ id, nome: `L ${id}`, nascimento: '1990-01-01', entradas, ultima })
  const serv = (id: string, entradas: number, ultima: string) => ({ id, nome: `S ${id}`, nascimento: '1990-01-01', entradas, ultima })
  it('só local, só servidor e nos dois (soma e maior data, nome do servidor)', () => {
    const r = juntarPacientes([local('a', 1, '2026-09-18'), local('c', 1, '2026-11-10')], [serv('b', 2, '2026-11-20'), serv('c', 1, '2026-11-22')])
    expect(r.map((p) => p.id)).toEqual(['c', 'b', 'a'])
    expect(r.find((p) => p.id === 'c')).toMatchObject({ entradas: 2, ultima: '2026-11-22', nome: 'S c' })
  })
})

describe('adendoValido', () => {
  it('só com texto de verdade', () => {
    expect(adendoValido('')).toBe(false)
    expect(adendoValido('   ')).toBe(false)
    expect(adendoValido('Ajuste de dose')).toBe(true)
  })
})
