import { describe, expect, it } from 'vitest'
import { dataPorExtenso, idade, idadeEmTexto, janelaDeHoje, ordenarPorHorario, proximoPaciente, saudacao, somarDias, vistaDoModulo } from './dia'
import type { Atendimento } from './tipos'

function at(id: string, inicio: string, atendido = false): Atendimento {
  return {
    id, inicio, atendido,
    paciente: { id, nome: id, nascimento: '1990-01-01' },
    tipo: 'consulta', modalidade: 'presencial', pagamento: 'Particular', ficha: { situacao: 'sem-ficha' }, temHistorico: false,
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

describe('saudacao', () => {
  it('bom dia, boa tarde, boa noite', () => {
    expect(saudacao(new Date(2026, 10, 16, 5, 0))).toBe('Bom dia')
    expect(saudacao(new Date(2026, 10, 16, 11, 59))).toBe('Bom dia')
    expect(saudacao(new Date(2026, 10, 16, 12, 0))).toBe('Boa tarde')
    expect(saudacao(new Date(2026, 10, 16, 18, 0))).toBe('Boa noite')
    expect(saudacao(new Date(2026, 10, 16, 2, 0))).toBe('Boa noite')
  })
})

describe('janelaDeHoje', () => {
  const lista = [at('a', '08:00', true), at('b', '08:30', true), at('c', '09:00'), at('d', '09:30'), at('e', '10:00'), at('f', '10:30')]
  it('esconde os atendidos e mostra até o máximo a partir do próximo', () => {
    const j = janelaDeHoje(lista, 3)
    expect(j.atendidos).toBe(2)
    expect(j.visiveis.map((x) => x.id)).toEqual(['c', 'd', 'e'])
    expect(j.restantes).toBe(1)
  })
  it('todos atendidos: nada visível', () => {
    const j = janelaDeHoje([at('a', '08:00', true)], 5)
    expect(j).toEqual({ atendidos: 1, visiveis: [], restantes: 0 })
  })
})

describe('vistaDoModulo', () => {
  it('#agenda abre a agenda; o resto, o início', () => {
    expect(vistaDoModulo('#agenda')).toBe('agenda')
    for (const h of ['', '#', '#inicio', '#x']) expect(vistaDoModulo(h)).toBe('inicio')
  })
})

describe('idadeEmTexto (autor, 26/11/2026)', () => {
  it('até 2 anos em meses; no primeiro mês em dias; depois em anos', () => {
    const hoje = new Date(2026, 10, 26)
    expect(idadeEmTexto('2026-11-14', hoje)).toBe('12 dias')
    expect(idadeEmTexto('2026-11-25', hoje)).toBe('1 dia')
    expect(idadeEmTexto('2026-10-26', hoje)).toBe('1 mês')
    expect(idadeEmTexto('2026-03-27', hoje)).toBe('7 meses')
    expect(idadeEmTexto('2024-11-27', hoje)).toBe('23 meses')
    expect(idadeEmTexto('2024-11-26', hoje)).toBe('2 anos')
    expect(idadeEmTexto('1974-01-01', hoje)).toBe('52 anos')
  })
})
