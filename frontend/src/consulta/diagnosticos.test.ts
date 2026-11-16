import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { conteudoDaConsulta } from './exemplo'
import { montarHistoria, type SecaoHistoria } from './historia'
import { MODELOS } from './diagnosticos-exemplo'
import { atualizarDiagnosticos, montarDiagnosticos, pendenciasDiagnosticos, primeirosItens, type Hipotese, type ItemDD } from './diagnosticos'

const agora = new Date(2026, 10, 16, 7, 0)
// os pacientes giram de um dia para o outro: procura o paciente, com ficha pronta, em algum dia de novembro
const agenda = Array.from({ length: 28 }, (_, i) => agendaDoDia(`2026-11-${String(i + 1).padStart(2, '0')}`, agora)).flat()
/** a história como sairia da página 1 salva sem mudanças */
function historiaDe(nome: string): SecaoHistoria[] {
  const at = agenda.find((x) => x.paciente.nome === nome && x.ficha.situacao === 'pronta')!
  const c = conteudoDaConsulta(at, 'dermatologia')
  const anamnese = c.falas.map((f) => `${f.quem}: ${f.texto}`).join('\n')
  return montarHistoria(at, agora, anamnese, c.exame.map((x) => ({ rotulo: x.rotulo, valor: x.valor })), c.complementares)
}
const trocar = (h: SecaoHistoria[], rotulo: string, texto: string) => h.map((s) => (s.rotulo === rotulo ? { ...s, texto } : s))

describe('montarDiagnosticos', () => {
  const mariana = historiaDe('Mariana Costa')
  const dd = montarDiagnosticos('dermatologia', 'Mariana Costa', mariana)

  it('3 hipóteses da IA com CID e %, da mais à menos provável (como na landing)', () => {
    expect(dd.hipoteses.map((h) => [h.cid, h.pct])).toEqual([['L70.0', 64], ['L71.9', 21], ['L71.0', 9]])
  })
  it('todo trecho citado existe de verdade na seção salva da história', () => {
    for (const nome of ['Mariana Costa', 'Carlos Henrique Rocha', 'Antônio Barbosa', 'Luíza Fernandes', 'Juliana Teixeira']) {
      const h = historiaDe(nome)
      const r = montarDiagnosticos('dermatologia', nome, h)
      expect(r.hipoteses.length).toBe(3)
      for (const hip of r.hipoteses) for (const ev of hip.evidencias) {
        expect(h.find((s) => s.rotulo === ev.secao)!.texto).toContain(ev.trecho)
      }
    }
  })
  it('os 13 pacientes de exemplo: com a história completa, todas as pistas aparecem (% = o de base)', () => {
    for (const [nome, m] of Object.entries(MODELOS)) {
      const r = montarDiagnosticos('dermatologia', nome, historiaDe(nome))
      expect([nome, r.hipoteses.map((h) => h.pct)]).toEqual([nome, m.hipoteses.map((x) => x.base).sort((p, q) => q - p)])
    }
  })
  it('"não pode perder" só quando há um (melanoma no Carlos; nada inventado na acne)', () => {
    expect(dd.naoPerder).toBeNull()
    expect(montarDiagnosticos('dermatologia', 'Carlos Henrique Rocha', historiaDe('Carlos Henrique Rocha')).naoPerder?.cid).toBe('C43.5')
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
  it('nada mudou: nada é reescrito nem sugerido', () => {
    const iguais = atualizarDiagnosticos(itens, [hip('a', 60), hip('b', 30), hip('c', 10), hip('d', 5)])
    expect(iguais.every((x) => !x.mudou && !x.aviso)).toBe(true)
  })
})

describe('pendenciasDiagnosticos', () => {
  const base = primeirosItens([hip('a', 60), hip('b', 30)])
  it('salvar pede ao menos um diagnóstico confirmado', () => {
    expect(pendenciasDiagnosticos(base, true)).toBe('Confirme ao menos um diagnóstico')
    expect(pendenciasDiagnosticos(base.map((x, i) => (i === 0 ? { ...x, decisao: 'confirmada' } : x)), true)).toBeNull()
  })
  it('"não pode perder" precisa ser avaliado; sugestões precisam de decisão', () => {
    const ok = base.map((x, i) => (i === 0 ? { ...x, decisao: 'confirmada' as const } : x))
    expect(pendenciasDiagnosticos(ok, false)).toBe('Avalie o "não pode perder"')
    expect(pendenciasDiagnosticos(ok.map((x) => ({ ...x, aviso: { tipo: 'saiu' as const } })), true)).toBe('Falta decidir 2 sugestões')
  })
})
