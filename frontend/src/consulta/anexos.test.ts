import { describe, expect, it } from 'vitest'
import { alternarEmitir, atualizarAnexos, avancar, editarAnexo, extenso, montarAnexos, pendenciasAnexos, proximoPasso, type Anexo } from './anexos'
import { escolherOpcao, escreverOutro, montarConduta, revelar, type Conduta } from './conduta'
import type { ItemDD } from './diagnosticos'

const ACNE: ItemDD = { hip: { id: 'acne', nome: 'Acne grau II · papulopustulosa', cid: 'L70.0', pct: 64, evidencias: [] }, decisao: 'confirmada', propria: false, mudou: false, aviso: null }
const DADOS = { paciente: 'Mariana Costa', idade: 34, data: '13/11/2026', hora: '08:00' }
const escolher = (c: Conduta, pares: [string, string][]) => pares.reduce((x, [l, o]) => escolherOpcao(x, l, o), c)
const conduta = () => [0, 1, 2, 3].reduce((x, i) => revelar(x, i), escolher(montarConduta([ACNE], [], '2026-11-13')!, [
  ['cuidados', 'oleosa'], ['topico', 'adapaleno-bpo'], ['sistemico', 'limeciclina'], ['exames', 'hormonal'], ['retorno', '8s'], ['encaminhamento', 'gineco'],
]))
const de = (xs: Anexo[], tipo: Anexo['tipo']) => xs.find((a) => a.tipo === tipo)!

describe('montarAnexos (só da conduta salva)', () => {
  const xs = montarAnexos(conduta(), DADOS)
  it('surgem receita, exames, encaminhamento e orientações (escolhidos); atestado e laudo o médico decide', () => {
    expect(xs.map((a) => [a.tipo, a.emitir])).toEqual([['receita', true], ['exames', true], ['encaminhamento', true], ['orientacoes', true], ['atestado', false], ['laudo', false]])
    expect(xs.every((a) => a.estado === 'rascunho')).toBe(true)
  })
  it('receita: cuidados e tópico em uso tópico, sistêmico em uso oral, numeração seguida', () => {
    const t = de(xs, 'receita').texto
    expect(t).toMatch(/^USO TÓPICO \(EXTERNO\)\n1\. Sabonete facial/)
    expect(t).toContain('\n4. Adapaleno + peróxido de benzoíla 0,1% + 2,5% · gel\n')
    expect(t).toContain('\n\nUSO ORAL\n5. Limeciclina 300 mg · cápsula\n')
  })
  it('cada item tem nome (DCB), forma, concentração, quantidade em algarismos e por extenso, posologia com a via', () => {
    const t = de(xs, 'receita').texto
    expect(t).toContain('5. Limeciclina 300 mg · cápsula\n   Quantidade: 56 (cinquenta e seis) cápsulas\n   Tomar 1 cápsula por via oral, 1 vez ao dia, por 8 semanas.')
    expect(t).toContain('   Quantidade: 1 (uma) bisnaga de 30 g')
    expect(t).toContain('   Quantidade: 1 (um) frasco')
  })
  it('por extenso concorda com a unidade', () => {
    expect([extenso(1), extenso(1, true), extenso(2, true), extenso(21), extenso(56, true), extenso(100), extenso(120), extenso(200, true)])
      .toEqual(['um', 'uma', 'duas', 'vinte e um', 'cinquenta e seis', 'cem', 'cento e vinte', 'duzentas'])
  })
  it('"Outro" escrito no tratamento entra na receita como item livre', () => {
    const c = escreverOutro(escolherOpcao(conduta(), 'sistemico', 'outro'), 'sistemico', 'Prednisona 20 mg, 10 comprimidos, 1 ao dia por 5 dias')
    expect(de(montarAnexos(c, DADOS), 'receita').texto).toContain('6. Prednisona 20 mg, 10 comprimidos, 1 ao dia por 5 dias')
  })
  it('pedido de exames: kit de rotina + exame do caso, com a indicação; encaminhamento com o especialista', () => {
    expect(de(xs, 'exames').texto).toBe('Solicito: hemograma, glicemia de jejum, perfil lipídico, TSH, função renal, função hepática, EAS e perfil hormonal.\nIndicação clínica: Acne grau II · papulopustulosa (CID 10 L70.0).')
    expect(de(xs, 'encaminhamento').texto).toMatch(/^Encaminho para avaliação em ginecologia\./)
  })
  it('sem nada marcado no grupo, o anexo não surge (sem sistêmico → receita só uso externo; sem encaminhamento → não há)', () => {
    const c = escolher(conduta(), [['sistemico', 'limeciclina'], ['encaminhamento', 'gineco'], ['kit', 'kit'], ['exames', 'hormonal']])
    const ys = montarAnexos(c, DADOS)
    expect(ys.map((a) => a.tipo)).toEqual(['receita', 'orientacoes', 'atestado', 'laudo'])
    expect(de(ys, 'receita').texto).not.toContain('USO ORAL')
  })
  it('assinatura (provisória até as regras do CFM): receita, atestado e laudo', () => {
    expect(xs.filter((a) => a.assinatura).map((a) => a.tipo)).toEqual(['receita', 'atestado', 'laudo'])
  })
})

