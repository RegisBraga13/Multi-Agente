import { describe, expect, it } from 'vitest'
import type { DiagnosticosServidor, ItemDDServidor } from '../servidor/consulta'
import { atualizarComReserva } from './diagnosticos'
import { diagnosticosParaServidor, hipotesesDoServidor, idDaHipotese, itensDoServidor } from './diagnosticos-servidor'

const item = (nome: string, cid: string, pct: number | null, extra: Partial<ItemDDServidor> = {}): ItemDDServidor => ({
  hipotese: { nome, cid, certeza: 'hipotese', pct, evidencias: pct === null ? [] : [{ lado: 'favor', texto: 'placas', secao: 'exameFisico', trecho: 'Placas eritematosas.' }] },
  decisao: 'pendente', propria: false, ...extra,
})
const bloco = (itens: ItemDDServidor[]): DiagnosticosServidor => ({ itens, naoPodePerder: { nome: 'Linfoma', cid: 'C84.0', porque: 'x', como: 'y' }, rastrear: ['HIV'] })
const psoriase = item('Psoríase vulgar', 'L40.0', 70)
const seb = item('Dermatite seborreica', 'L21.9', 15)
const meu = item('Meu diagnóstico', '', null, { decisao: 'confirmada', propria: true, hipotese: { nome: 'Meu diagnóstico', cid: '', certeza: 'clinico', pct: null, evidencias: [] } })

describe('idDaHipotese', () => {
  it('é o mesmo para a mesma hipótese em duas gerações e muda com o CID', () => {
    expect(idDaHipotese({ nome: 'Psoríase vulgar', cid: 'L40.0' })).toBe(idDaHipotese({ nome: 'Psoríase vulgar', cid: 'L40.0' }))
    expect(idDaHipotese({ nome: 'Psoríase vulgar', cid: 'L40.0' })).not.toBe(idDaHipotese({ nome: 'Psoríase vulgar', cid: 'L40.1' }))
  })
  it('ignora acento e maiúscula do nome', () => {
    expect(idDaHipotese({ nome: 'Psoríase Vulgar', cid: 'L40.0' })).toBe(idDaHipotese({ nome: 'psoriase vulgar', cid: 'L40.0' }))
  })
})

describe('hipotesesDoServidor', () => {
  it('troca a chave da seção pelo rótulo da tela e ignora o diagnóstico do médico', () => {
    const hs = hipotesesDoServidor(bloco([psoriase, meu]))
    expect(hs).toHaveLength(1)
    expect(hs[0]).toMatchObject({ nome: 'Psoríase vulgar', cid: 'L40.0', pct: 70, id: idDaHipotese({ nome: 'Psoríase vulgar', cid: 'L40.0' }) })
    expect(hs[0].evidencias[0]).toEqual({ lado: 'favor', texto: 'placas', secao: 'Exame físico', trecho: 'Placas eritematosas.' })
  })
  it('seção desconhecida na evidência fica como veio, sem quebrar', () => {
    const estranho = item('X', 'L00', 50)
    estranho.hipotese.evidencias[0].secao = 'outraSecao'
    expect(hipotesesDoServidor(bloco([estranho]))[0].evidencias[0].secao).toBe('outraSecao')
  })
})

describe('itensDoServidor / diagnosticosParaServidor', () => {
  it('ida e volta devolve o mesmo bloco, com naoPodePerder e rastrear', () => {
    const b = bloco([{ ...psoriase, decisao: 'confirmada' }, { ...seb, decisao: 'descartada' }, meu])
    expect(diagnosticosParaServidor(itensDoServidor(b), b)).toEqual(b)
  })
  it('o diagnóstico do médico volta como próprio, sem percentual, e vai com certeza clínica e sem evidências', () => {
    const b = bloco([meu])
    const [i] = itensDoServidor(b)
    expect(i).toMatchObject({ propria: true, decisao: 'confirmada', mudou: false, aviso: null })
    expect(i.hip.pct).toBeNull()
    const volta = diagnosticosParaServidor(itensDoServidor(b), b).itens[0]
    expect(volta.hipotese).toEqual({ nome: 'Meu diagnóstico', cid: '', certeza: 'clinico', pct: null, evidencias: [] })
  })
  it('sem bloco base, naoPodePerder é null e rastrear é vazio', () => {
    expect(diagnosticosParaServidor(itensDoServidor(bloco([psoriase])), null)).toMatchObject({ naoPodePerder: null, rastrear: [] })
  })
})

describe('regerar com o id estável', () => {
  it('mantém a decisão do médico e avisa quando o percentual mudou', () => {
    const antes = itensDoServidor(bloco([{ ...psoriase, decisao: 'confirmada' }, seb]))
    const novo = bloco([item('Psoríase vulgar', 'L40.0', 55), seb])
    const { itens } = atualizarComReserva(antes, hipotesesDoServidor(novo))
    const p = itens.find((x) => x.hip.nome === 'Psoríase vulgar')!
    expect(p.decisao).toBe('confirmada')
    expect(p.aviso).toEqual({ tipo: 'mudou', antes: 70 })
  })
})
