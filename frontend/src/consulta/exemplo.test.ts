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

  it('todo paciente de consulta tem os 5 campos do exame e ao menos 3 falas', () => {
    for (const at of todos.filter((x) => x.tipo === 'consulta')) {
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

describe('conteudoDaConsulta: retorno (Evolução)', () => {
  const joao = agendaDoDia('2026-11-18', new Date(2026, 10, 18, 7, 0)).find((x) => x.tipo === 'retorno')!
  const c = conteudoDaConsulta(joao, 'dermatologia')
  it('perguntas do retorno e sem sinais de alerta da primeira consulta', () => {
    expect(c.perguntas.map((p) => p.texto)).toEqual(['Melhorou?', 'Piorou algum ponto?', 'Usa o remédio direitinho?', 'Teve efeito colateral?', 'Surgiu algum sintoma ou sinal novo?'])
    expect(c.alertas).toEqual([])
  })
  it('a conversa é de acompanhamento (não repete a primeira consulta) e o exame compara com a anterior', () => {
    expect(c.falas[0].texto).toMatch(/desde a última consulta/)
    expect(c.exame.map((x) => x.rotulo)).toEqual(['Aspecto atual das lesões', 'Extensão', 'Comparado à consulta anterior'])
    expect(c.complementares.map((x) => x.data)).toEqual(['12/11/2026'])
  })
})

describe('retorno: explorar o que surge (regra 14.3)', () => {
  const joao = agendaDoDia('2026-11-18', new Date(2026, 10, 18, 7, 0)).find((x) => x.tipo === 'retorno')!
  const por = (t: string) => conteudoDaConsulta(joao, 'dermatologia').perguntas.find((p) => p.texto === t)!
  it('efeito colateral e sinal novo abrem perguntas de aprofundamento', () => {
    expect(por('Teve efeito colateral?').aprofundar?.map((p) => p.texto)).toEqual(['Qual foi o efeito?', 'Quando começou?', 'Precisou parar o remédio?', 'Ainda continua?'])
    expect(por('Surgiu algum sintoma ou sinal novo?').aprofundar?.map((p) => p.texto)).toEqual(['O que surgiu?', 'Onde apareceu?', 'Desde quando?', 'Coça?', 'Dói?', 'Sangra?', 'Mudou de cor?', 'Mudou de tamanho?'])
    expect(por('Melhorou?').aprofundar).toBeUndefined()
  })
  it('perguntas que pedem uma resposta escrita são abertas; as outras são Sim/Não', () => {
    const efeito = por('Teve efeito colateral?').aprofundar!
    expect(efeito.map((p) => !!p.aberta)).toEqual([true, true, false, false])
  })
})
