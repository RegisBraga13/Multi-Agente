import { describe, expect, it } from 'vitest'
import type { CondutaServidor, GrupoServidor, ItemReceitaServidor, PropostaCondutaServidor } from '../servidor/consulta'
import { escolherOpcao, escreverOutro, OUTRO } from './conduta'
import { bloqueadasDaConduta, condutaDoServidor, condutaParaServidor, textoDaFaixa, textoDaRetirada, urgenciaDaConduta } from './conduta-servidor'

const receita = (nome: string, via: 'topico' | 'oral' = 'topico'): ItemReceitaServidor => ({
  nome, forma: 'CREM', concentracao: '0,05%', quantidade: { n: 1, unidade: 'bisn. 30g', feminino: true }, via, posologia: 'Aplicar 1 vez ao dia.', duracao: '4sem',
})
const proposta = (extra: Partial<PropostaCondutaServidor> = {}): PropostaCondutaServidor => ({
  urgencia: 'rotina', emergencia: [], tabela: null, ia: null, origem: 'sugestão da IA', avisos: [], acao: 'HUMAN_REVIEW', iaFalhou: false, ...extra,
})
const bloco = (p: PropostaCondutaServidor): CondutaServidor => ({ proposta: p, diagnostico: { nome: 'Psoríase vulgar', cid: 'L40.0', certeza: 'hipotese' }, escolha: {}, textos: ['', '', '', ''], receita: [], livres: [] })
const DIA = '2026-11-22'
const DX = { id: 'l40-0-psoriase-vulgar', nome: 'Psoríase vulgar', cid: 'L40.0' }
const sinal = (id: string) => `sinal:${id}`

const ia = proposta({
  ia: {
    grupos: [
      { id: 'cuidados', opcoes: [{ rotulo: 'Rotina', texto: 'Rotina de cuidados.', receita: [] }] },
      { id: 'topico', opcoes: [{ rotulo: 'Corticoide', texto: 'Corticoide nas placas.', receita: [receita('Clobetasol')] }, { rotulo: 'Calcipotriol', texto: 'Calcipotriol nas placas.', receita: [receita('Calcipotriol')] }] },
      { id: 'sistemico', opcoes: [{ rotulo: 'Loratadina', texto: 'Loratadina oral.', receita: [receita('Loratadina', 'oral')] }, { rotulo: 'Hidroxizina', texto: 'Hidroxizina oral.', receita: [receita('Hidroxizina', 'oral')] }] },
      { id: 'orientacoes', opcoes: [{ rotulo: 'Fotoproteção', texto: 'Fotoproteção diária.', receita: [] }] },
    ],
  },
})
const linhaT = (id: string, multipla = false): GrupoServidor['linhas'][number] => ({ id, rotulo: null, prefixo: null, multipla, opcoes: [{ id: `${id}-a`, rotulo: 'A', texto: 'Opção A.', dias: null, receita: [receita('Adapaleno')] }] })
const grupoT = (id: GrupoServidor['id'], rotulo: string, multipla = false): GrupoServidor => ({ id, rotulo, fixo: null, linhas: [linhaT(id, multipla)] })
const tabela = proposta({
  origem: 'protocolo acne v1',
  tabela: {
    chave: 'acne', origem: 'protocolo acne v1',
    grupos: [grupoT('cuidados', '1. Cuidados básicos'), grupoT('topico', '2. Tratamento tópico'), grupoT('sistemico', '3. Tratamento sistêmico', true), grupoT('orientacoes', '4. Orientações')],
    bloqueadas: [{ opcao: 'isotretinoina', rotulo: 'Isotretinoína', motivo: 'gestação ou tentativa de gravidez' }],
    motivosOrdem: { topico: 'gestacao-ou-suspeita' },
  },
})

