import { describe, expect, it } from 'vitest'
import { atualizarConduta, dataMais, diagnosticoPrincipal, editarTexto, escolherOpcao, escreverOutro, montarConduta, pendenciasConduta, revelar } from './conduta'
import type { Decisao, Hipotese, ItemDD } from './diagnosticos'
import type { ItemResumo } from './resumo'

const hip = (id: string, nome: string, cid: string): Hipotese => ({ id, nome, cid, pct: 50, evidencias: [] })
const item = (h: Hipotese, decisao: Decisao, propria = false): ItemDD => ({ hip: h, decisao, propria, mudou: false, aviso: null })
const ACNE = hip('acne', 'Acne grau II · papulopustulosa', 'L70.0')
const ROSACEA = hip('rosacea', 'Rosácea', 'L71.9')
const r = (texto: string, marca: 'v' | 'f'): ItemResumo => ({ id: texto, tipo: 'outro', texto, marcaIA: marca, marca, secao: 'Antecedentes e alertas', trecho: texto })
const DIA = '2026-11-13'
const ids = (c: NonNullable<ReturnType<typeof montarConduta>>, linha: string) =>
  c.grupos!.flatMap((g) => g.linhas).find((l) => l.id === linha)!.opcoes.map((o) => o.id)

describe('montarConduta', () => {
  it('só diagnóstico confirmado conta; sem confirmado não há conduta', () => {
    expect(montarConduta([item(ACNE, 'pendente'), item(ROSACEA, 'descartada')], [], DIA)).toBeNull()
    expect(diagnosticoPrincipal([item(ROSACEA, 'confirmada'), item(ACNE, 'confirmada')])!.hip.id).toBe('acne')
  })
  it('acne: 4 grupos fechados, opções sugeridas e NENHUMA marcada; quadro da direita vazio', () => {
    const c = montarConduta([item(ACNE, 'confirmada')], [], DIA)!
    expect(c.grupos!.map((g) => g.rotulo)).toEqual(['1. Cuidados básicos', '2. Tratamento tópico', '3. Tratamento sistêmico', '4. Orientações'])
    // só o kit de rotina vem marcado (Orientações); o resto, o médico escolhe
    expect(c.escolha).toEqual({ kit: ['kit'] })
    expect(c.revelado).toEqual([false, false, false, false])
    expect(c.textos.slice(0, 3)).toEqual(['', '', ''])
    expect(ids(c, 'sistemico')).not.toContain('nao')
  })
  it('lê o "Para relembrar": planeja gravidez V → ácido azelaico vem primeiro, com a fonte; F → ordem normal', () => {
    const v = montarConduta([item(ACNE, 'confirmada')], [r('Planeja gravidez', 'v')], DIA)!
    expect(ids(v, 'topico')[0]).toBe('azelaico')
    expect(v.motivo.topico).toBe('Planeja gravidez')
    expect(v.escolha).toEqual({ kit: ['kit'] })
    const f = montarConduta([item(ACNE, 'confirmada')], [r('Planeja gravidez', 'f')], DIA)!
    expect(ids(f, 'topico')[0]).toBe('adapaleno-bpo')
  })
  it('diagnóstico sem conduta de exemplo (ou do próprio médico): as 4 seções abertas para o médico escrever', () => {
    const c = montarConduta([item(hip('propria-1', 'Outro', ''), 'confirmada', true)], [], DIA)!
    expect(c.grupos).toBeNull()
    expect(c.revelado).toEqual([true, true, true, true])
    expect(pendenciasConduta(c)).toBe('Escreva a conduta')
  })
})

