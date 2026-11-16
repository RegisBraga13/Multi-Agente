import { describe, expect, it } from 'vitest'
import { dataPorExtenso, idade, ordenarPorHorario, proximoPaciente, somarDias } from './dia'
import type { Atendimento } from './tipos'

function at(id: string, inicio: string, atendido = false): Atendimento {
  return {
    id, inicio, atendido,
    paciente: { nome: id, nascimento: '1990-01-01' },
    tipo: 'consulta', modalidade: 'presencial', formulario: 'preenchido', temHistorico: false,
  }
}

describe('ordenarPorHorario', () => {
  it('ordena pelo horário sem mexer na lista original', () => {
    const lista = [at('a', '10:30'), at('b', '08:00'), at('c', '09:00')]
    expect(ordenarPorHorario(lista).map((x) => x.inicio)).toEqual(['08:00', '09:00', '10:30'])
    expect(lista.map((x) => x.inicio)).toEqual(['10:30', '08:00', '09:00'])
  })
})

describe('idade', () => {
  it('conta o aniversário no próprio dia', () => {
    expect(idade('1992-11-16', new Date(2026, 10, 16))).toBe(34)
  })
  it('ainda não fez aniversário', () => {
    expect(idade('1992-11-17', new Date(2026, 10, 16))).toBe(33)
  })
})

describe('proximoPaciente', () => {
  const lista = [at('a', '08:00', true), at('b', '08:30'), at('c', '09:00')]
  it('é o primeiro não atendido', () => {
    expect(proximoPaciente(lista, true)).toBe('b')
  })
  it('nenhum quando todos foram atendidos', () => {
    expect(proximoPaciente([at('a', '08:00', true)], true)).toBeNull()
  })
  it('nenhum fora do dia de hoje', () => {
    expect(proximoPaciente(lista, false)).toBeNull()
  })
})

describe('dataPorExtenso', () => {
  it('dia da semana e mês por extenso', () => {
    expect(dataPorExtenso('2026-11-16')).toBe('Segunda, 16 de novembro')
    expect(dataPorExtenso('2026-11-21')).toBe('Sábado, 21 de novembro')
  })
})

describe('somarDias', () => {
  it('vira o mês e volta um dia', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(somarDias('2026-11-16', -1)).toBe('2026-11-15')
  })
})