describe('condutaDoServidor', () => {
  it('com tabela: usa os grupos dela, mantém a linha de múltipla escolha, marca o kit e traduz o motivo da ordem', () => {
    const c = condutaDoServidor(bloco(tabela), DX, DIA, sinal)
    expect(c.grupos!.map((g) => g.id)).toEqual(['cuidados', 'topico', 'sistemico', 'orientacoes'])
    expect(c.grupos!.flatMap((g) => g.linhas).find((l) => l.id === 'sistemico')!.multipla).toBe(true)
    expect(c.escolha).toEqual({ kit: ['kit'] })
    expect(c.motivo).toEqual({ topico: 'sinal:gestacao-ou-suspeita' })
    expect(c.textos).toHaveLength(4)
    expect(c.revelado).toEqual([false, false, false, false])
  })
  it('sem tabela, com IA: um grupo por id, ids de opção estáveis, kit nas orientações e "Outro" em cada grupo', () => {
    const c = condutaDoServidor(bloco(ia), DX, DIA, sinal)
    const topico = c.grupos!.find((g) => g.id === 'topico')!
    expect(topico.linhas[0].opcoes.map((o) => o.id)).toEqual(['topico-0', 'topico-1', OUTRO])
    expect(topico.linhas[0].opcoes[0].receita).toHaveLength(1)
    expect(c.grupos!.find((g) => g.id === 'orientacoes')!.linhas.some((l) => l.id === 'kit')).toBe(true)
    expect(c.grupos!.every((g) => g.linhas.some((l) => l.opcoes.some((o) => o.id === OUTRO)))).toBe(true)
  })
  it('a IA que devolve só alguns grupos não desalinha os 4 textos', () => {
    const so = proposta({ ia: { grupos: [{ id: 'topico', opcoes: [{ rotulo: 'X', texto: 'X.', receita: [] }] }] } })
    const c = condutaDoServidor(bloco(so), DX, DIA, sinal)
    expect(c.grupos!.map((g) => g.id)).toEqual(['cuidados', 'topico', 'sistemico', 'orientacoes'])
    expect(c.textos).toHaveLength(4)
  })
  it('sem tabela e sem IA: abre as 4 seções em branco para o médico escrever', () => {
    const c = condutaDoServidor(bloco(proposta({ iaFalhou: true })), DX, DIA, sinal)
    expect(c.grupos).toBeNull()
    expect(c.revelado).toEqual([true, true, true, true])
    expect(c.textos).toEqual(['', '', '', ''])
  })
  it('na linha sistêmica da IA mais de uma opção pode ser marcada; na tópica, só uma', () => {
    let c = condutaDoServidor(bloco(ia), DX, DIA, sinal)
    c = escolherOpcao(escolherOpcao(c, 'sistemico', 'sistemico-0'), 'sistemico', 'sistemico-1')
    expect(c.escolha.sistemico).toEqual(['sistemico-0', 'sistemico-1'])
    c = escolherOpcao(escolherOpcao(c, 'topico', 'topico-0'), 'topico', 'topico-1')
    expect(c.escolha.topico).toEqual(['topico-1'])
  })
  it('linha de tabela marcada como múltipla aceita duas opções (a flag do servidor vale)', () => {
    const t = proposta({ tabela: { ...tabela.tabela!, grupos: tabela.tabela!.grupos.map((g) => (g.id === 'topico' ? { ...g, linhas: [{ ...linhaT('topico', true), opcoes: [...linhaT('topico').opcoes, { id: 'topico-b', rotulo: 'B', texto: 'Opção B.', dias: null, receita: [] }] }] } : g)) } })
    let c = condutaDoServidor(bloco(t), DX, DIA, sinal)
    c = escolherOpcao(escolherOpcao(c, 'topico', 'topico-a'), 'topico', 'topico-b')
    expect(c.escolha.topico).toEqual(['topico-a', 'topico-b'])
  })
})

describe('condutaParaServidor', () => {
  it('leva a escolha, os 4 textos, a receita das opções marcadas e o "Outro" em livres', () => {
    const base = bloco(ia)
    let c = condutaDoServidor(base, DX, DIA, sinal)
    c = escolherOpcao(c, 'sistemico', 'sistemico-0')
    c = escolherOpcao(c, 'sistemico', OUTRO)
    c = escreverOutro(c, 'sistemico', 'Pomada manipulada')
    const volta = condutaParaServidor(c, base)
    expect(volta.escolha.sistemico).toEqual(['sistemico-0', OUTRO])
    expect(volta.textos).toHaveLength(4)
    expect(volta.receita.map((i) => i.nome)).toEqual(['Loratadina'])
    expect(volta.livres).toEqual(['Pomada manipulada'])
    expect(volta.proposta).toBe(base.proposta)
    expect(volta.diagnostico).toBe(base.diagnostico)
  })
  it('sem grupos (IA falhou) leva só os textos que o médico escreveu', () => {
    const base = bloco(proposta({ iaFalhou: true }))
    const c = condutaDoServidor(base, DX, DIA, sinal)
    const volta = condutaParaServidor({ ...c, textos: ['Rotina.', '', '', 'Retorno em 8 semanas.'] }, base)
    expect(volta).toMatchObject({ textos: ['Rotina.', '', '', 'Retorno em 8 semanas.'], receita: [], livres: [] })
  })
})

describe('urgência e opções retiradas', () => {
  it('rotina não tem faixa; imediata leva as ações; prioritária leva a faixa sem ações', () => {
    expect(urgenciaDaConduta(proposta())).toBeNull()
    expect(urgenciaDaConduta(proposta({ urgencia: 'imediata', emergencia: ['Suspender o medicamento', 'Encaminhar ao hospital'] }))).toEqual({ nivel: 'imediata', acoes: ['Suspender o medicamento', 'Encaminhar ao hospital'] })
    expect(urgenciaDaConduta(proposta({ urgencia: 'prioritaria' }))).toEqual({ nivel: 'prioritaria', acoes: [] })
  })
  it('textoDaFaixa', () => {
    expect(textoDaFaixa({ nivel: 'imediata', acoes: ['Suspender o medicamento', 'Encaminhar ao hospital.'] })).toBe('Urgência imediata: Suspender o medicamento. Encaminhar ao hospital.')
    expect(textoDaFaixa({ nivel: 'prioritaria', acoes: [] })).toBe('Prioridade: há sinal de alerta de prioridade nesta consulta.')
  })
  it('bloqueadasDaConduta e textoDaRetirada', () => {
    expect(bloqueadasDaConduta(tabela)).toEqual([{ rotulo: 'Isotretinoína', motivo: 'gestação ou tentativa de gravidez' }])
    expect(bloqueadasDaConduta(ia)).toEqual([])
    expect(textoDaRetirada({ rotulo: 'Isotretinoína', motivo: 'gestação ou tentativa de gravidez.' })).toBe('Não sugerido: Isotretinoína — gestação ou tentativa de gravidez.')
  })
})
