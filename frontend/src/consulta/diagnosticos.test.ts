import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { conteudoDaConsulta } from './exemplo'
import { montarHistoria, type SecaoHistoria } from './historia'
import { EXTRAS, MODELOS } from './diagnosticos-exemplo'
import { adicionarProprio, atualizarComReserva, atualizarDiagnosticos, chamarMais, iniciarDiagnosticos, montarDiagnosticos, pendenciasDiagnosticos, primeirosItens, type Hipotese, type ItemDD } from './diagnosticos'

const agora = new Date(2026, 10, 16, 7, 0)
// os pacientes giram de um dia para o outro: procura o paciente, com ficha pronta, em algum dia de novembro
const agenda = Array.from({ length: 28 }, (_, i) => agendaDoDia(`2026-11-${String(i + 1).padStart(2, '0')}`, agora)).flat()
/** a história como sairia da página 1 salva sem mudanças */
function historiaDe(nome: string): SecaoHistoria[] {
  const at = agenda.find((x) => x.paciente.nome === nome && x.ficha.situacao === 'pronta')!
  // o conteúdo da 1ª consulta (o João aparece na agenda como retorno, que tem conteúdo próprio)
  const c = conteudoDaConsulta({ ...at, tipo: 'consulta' }, 'dermatologia')
  const anamnese = c.falas.map((f) => `${f.quem}: ${f.texto}`).join('\n')
  return montarHistoria(at, agora, anamnese, c.exame.map((x) => ({ rotulo: x.rotulo, valor: x.valor })), c.complementares)
}
const trocar = (h: SecaoHistoria[], rotulo: string, texto: string) => h.map((s) => (s.rotulo === rotulo ? { ...s, texto } : s))

describe('montarDiagnosticos', () => {
  const mariana = historiaDe('Mariana Costa')
  const dd = montarDiagnosticos('dermatologia', 'Mariana Costa', mariana)

  it('3 hipóteses da IA com CID e %, da mais à menos provável (como na landing) + 3 na reserva do "+"', () => {
    const { itens, reserva } = iniciarDiagnosticos(dd.hipoteses)
    expect(itens.map((x) => [x.hip.cid, x.hip.pct])).toEqual([['L70.0', 64], ['L71.9', 21], ['L71.0', 9]])
    expect(reserva.map((h) => [h.cid, h.pct])).toEqual([['E28.2', 4], ['B36.8', 3], ['L70.5', 2]])
  })
  it('todo trecho citado existe de verdade na seção salva da história', () => {
    for (const nome of ['Mariana Costa', 'Carlos Henrique Rocha', 'Antônio Barbosa', 'Luíza Fernandes', 'Juliana Teixeira']) {
      const h = historiaDe(nome)
      const r = montarDiagnosticos('dermatologia', nome, h)
      expect(r.hipoteses.length).toBe(6)
      for (const hip of r.hipoteses) for (const ev of hip.evidencias) {
        expect(h.find((s) => s.rotulo === ev.secao)!.texto).toContain(ev.trecho)
      }
    }
  })
  it('os 13 pacientes de exemplo: com a história completa, todas as pistas aparecem (% = o de base)', () => {
    for (const [nome, m] of Object.entries(MODELOS)) {
      const r = montarDiagnosticos('dermatologia', nome, historiaDe(nome))
      expect([nome, r.hipoteses.map((h) => h.pct)]).toEqual([nome, [...m.hipoteses, ...EXTRAS[nome]].map((x) => x.base).sort((p, q) => q - p)])
      // as extras são sempre menos prováveis que as 3 primeiras
      expect(Math.max(...EXTRAS[nome].map((x) => x.base))).toBeLessThan(Math.min(...m.hipoteses.map((x) => x.base)))
    }
  })
  it('sem a pista na história, a evidência some e o % muda', () => {
    const semComedoes = trocar(mariana, 'Exame físico', 'Morfologia: Pápulas e pústulas. Localização: Região mandibular e malar; dorso.')
    const r = montarDiagnosticos('dermatologia', 'Mariana Costa', semComedoes)
    const acne = r.hipoteses.find((h) => h.cid === 'L70.0')!
    const rosacea = r.hipoteses.find((h) => h.cid === 'L71.9')!
    expect(acne.pct).toBeLessThan(64)
    expect(rosacea.pct).toBeGreaterThan(21)
    expect(acne.evidencias.some((e) => /comed/i.test(e.trecho))).toBe(false)
  })
  it('hipótese sem nenhuma evidência a favor não é sugerida (evidência obrigatória)', () => {
    const vazia = mariana.map((s) => ({ ...s, texto: '' }))
    expect(montarDiagnosticos('dermatologia', 'Mariana Costa', vazia).hipoteses).toEqual([])
  })
  it('outra especialidade ou paciente sem exemplo: nenhuma hipótese', () => {
    expect(montarDiagnosticos('cardiologia', 'Mariana Costa', mariana).hipoteses).toEqual([])
    expect(montarDiagnosticos('dermatologia', 'Fulano', mariana).hipoteses).toEqual([])
  })
})

const hip = (id: string, pct: number, trecho = 'x'): Hipotese => ({ id, nome: id, cid: 'L00', pct, evidencias: [{ lado: 'favor', texto: 't', secao: 'Exame físico', trecho }] })

