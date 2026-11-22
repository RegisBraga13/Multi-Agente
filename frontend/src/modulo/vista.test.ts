import { describe, expect, it } from 'vitest'
import { retornoParaAbrir, vistaDoDia } from './vista'

describe('vistaDoDia', () => {
  it('o próximo avança com o relógio', () => {
    expect(vistaDoDia('2026-11-16', new Date(2026, 10, 16, 8, 10)).proximo).toBe('2026-11-16-08:30')
    expect(vistaDoDia('2026-11-16', new Date(2026, 10, 16, 14, 10)).proximo).toBe('2026-11-16-15:00')
  })

  it('depois da meia-noite o dia anterior fica todo atendido e sem próximo', () => {
    const v = vistaDoDia('2026-11-16', new Date(2026, 10, 17, 0, 5))
    expect(v.ehHoje).toBe(false)
    expect(v.proximo).toBeNull()
    expect(v.atendidos).toBe(v.lista.length)
  })

  it('conta as fichas só de quem ainda vai ser atendido (muda a cada atendimento)', () => {
    const cedo = vistaDoDia('2026-11-16', new Date(2026, 10, 16, 7, 0))
    expect(cedo.fichasProntas + cedo.semFicha).toBe(cedo.lista.length)
    const tarde = vistaDoDia('2026-11-16', new Date(2026, 10, 16, 14, 30))
    const aSeguir = tarde.lista.filter((x) => !x.atendido)
    expect(tarde.fichasProntas).toBe(aSeguir.filter((x) => x.ficha.situacao === 'pronta').length)
    expect(tarde.fichasProntas + tarde.semFicha).toBe(aSeguir.length)
    expect(tarde.fichasProntas).toBeLessThan(cedo.fichasProntas)
  })

  it('domingo vazio', () => {
    const v = vistaDoDia('2026-11-22', new Date(2026, 10, 22, 9, 0))
    expect(v.lista).toEqual([])
    expect(v.proximo).toBeNull()
  })
})

describe('retornoParaAbrir (cartão Retorno da página inicial)', () => {
  const v = vistaDoDia('2026-11-18', new Date(2026, 10, 18, 7, 0))
  const joao = v.lista.find((x) => x.tipo === 'retorno')!
  const outro = v.lista.find((x) => x.tipo === 'consulta')!
  it('com um retorno aberto na ficha, abre o dele', () => {
    expect(retornoParaAbrir(v.lista, joao.id)).toBe(joao.id)
  })
  it('sem nenhum aberto, ou com uma consulta aberta, abre o próximo retorno de hoje', () => {
    expect(retornoParaAbrir(v.lista, null)).toBe(joao.id)
    expect(retornoParaAbrir(v.lista, outro.id)).toBe(joao.id)
  })
  it('depois do horário do retorno, abre o do dia mesmo assim; dia sem retorno, nada', () => {
    const depois = vistaDoDia('2026-11-18', new Date(2026, 10, 18, 12, 0))
    expect(retornoParaAbrir(depois.lista, null)).toBe(joao.id)
    expect(retornoParaAbrir(depois.lista.filter((x) => x.tipo !== 'retorno'), null)).toBeNull()
  })
})

describe('vistaDoDia com retornos marcados', () => {
  it('o cartão Retorno entra na lista do dia', () => {
    const r = { id: 'r1', pacienteId: 'p', pacienteNome: 'João Lima', consultaOrigemId: 'c', data: '2026-11-17', inicio: '15:00', modalidade: 'presencial' as const }
    const v = vistaDoDia('2026-11-17', new Date(2026, 10, 16, 8, 10), [], [r])
    expect(v.lista.some((x) => x.id === 'retorno-r1')).toBe(true)
  })
})
