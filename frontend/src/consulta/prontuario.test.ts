import { describe, expect, it } from 'vitest'
import { escolherOpcao, montarConduta, revelar, type Conduta } from './conduta'
import type { ItemDD } from './diagnosticos'
import { montarAnexos } from './anexos'
import { CONDUTAS } from './conduta-exemplo'
import { atualizarProntuario, chave, montarProntuario } from './prontuario'

const item = (id: string, nome: string, cid: string, decisao: ItemDD['decisao']): ItemDD => ({ hip: { id, nome, cid, pct: 50, evidencias: [] }, decisao, propria: false, mudou: false, aviso: null })
const ITENS = [item('acne', 'Acne grau II · papulopustulosa', 'L70.0', 'confirmada'), item('rosacea', 'Rosácea', 'L71', 'descartada')]
const HISTORIA = [
  { rotulo: 'Identificação', texto: 'Mariana Costa, 34 anos' },
  { rotulo: 'Queixa principal', texto: 'Espinhas no rosto.' },
  { rotulo: 'História da doença atual', texto: 'Paciente de 34 anos refere espinhas há 6 meses.' },
  { rotulo: 'Antecedentes e alertas', texto: 'Nega alergias.' },
  { rotulo: 'Exame físico', texto: 'Pápulas e pústulas em face.' },
  { rotulo: 'Exames complementares', texto: 'Nenhum exame trazido.' },
]
const conduta = (): Conduta => [0, 1, 2, 3].reduce((x, i) => revelar(x, i), [['cuidados', 'oleosa'], ['topico', 'adapaleno-bpo'], ['exames', 'hormonal'], ['retorno', '8s'], ['encaminhamento', 'gineco']]
  .reduce((x, [l, o]) => escolherOpcao(x, l, o), montarConduta([ITENS[0]], [], '2026-11-13')!))
const linhas = (xs: ReturnType<typeof montarProntuario>) => Object.fromEntries(xs.flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto])))

describe('montarProntuario (QP, HDA, AP, Ex. físico, HD e Conduta; só o que foi colhido)', () => {
  const p = montarProntuario(HISTORIA, ITENS, conduta())
  const t = linhas(p)
  it('S e O vêm da história salva; campo não colhido some (exames avaliados, sinais vitais)', () => {
    expect(t['S.qp']).toBe('Espinhas no rosto.')
    expect(t['S.hda']).toMatch(/^Paciente de 34 anos refere/)
    expect(t['S.ap']).toBe('Nega alergias.')
    expect(t['O.exame']).toBe('Pápulas e pústulas em face.')
    expect('O.exames' in t).toBe(false)
  })
  it('HD: só os diagnósticos confirmados, com o CID entre parênteses', () => {
    expect(t['A.hd']).toBe('Acne grau II · papulopustulosa (CID-10 L70.0)')
  })
  it('conduta: o tratamento sem rótulo; solicitado (kit = "exames de rotina", sem descrever), encaminhado, orientações, retorno', () => {
    expect(p.find((s) => s.id === 'P')!.titulo).toBe('Conduta')
    expect(p.filter((s) => s.titulo).length).toBe(1)
    expect(t['P.conduta']).toContain('Adapaleno')
    expect(p.find((s) => s.id === 'P')!.linhas[0].rotulo).toBe('')
    expect(t['P.solicitado']).toBe('exames de rotina, perfil hormonal.')
    expect(t['P.encaminhado']).toBe('ginecologia.')
    expect(t['P.orientacoes']).toBe('Não manipular lesões inflamatórias. Ajustar frequência conforme tolerabilidade cutânea.')
    expect(t['P.retorno']).toBe('em 8 semanas, em 08/01/2027.')
  })
  it('HP e HF só quando houver na história', () => {
    expect('S.hp' in t || 'S.hf' in t).toBe(false)
    const com = linhas(montarProntuario([...HISTORIA, { rotulo: 'História familiar', texto: 'Mãe com acne na adolescência.' }], ITENS, conduta()))
    expect(com['S.hf']).toBe('Mãe com acne na adolescência.')
  })
  it('seção sem nenhum dado colhido não aparece', () => {
    const vazia = montarProntuario(HISTORIA.map((s) => (s.rotulo === 'Exame físico' ? { ...s, texto: 'Não registrado.' } : s)), ITENS, conduta())
    expect(vazia.map((s) => s.id)).toEqual(['S', 'A', 'P'])
  })
})

describe('atualizarProntuario', () => {
  it('linha cuja origem não mudou mantém a edição do médico; a que mudou é reescrita', () => {
    const antes = montarProntuario(HISTORIA, ITENS, conduta())
    const textos = { ...linhas(antes), 'S.qp': 'Editado pelo médico.' }
    const novas = montarProntuario(HISTORIA, ITENS, escolherOpcao(conduta(), 'retorno', '4s'))
    const r = atualizarProntuario(antes, textos, novas)
    expect(r.textos['S.qp']).toBe('Editado pelo médico.')
    expect(r.mudou['S.qp']).toBe(false)
    expect(r.textos['P.retorno']).toMatch(/^em 4 semanas/)
    expect(r.mudou['P.retorno']).toBe(true)
  })
})

describe('tratamento no prontuário (detalhado: o retorno pode usar só o prontuário)', () => {
  const DADOS = { paciente: 'Mariana Costa', idade: 34, data: '13/11/2026', hora: '08:00' }
  it('é a receita enviada, como está (com a edição do médico); sem receita, o texto da conduta', () => {
    const c = escolherOpcao(conduta(), 'sistemico', 'limeciclina')
    const receita = montarAnexos(c, DADOS).find((a) => a.tipo === 'receita')!.texto
    expect(linhas(montarProntuario(HISTORIA, ITENS, c, receita))['P.conduta']).toBe(receita)
    expect(linhas(montarProntuario(HISTORIA, ITENS, c, 'Receita editada.'))['P.conduta']).toBe('Receita editada.')
    expect(linhas(montarProntuario(HISTORIA, ITENS, c))['P.conduta']).toContain('Limeciclina oral, associada ao tratamento tópico — 8sem.')
  })
  it('todo item da receita de exemplo tem o tempo de tratamento', () => {
    const itens = Object.values(CONDUTAS).flatMap((m) => m.grupos.flatMap((g) => g.linhas.flatMap((l) => l.opcoes.flatMap((o) => o.receita ?? []))))
    expect(itens.length).toBeGreaterThan(0)
    for (const x of itens) expect(x.duracao).toMatch(/^(\d+sem|\d+ dias|uso contínuo)$/)
  })
})
