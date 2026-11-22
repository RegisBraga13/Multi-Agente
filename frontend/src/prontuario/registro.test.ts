import { beforeEach, describe, expect, it } from 'vitest'
import { tabelaDeExames } from '../consulta/exames-tabela'
import { dataLocal } from '../medico/exemplo'
import { buscarPaciente } from '../modulo/exemplo'
import { ANTONIO_ID, JOAO_ID, cadastroDoPaciente, entradas, pacientesComProntuario, salvarEntrada, tituloDaConsulta, tituloNovaEntrada, type DadosEntrada, type NovaEntrada } from './registro'

// localStorage de mentira (o teste roda fora do navegador)
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(), key: (i: number) => [...mem.keys()][i] ?? null, get length() { return mem.size },
} as Storage

const MARIANA = '92b99e33-e1c8-46f0-bd6b-d9edcc9d7c36'
const DADOS: DadosEntrada = {
  qp: 'x', hda: '', ap: '', hp: '', hf: '', exameFisico: '', examesTexto: '', exames: [], diagnosticos: [{ nome: 'Acne', cid: 'L70.0', pct: 80, situacao: 'assinalado' }],
  receita: null, condutaTexto: '', solicitado: [], encaminhado: [], orientacoes: '', avaliacao: '', documentos: [], fotos: [],
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

describe('Histórico de exames (tabela montada dos exames de cada evento)', () => {
  it('cada retorno ou consulta salvo acrescenta uma coluna à tabela, sem apagar as anteriores', () => {
    const exame = (data: string, valor: string) => ({ exame: 'Exames laboratoriais', nome: 'Glicemia de jejum', valor, status: 'PRESENT' as const, data, origem: 'x.pdf' })
    const daVez = (data: string, tipo: 'consulta' | 'retorno', valor: string): NovaEntrada => ({ ...nova(tipo, data), dados: { ...DADOS, exames: [exame(data === '2026-11-20' ? '12/11/2026' : '01/01/2027', valor)] } })
    const tabela = () => tabelaDeExames(entradas(JOAO_ID).flatMap((e) => e.dados.exames), [])
    expect(tabela()?.datas).toEqual(['10/09/2026'])
    salvarEntrada(JOAO_ID, daVez('2026-11-20', 'retorno', '101 mg/dL'))
    expect(tabela()?.datas).toEqual(['10/09/2026', '12/11/2026'])
    salvarEntrada(JOAO_ID, daVez('2027-01-08', 'retorno', '97 mg/dL'))
    expect(tabela()?.linhas[0]).toEqual({ nome: 'Glicemia de jejum', valores: ['98 mg/dL', '101 mg/dL', '97 mg/dL'] })
  })
})

describe('quem tem prontuário (acesso a qualquer hora)', () => {
  it('só quem terminou consulta ou retorno: os de exemplo e quem salvou; sem entrada, fora', () => {
    expect(pacientesComProntuario().map((p) => p.id).sort()).toEqual([ANTONIO_ID, JOAO_ID].sort())
    salvarEntrada(MARIANA, nova('consulta', '2026-11-21'), { id: MARIANA, nome: 'Mariana Costa', nascimento: '1999-01-01' })
    const m = pacientesComProntuario().find((p) => p.id === MARIANA)
    expect(m).toMatchObject({ nome: 'Mariana Costa', entradas: 1, ultima: '2026-11-21' })
  })
  it('paciente que não é de exemplo mantém nome e nascimento guardados ao salvar', () => {
    const NOVA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    expect(cadastroDoPaciente(NOVA)).toBeUndefined()
    salvarEntrada(NOVA, nova('consulta', '2026-11-21'), { id: NOVA, nome: 'Paciente Real', nascimento: '1980-05-05' })
    expect(cadastroDoPaciente(NOVA)).toEqual({ id: NOVA, nome: 'Paciente Real', nascimento: '1980-05-05' })
    expect(pacientesComProntuario().map((p) => p.id)).toContain(NOVA)
  })
})

describe('entrada salva antes da separação avaliação/retorno', () => {
  it('a chave antiga "retorno" é lida como "avaliacao" (o prontuário local não some)', () => {
    const semAvaliacao: Record<string, unknown> = { ...DADOS }
    delete semAvaliacao.avaliacao
    const antiga = { id: 'e1', pacienteId: MARIANA, titulo: 'Consulta 1', tipo: 'consulta', modalidade: 'presencial', data: '2026-11-01', hora: '08:00', dados: { ...semAvaliacao, retorno: 'em 8 semanas.' }, edicoes: {}, adendos: [] }
    mem.set(`especialista:prontuario:${MARIANA}`, JSON.stringify([antiga]))
    expect(entradas(MARIANA).map((e) => e.dados.avaliacao)).toEqual(['em 8 semanas.'])
  })
})
