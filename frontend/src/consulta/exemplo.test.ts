import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { buscarAtendimento, conteudoDaConsulta } from './exemplo'

const agora = new Date(2026, 10, 16, 7, 0)

describe('buscarAtendimento', () => {
  it('acha o paciente pelo id da agenda', () => {
    expect(buscarAtendimento('2026-11-16-08:00', agora)?.inicio).toBe('08:00')
  })
  it('id inexistente devolve undefined', () => {
    expect(buscarAtendimento('xyz', agora)).toBeUndefined()
    expect(buscarAtendimento('2026-11-16-07:15', agora)).toBeUndefined()
    expect(buscarAtendimento('2026-11-22-08:00', agora)).toBeUndefined() // domingo
  })
})

describe('conteudoDaConsulta', () => {
  // vários dias para passar por todos os pacientes de exemplo
  const todos = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].flatMap((d) => agendaDoDia(d, agora))

  it('todo paciente tem os 5 campos do exame e ao menos 3 falas', () => {
    for (const at of todos) {
      const c = conteudoDaConsulta(at, 'dermatologia')
      expect(c.exame.map((x) => x.rotulo)).toEqual(['Morfologia', 'Localização', 'Extensão', 'Gravidade estimada', 'Achados associados'])
      expect(c.falas.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('o rascunho do exame é sugestão da IA, não registro', () => {
    for (const at of todos) for (const x of conteudoDaConsulta(at, 'dermatologia').exame) expect(x.prov).toBe('inferido_ia')
  })

  it('alergia da ficha vira sinal de alerta', () => {
    const at = todos.find((x) => x.ficha.situacao === 'pronta' && x.ficha.alergias.length > 0)!
    const c = conteudoDaConsulta(at, 'dermatologia')
    expect(c.alertas.some((a) => a.tipo === 'alergia' && a.texto.includes('Alergia'))).toBe(true)
    expect(c.alertas.filter((a) => a.tipo === 'sinal').every((a) => !a.texto.includes('Alergia'))).toBe(true)
  })

  it('exame complementar: MISSING sem valor, INFERRED com aviso', () => {
    const itens = todos.flatMap((at) => conteudoDaConsulta(at, 'dermatologia').complementares.flatMap((c) => c.itens))
    const faltando = itens.filter((i) => i.v.status === 'MISSING')
    const inferidos = itens.filter((i) => i.v.status === 'INFERRED')
    expect(faltando.length).toBeGreaterThan(0)
    expect(inferidos.length).toBeGreaterThan(0)
    for (const i of faltando) expect(i.v.valor).toBeNull()
    for (const i of inferidos) expect(i.v.status === 'INFERRED' && i.v.aviso.length > 0).toBe(true)
  })

  it('ids dos sinais de alerta são únicos', () => {
    for (const at of todos) {
      const ids = conteudoDaConsulta(at, 'dermatologia').alertas.map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