describe('atualizarDiagnosticos', () => {
  const itens: ItemDD[] = [
    ...primeirosItens([hip('a', 60), hip('b', 30), hip('c', 10), hip('d', 5)]),
    { hip: { id: 'propria-1', nome: 'Meu diagnóstico', cid: '', pct: null, evidencias: [] }, decisao: 'confirmada' as const, propria: true, mudou: false, aviso: null },
  ].map((x) => (x.hip.id === 'b' ? { ...x, decisao: 'confirmada' as const } : x.hip.id === 'd' ? { ...x, decisao: 'descartada' as const } : x))

  const novas = [hip('a', 50, 'y'), hip('b', 20, 'y'), hip('e', 15)] // a e b mudaram; c e d saíram; e é nova
  const r = atualizarDiagnosticos(itens, novas)
  const de = (id: string) => r.find((x) => x.hip.id === id)

  it('hipótese que o médico não decidiu: a IA reescreve ("Atualizado")', () => {
    expect(de('a')).toMatchObject({ mudou: true, decisao: 'pendente', aviso: null })
    expect(de('a')!.hip.pct).toBe(50)
  })
  it('hipótese que o médico decidiu: a decisão fica; a IA sugere rever ao lado', () => {
    expect(de('b')).toMatchObject({ decisao: 'confirmada', mudou: false, aviso: { tipo: 'mudou', antes: 30 } })
  })
  it('a IA não sugere mais: some se ninguém decidiu; fica com aviso se o médico decidiu', () => {
    expect(de('c')).toBeUndefined()
    expect(de('d')).toMatchObject({ decisao: 'descartada', aviso: { tipo: 'saiu' } })
  })
  it('hipótese nova entra; a do médico nunca é tocada', () => {
    expect(de('e')).toMatchObject({ mudou: true, decisao: 'pendente' })
    expect(de('propria-1')).toEqual(itens[4])
  })
  it('decidida e só o embasamento mudou (mesma %): a decisão fica, sem aviso "70% → 70%"', () => {
    const r2 = atualizarDiagnosticos(itens, [hip('b', 30, 'y')])
    expect(r2.find((x) => x.hip.id === 'b')).toMatchObject({ decisao: 'confirmada', mudou: false, aviso: null })
  })
  it('nada mudou: nada é reescrito nem sugerido', () => {
    const iguais = atualizarDiagnosticos(itens, [hip('a', 60), hip('b', 30), hip('c', 10), hip('d', 5)])
    expect(iguais.every((x) => !x.mudou && !x.aviso)).toBe(true)
  })
})

describe('"+": mais uma hipótese da IA, uma por vez (até 3 a mais)', () => {
  const todas = [hip('a', 60), hip('b', 30), hip('c', 10), hip('d', 5), hip('e', 3), hip('f', 2)]
  const propria: ItemDD = { hip: { id: 'propria-1', nome: 'Meu', cid: '', pct: null, evidencias: [] }, decisao: 'confirmada', propria: true, mudou: false, aviso: null }
  it('cada toque traz a próxima, antes das do médico; acabou a reserva, nada muda', () => {
    const ini = iniciarDiagnosticos(todas)
    let d = { ...ini, itens: [...ini.itens, propria] }
    d = chamarMais(d)
    expect(d.itens.map((x) => x.hip.id)).toEqual(['a', 'b', 'c', 'd', 'propria-1'])
    d = chamarMais(chamarMais(d))
    expect(d.itens.filter((x) => !x.propria)).toHaveLength(6)
    expect(chamarMais(d)).toEqual(d)
  })
  it('nunca mais que 3 a mais, mesmo que a IA tenha mais', () => {
    expect(iniciarDiagnosticos([...todas, hip('g', 1)]).reserva.map((h) => h.id)).toEqual(['d', 'e', 'f'])
  })
  it('história nova: as que estavam à mostra seguem; completa até 3; o resto volta para a reserva', () => {
    const d = chamarMais(iniciarDiagnosticos(todas)) // a b c d à mostra
    const r = atualizarComReserva(d.itens, [hip('a', 50), hip('x', 40), hip('d', 8), hip('e', 3), hip('f', 2)]) // b e c saíram, x nova
    expect(r.itens.map((x) => x.hip.id)).toEqual(['a', 'x', 'd'])
    expect(r.reserva.map((h) => h.id)).toEqual(['e', 'f'])
  })
})

describe('pendenciasDiagnosticos', () => {
  const base = primeirosItens([hip('a', 60), hip('b', 30)])
  it('salvar pede ao menos um diagnóstico confirmado', () => {
    expect(pendenciasDiagnosticos(base)).toBe('Confirme ao menos um diagnóstico')
    expect(pendenciasDiagnosticos(base.map((x, i) => (i === 0 ? { ...x, decisao: 'confirmada' } : x)))).toBeNull()
  })
  it('sugestões precisam de decisão', () => {
    const ok = base.map((x, i) => (i === 0 ? { ...x, decisao: 'confirmada' as const } : x))
    expect(pendenciasDiagnosticos(ok.map((x) => ({ ...x, aviso: { tipo: 'saiu' as const } })))).toBe('Falta decidir 2 sugestões')
  })
})

describe('adicionarProprio: o diagnóstico do médico não entra duas vezes', () => {
  const base = primeirosItens([{ id: 'acne', nome: 'Acne vulgar', cid: 'L70.0', pct: 60, evidencias: [] }])
  it('diagnóstico novo entra confirmado', () => {
    const r = adicionarProprio(base, 'Tinha do corpo', 'B35.4', 'propria-1')
    expect(r).toHaveLength(2)
    expect(r[1]).toMatchObject({ propria: true, decisao: 'confirmada', hip: { nome: 'Tinha do corpo', cid: 'B35.4' } })
  })
  it('mesmo CID ou mesmo nome: não duplica; o que já estava fica confirmado', () => {
    expect(adicionarProprio(base, 'Acne', 'l70.0', 'x')).toEqual([{ ...base[0], decisao: 'confirmada', aviso: null }])
    const uma = adicionarProprio(base, 'Tinha do corpo', 'B35.4', 'propria-1')
    expect(adicionarProprio(uma, 'tinha do corpo', '', 'propria-2')).toHaveLength(2)
  })
})
