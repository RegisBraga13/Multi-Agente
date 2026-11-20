import { beforeEach, describe, expect, it } from 'vitest'
import { dataLocal } from '../medico/exemplo'
import { buscarPaciente } from '../modulo/exemplo'
import { ANTONIO_ID, JOAO_ID, entradas, salvarEntrada, tituloDaConsulta, tituloNovaEntrada, type DadosEntrada, type NovaEntrada } from './registro'

// localStorage de mentira (o teste roda fora do navegador)
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(), key: () => null, get length() { return mem.size },
} as Storage

const MARIANA = '92b99e33-e1c8-46f0-bd6b-d9edcc9d7c36'
const DADOS: DadosEntrada = {
  qp: 'x', hda: '', ap: '', hp: '', hf: '', exameFisico: '', examesTexto: '', exames: [], diagnosticos: [{ nome: 'Acne', cid: 'L70.0', pct: 80, situacao: 'assinalado' }],
  receita: null, condutaTexto: '', solicitado: [], encaminhado: [], orientacoes: '', retorno: '', documentos: [], fotos: [],
}
const nova = (tipo: NovaEntrada['tipo'], data: string, hora = '08:00'): NovaEntrada => ({ tipo, modalidade: 'presencial', data, hora, dados: DADOS, edicoes: {} })

beforeEach(() => mem.clear())

describe('prontuário do paciente', () => {
  it('o paciente tem identificador próprio; nome e nascimento vêm do cadastro', () => {
    expect(buscarPaciente(JOAO_ID)).toEqual({ id: JOAO_ID, nome: 'João Pedro Lima', nascimento: '1974-08-02' })
    expect(buscarPaciente('nao-existe')).toBeUndefined()
    // endereço antigo da janela (nascimento-nome) ainda abre o mesmo paciente
    expect(buscarPaciente('1974-08-02-joao-pedro-lima')?.id).toBe(JOAO_ID)
  })
  it('títulos: Consulta 1, — Retorno, — Retorno 2, Consulta 2, Consulta 2 — Retorno', () => {
    const t: { tipo: NovaEntrada['tipo']; data: string; hora: string }[] = []
    const titulos: string[] = []
    ;(['consulta', 'retorno', 'retorno', 'consulta', 'retorno'] as const).forEach((tipo, i) => {
      titulos.push(tituloNovaEntrada(t, tipo))
      t.push({ tipo, data: `2026-0${i + 1}-01`, hora: '08:00' })
    })
    expect(titulos).toEqual(['Consulta 1', 'Consulta 1 — Retorno', 'Consulta 1 — Retorno 2', 'Consulta 2', 'Consulta 2 — Retorno'])
  })
  it('paciente sem nada salvo: vazio; o exemplo do João já tem a Consulta 1 (dados organizados)', () => {
    expect(entradas(MARIANA)).toEqual([])
    const [c1] = entradas(JOAO_ID)
    expect(c1.titulo).toBe('Consulta 1')
    expect(c1.dados.diagnosticos.map((x) => x.situacao)).toEqual(['assinalado', 'sugerido', 'sugerido'])
    expect(c1.dados.receita!.itens.map((x) => x.duracao)).toEqual(['4sem', 'uso contínuo'])
  })
  it('salvar: o retorno do João vira "Consulta 1 — Retorno" no topo; salvar de novo não duplica e mantém o id', () => {
    expect(tituloDaConsulta(JOAO_ID, 'retorno', '2026-11-13', '08:30')).toBe('Consulta 1 — Retorno')
    const a = salvarEntrada(JOAO_ID, nova('retorno', '2026-11-13', '08:30'))!
    const b = salvarEntrada(JOAO_ID, nova('retorno', '2026-11-13', '08:30'))!
    expect(b.id).toBe(a.id)
    expect(entradas(JOAO_ID).map((e) => e.titulo)).toEqual(['Consulta 1 — Retorno', 'Consulta 1'])
    // o próximo retorno do João seria o 2º
    expect(tituloDaConsulta(JOAO_ID, 'retorno', '2027-01-08', '08:30')).toBe('Consulta 1 — Retorno 2')
  })
  it('entrada salva da consulta não muda quando o retorno é salvo', () => {
    const antes = entradas(JOAO_ID).find((e) => e.titulo === 'Consulta 1')!
    salvarEntrada(JOAO_ID, { ...nova('retorno', '2026-11-13', '08:30'), dados: { ...DADOS, diagnosticos: [{ nome: 'Artrite psoriásica', cid: 'L40.5', pct: 60, situacao: 'assinalado' }] } })
    expect(entradas(JOAO_ID).find((e) => e.titulo === 'Consulta 1')).toEqual(antes)
  })
  it('a primeira consulta da Mariana vira "Consulta 1"', () => {
    salvarEntrada(MARIANA, nova('consulta', '2026-11-13'))
    expect(entradas(MARIANA)[0].titulo).toBe('Consulta 1')
  })
  it('dado estragado (ou no formato antigo, só texto) é ignorado: nada inventado', () => {
    mem.set(`especialista:prontuario:${MARIANA}`, JSON.stringify([{ titulo: 'x' }, 'lixo', { titulo: 'Consulta 1', tipo: 'consulta', data: '2026-01-01', hora: '08:00', secoes: [] }]))
    expect(entradas(MARIANA)).toEqual([])
    mem.set(`especialista:prontuario:${MARIANA}`, '{quebrado')
    expect(entradas(MARIANA)).toEqual([])
  })
})

describe('Antônio Barbosa: prontuário pronto de exemplo', () => {
  it('tem a consulta de hoje salva, com 3 diagnósticos e a conduta (biópsia)', () => {
    const [e] = entradas(ANTONIO_ID)
    expect(e).toMatchObject({ titulo: 'Consulta 1', tipo: 'consulta', hora: '08:00' })
    expect(e.data).toBe(dataLocal(new Date()))
    expect(e.dados.diagnosticos).toHaveLength(3)
    expect(e.dados.solicitado).toEqual(['biópsia da lesão (anatomopatológico)'])
  })
})