describe('médico revisa, assina e envia (simulação)', () => {
  const xs = montarAnexos(conduta(), DADOS)
  it('receita: revisar → assinar → enviar; pedido de exames: revisar → enviar', () => {
    let ys = xs
    expect(proximoPasso(de(ys, 'receita'))).toBe('revisar')
    ys = avancar(ys, 'receita'); expect(proximoPasso(de(ys, 'receita'))).toBe('assinar')
    ys = avancar(ys, 'receita'); expect(proximoPasso(de(ys, 'receita'))).toBe('enviar')
    ys = avancar(ys, 'receita'); expect(de(ys, 'receita').estado).toBe('enviado')
    ys = avancar(ys, 'exames'); expect(proximoPasso(de(ys, 'exames'))).toBe('enviar')
  })
  it('editar depois de assinado volta a rascunho (a assinatura cai); enviado não se edita nem sai da emissão', () => {
    let ys = avancar(avancar(xs, 'receita'), 'receita')
    ys = editarAnexo(ys, 'receita', 'Outro texto')
    expect(de(ys, 'receita').estado).toBe('rascunho')
    ys = avancar(avancar(avancar(ys, 'receita'), 'receita'), 'receita')
    expect(de(editarAnexo(ys, 'receita', 'x'), 'receita').texto).toBe('Outro texto')
    expect(de(alternarEmitir(ys, 'receita'), 'receita').emitir).toBe(true)
  })
  it('finalizar só com todos os escolhidos enviados; atestado não escolhido não conta', () => {
    expect(pendenciasAnexos(xs)).toBe('Falta enviar 4 anexos')
    let ys = xs
    for (const t of ['receita', 'exames', 'encaminhamento', 'orientacoes'] as const) for (let i = 0; i < 3; i++) ys = avancar(ys, t)
    expect(pendenciasAnexos(ys)).toBeNull()
    expect(pendenciasAnexos(alternarEmitir(ys, 'atestado'))).toBe('Falta enviar 1 anexo')
  })
  it('anexo sem texto não avança', () => {
    const ys = editarAnexo(xs, 'orientacoes', '  ')
    expect(de(avancar(ys, 'orientacoes'), 'orientacoes').estado).toBe('rascunho')
  })
  it('conduta salva de novo: anexo que não mudou fica (com edição e estado); o que mudou é refeito', () => {
    const ys = avancar(editarAnexo(xs, 'exames', 'Meu pedido.'), 'exames')
    const novos = montarAnexos(escolher(conduta(), [['topico', 'azelaico']]), DADOS)
    const zs = atualizarAnexos(ys, novos)
    expect(de(zs, 'exames').texto).toBe('Meu pedido.')
    expect(de(zs, 'exames').estado).toBe('revisado')
    expect(de(zs, 'receita').texto).toContain('Ácido azelaico')
  })
})
