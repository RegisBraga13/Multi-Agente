import { describe, expect, it } from 'vitest'
import { agendaDoDia } from './exemplo'

const AGORA = new Date(2026, 10, 16, 10, 0) // segunda 16/11, 10h

describe('agendaDoDia', () => {
  it('domingo sem pacientes', () => {
    expect(agendaDoDia('2026-11-22', AGORA)).toEqual([])
  })

  it('segunda: 9 pacientes em ordem, atendidos até a hora atual', () => {
    const dia = agendaDoDia('2026-11-16', AGORA)
    expect(dia).toHaveLength(9)
    const horas = dia.map((x) => x.inicio)
    expect(horas).toEqual([...horas].sort())
    // a Mariana (demonstração) fica sempre disponível até o prontuário dela ser salvo
    for (const x of dia) expect(x.atendido).toBe(x.inicio < '10:00' && x.paciente.nome !== 'Mariana Costa')
    expect(dia.some((x) => x.tipo === 'retorno')).toBe(true)
    expect(dia.some((x) => x.modalidade === 'online')).toBe(true)
    expect(dia.some((x) => x.ficha.situacao === 'link-enviado')).toBe(true)
    expect(dia.some((x) => x.ficha.situacao === 'sem-ficha')).toBe(true)
    expect(dia.some((x) => x.pagamento === 'Particular')).toBe(true)
    expect(dia.some((x) => x.pagamento !== 'Particular')).toBe(true)
    for (const x of dia) if (x.ficha.situacao === 'pronta') expect(x.ficha.queixa.length).toBeGreaterThan(0)
    expect(dia.some((x) => x.ficha.situacao === 'pronta' && x.ficha.alergias.length > 0)).toBe(true)
    expect(dia.filter((x) => x.tipo === 'retorno').every((x) => x.temHistorico)).toBe(true)
  })

  it('dia passado todo atendido; dia futuro nada atendido', () => {
    expect(agendaDoDia('2026-11-13', AGORA).every((x) => x.atendido)).toBe(true)
    expect(agendaDoDia('2026-11-17', AGORA).some((x) => x.atendido)).toBe(false)
  })

  it('sábado só de manhã', () => {
    const sab = agendaDoDia('2026-11-21', AGORA)
    expect(sab.length).toBeGreaterThan(0)
    expect(sab.every((x) => x.inicio < '12:00')).toBe(true)
  })

  it('mesma data, mesma lista', () => {
    expect(agendaDoDia('2026-11-18', AGORA)).toEqual(agendaDoDia('2026-11-18', AGORA))
  })
})

describe('exemplos fixos: retorno e prontuário pronto', () => {
  const dia = agendaDoDia('2026-11-18', AGORA)
  it('o único retorno é João Pedro Lima (10h), com a Consulta 1 no prontuário', () => {
    const retornos = dia.filter((x) => x.tipo === 'retorno')
    expect(retornos.map((x) => [x.inicio, x.paciente.nome, x.temHistorico])).toEqual([['10:00', 'João Pedro Lima', true]])
  })
  it('Antônio Barbosa (8h) tem o prontuário da consulta pronto; os outros não mostram prontuário vazio', () => {
    const antonio = dia.find((x) => x.inicio === '08:00')!
    expect([antonio.paciente.nome, antonio.tipo, antonio.temHistorico]).toEqual(['Antônio Barbosa', 'consulta', true])
    expect(dia.filter((x) => x.temHistorico).map((x) => x.paciente.nome).sort()).toEqual(['Antônio Barbosa', 'João Pedro Lima'])
  })
  it('os fixos aparecem em qualquer dia útil e ninguém repete no mesmo dia', () => {
    for (const d of ['2026-11-16', '2026-11-19', '2026-12-02']) {
      const lista = agendaDoDia(d, AGORA)
      expect(lista.find((x) => x.inicio === '10:00')?.paciente.nome).toBe('João Pedro Lima')
      expect(new Set(lista.map((x) => x.paciente.id)).size).toBe(lista.length)
    }
  })
})

describe('retorno de exemplo sempre à vista', () => {
  it('hoje, o retorno do João continua a seguir mesmo depois das 10h (para a simulação)', () => {
    const tarde = agendaDoDia('2026-11-18', new Date(2026, 10, 18, 17, 30))
    expect(tarde.find((x) => x.tipo === 'retorno')?.atendido).toBe(false)
    expect(tarde.find((x) => x.inicio === '08:00')?.atendido).toBe(true)
  })
  it('em dia passado, ele já foi atendido', () => {
    expect(agendaDoDia('2026-11-17', new Date(2026, 10, 18, 17, 30)).find((x) => x.tipo === 'retorno')?.atendido).toBe(true)
  })
})