describe('médico escolhe', () => {
  const c = montarConduta([item(ACNE, 'confirmada')], [], DIA)!
  it('escolher refaz só o texto daquele grupo; Orientações com a data de retorno', () => {
    // sem "Não solicitar": exame não marcado = não solicitar
    expect(ids(c, 'exames')).toEqual(['hormonal'])
    const d = escolherOpcao(c, 'retorno', '12s')
    expect(d.textos[3]).toBe('Não manipular lesões inflamatórias. Ajustar frequência conforme tolerabilidade cutânea. Solicito exames de rotina: hemograma, glicemia de jejum, perfil lipídico, TSH, função renal, função hepática e EAS. Retorno em 12 semanas, em 05/02/2027.')
    expect(d.textos.slice(0, 3)).toEqual(['', '', ''])
  })
  it('linha de uma escolha: outra opção troca; clicar na marcada desmarca', () => {
    const d = escolherOpcao(escolherOpcao(c, 'topico', 'bpo'), 'topico', 'azelaico')
    expect(d.escolha.topico).toEqual(['azelaico'])
    expect(escolherOpcao(d, 'topico', 'azelaico').escolha.topico).toEqual([])
  })
  it('tratamento sistêmico é de múltipla escolha: um medicamento não exclui outro; nada marcado = vazio', () => {
    const a = escolherOpcao(escolherOpcao(c, 'sistemico', 'limeciclina'), 'sistemico', 'aco')
    expect(a.escolha.sistemico).toEqual(['limeciclina', 'aco'])
    // texto na ordem das opções, não dos cliques
    expect(a.textos[2]).toBe('Limeciclina oral, associada ao tratamento tópico. Anticoncepcional combinado.')
    const b = escolherOpcao(escolherOpcao(a, 'sistemico', 'limeciclina'), 'sistemico', 'aco')
    expect(b.escolha.sistemico).toEqual([])
    expect(b.textos[2]).toBe('')
  })
  it('fechar o grupo revela a seção; salvar exige todos os grupos abertos ao menos uma vez', () => {
    let d = revelar(escolherOpcao(c, 'cuidados', 'oleosa'), 0)
    expect(d.revelado).toEqual([true, false, false, false])
    expect(pendenciasConduta(d)).toBe('Falta abrir 3 grupos')
    for (const i of [1, 2, 3]) d = revelar(d, i)
    expect(pendenciasConduta(d)).toBeNull()
  })
  it('atualização com o mesmo diagnóstico: refaz a sugestão; escolhas, seções e texto do médico ficam', () => {
    const d = editarTexto(revelar(escolherOpcao(c, 'cuidados', 'sensivel'), 0), 1, 'Meu texto.')
    const nova = montarConduta([item(ACNE, 'confirmada')], [r('Irregularidade menstrual ou excesso de pelos', 'v')], DIA)!
    const x = atualizarConduta(d, nova)
    expect(x.escolha.cuidados).toEqual(['sensivel'])
    expect(x.revelado[0]).toBe(true)
    expect(x.textos[1]).toBe('Meu texto.')
    expect(x.motivo.exames).toBe('Irregularidade menstrual ou excesso de pelos')
    expect(ids(x, 'encaminhamento')[0]).toBe('gineco')
  })
  it('outro diagnóstico: conduta nova', () => {
    const nova = montarConduta([item(ROSACEA, 'confirmada')], [], DIA)!
    expect(atualizarConduta(c, nova).diagnostico.id).toBe('rosacea')
  })
  it('encaminhamento: mais de um especialista numa frase só; sem "Não encaminhar" (nada marcado = sem encaminhamento)', () => {
    expect(ids(c, 'encaminhamento')).toEqual(['gineco', 'endocrino'])
    const sem = escolherOpcao(c, 'kit', 'kit')
    const d = escolherOpcao(escolherOpcao(sem, 'encaminhamento', 'endocrino'), 'encaminhamento', 'gineco')
    expect(d.escolha.encaminhamento).toEqual(['endocrino', 'gineco'])
    expect(d.textos[3]).toBe('Não manipular lesões inflamatórias. Ajustar frequência conforme tolerabilidade cutânea. Encaminho para ginecologia e endocrinologia.')
    expect(escolherOpcao(escolherOpcao(d, 'encaminhamento', 'endocrino'), 'encaminhamento', 'gineco').textos[3]).toBe('')
  })
  it('kit de rotina: vem marcado em Orientações, o médico pode desmarcar', () => {
    expect(ids(c, 'kit')).toEqual(['kit'])
    expect(escolherOpcao(c, 'kit', 'kit').escolha.kit).toEqual([])
  })
  it('um "Outro" só por grupo (no fim); marcado, o texto escrito entra na conduta', () => {
    for (const l of ['cuidados', 'topico', 'sistemico']) expect(ids(c, l).slice(-1)).toEqual(['outro'])
    // Orientações: nenhuma linha tem "Outro"; uma linha própria no fim
    const ori = c.grupos![3].linhas
    expect(ori.map((l) => l.id)).toEqual(['kit', 'exames', 'retorno', 'encaminhamento', 'orientacoes-outro'])
    expect(ori.filter((l) => l.opcoes.some((o) => o.id === 'outro')).map((l) => l.id)).toEqual(['orientacoes-outro'])
    // vazio não escreve nada
    expect(escolherOpcao(c, 'topico', 'outro').textos[1]).toBe('')
    expect(escreverOutro(escolherOpcao(c, 'topico', 'outro'), 'topico', 'dapsona gel 7,5%').textos[1]).toBe('Dapsona gel 7,5%.')
    expect(escreverOutro(escolherOpcao(c, 'orientacoes-outro', 'outro'), 'orientacoes-outro', 'solicito ferritina').textos[3]).toMatch(/Solicito ferritina\.$/)
    // sistêmico: "Outro" soma com os marcados
    const sis = escreverOutro(escolherOpcao(escolherOpcao(c, 'sistemico', 'limeciclina'), 'sistemico', 'outro'), 'sistemico', 'prednisona')
    expect(sis.textos[2]).toBe('Limeciclina oral, associada ao tratamento tópico. Prednisona.')
  })
  it('data de retorno atravessa o ano', () => {
    expect(dataMais('2026-12-20', 28)).toBe('17/01/2027')
  })
})
