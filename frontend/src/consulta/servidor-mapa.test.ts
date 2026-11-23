import { describe, expect, it } from 'vitest'
import { anamneseDoServidor, anamneseParaServidor, diaDaConsulta, etapasParaOficializar, exameDoServidor, exameParaServidor } from './servidor-mapa'
import type { Pergunta, RespostaPergunta } from './exemplo'
import type { Ficha } from '../modulo/tipos'

const ficha: Extract<Ficha, { situacao: 'pronta' }> = {
  situacao: 'pronta', recebidaAs: '08:00', sexo: 'F', estadoCivil: 'casado', profissao: 'professora',
  queixa: 'Manchas no rosto', emUso: ['Losartana'], antecedentes: ['Hipertensão'],
  alergias: [{ substancia: 'Dipirona', reacao: 'urticária' }], transcricao: 'aceita',
}
const protetor: Pergunta = { texto: 'Usa protetor solar todos os dias?', sim: 'Refere uso diário de protetor solar.', nao: 'Nega uso diário de protetor solar.', secao: 'hda' }
const desde: Pergunta = { texto: 'Desde quando?', sim: 'Há {}.', nao: '', secao: 'hda', aberta: true }
const perguntas: RespostaPergunta[] = [{ pergunta: protetor, resposta: 'sim' }, { pergunta: desde, resposta: 'sim', texto: '2 anos' }]
const sinais = [{ id: 'angioedema', texto: 'Inchaço de lábios/língua ou falta de ar' }, { id: 'virilizacao', texto: 'Voz grossa, pelos' }, { id: 'zoster-oftalmico', texto: 'Bolhas perto do olho' }]

describe('exameParaServidor', () => {
  const valores = [
    { rotulo: 'Morfologia', valor: 'Pápulas' }, { rotulo: 'Localização', valor: 'Face' }, { rotulo: 'Extensão', valor: '' },
    { rotulo: 'Gravidade estimada', valor: 'Leve' }, { rotulo: 'Achados associados', valor: '  ' }, { rotulo: 'Observações', valor: 'Fotos nítidas' },
  ]
  it('os 5 campos viram os 5 do servidor; vazio vira null, nunca ""', () => {
    expect(exameParaServidor(valores)).toEqual({
      exame: { morfologia: 'Pápulas', localizacao: 'Face', extensao: null, gravidade: 'Leve', achados: null },
      complementares: [], observacoes: 'Fotos nítidas',
    })
  })
  it('ida e volta devolve os mesmos valores nos mesmos rótulos', () => {
    expect(exameDoServidor(exameParaServidor(valores))).toEqual(valores.map((v) => ({ ...v, valor: v.valor.trim() })))
  })
  it('rótulo desconhecido não se perde em silêncio: dá erro', () => {
    expect(() => exameParaServidor([{ rotulo: 'Aspecto atual das lesões', valor: 'x' }])).toThrow('Aspecto atual das lesões')
  })
})

describe('anamneseParaServidor', () => {
  const entrada = {
    texto: 'Paciente refere manchas.', falas: [{ quem: 'Médico' as const, texto: 'Bom dia', aos: '00:03' }, { quem: 'Paciente' as const, texto: 'Manchas', aos: '00:06', clinico: 'refere manchas' }],
    ficha, alertas: { angioedema: 'f' as const, virilizacao: 'v' as const, 'zoster-oftalmico': null }, sinais, perguntas, formulario: null,
  }
  it('leva a queixa, remédios, antecedentes e alergias da ficha', () => {
    const b = anamneseParaServidor(entrada)
    expect(b).toMatchObject({ queixa: 'Manchas no rosto', emUso: ['Losartana'], antecedentes: ['Hipertensão'], alergias: [{ substancia: 'Dipirona', reacao: 'urticária' }], texto: 'Paciente refere manchas.' })
    expect(b.falas).toEqual([{ quem: 'Médico', texto: 'Bom dia' }, { quem: 'Paciente', texto: 'Manchas' }])
  })
  it('sinais: só os respondidos (v = sim, f = não); sem resposta fica de fora', () => {
    expect(anamneseParaServidor(entrada).sinais).toEqual([
      { id: 'angioedema', texto: 'Inchaço de lábios/língua ou falta de ar', resposta: 'nao' },
      { id: 'virilizacao', texto: 'Voz grossa, pelos', resposta: 'sim' },
    ])
  })
  it('pergunta aberta leva o detalhe; a de sim/não leva null', () => {
    expect(anamneseParaServidor(entrada).perguntas).toEqual([
      { texto: protetor.texto, resposta: 'sim', detalhe: null }, { texto: desde.texto, resposta: 'sim', detalhe: '2 anos' },
    ])
  })
  it('formulário: respostas e só os ids das perguntas de foto', () => {
    const f = { dados: { nomeCompleto: '', nomeSocial: '', nascimento: '', sexo: '' as const, cidade: '', uf: '', estadoCivil: '' as const, profissao: '', trabalhoExposto: '' as const }, respostas: { desde_quando: '2 anos' }, fotos: { foto_rosto: '/api/x' } }
    expect(anamneseParaServidor({ ...entrada, formulario: f }).formulario).toEqual({ respostas: { desde_quando: '2 anos' }, fotos: ['foto_rosto'] })
  })
  it('ida e volta recupera texto, perguntas e respostas dos sinais; o que não reconhece vem listado', () => {
    const volta = anamneseDoServidor({ ...anamneseParaServidor(entrada), perguntas: [...anamneseParaServidor(entrada).perguntas, { texto: 'Pergunta que sumiu', resposta: 'nao', detalhe: null }] }, [protetor, desde])
    expect(volta.texto).toBe('Paciente refere manchas.')
    expect(volta.perguntas).toEqual(perguntas)
    expect(volta.alertas).toEqual({ angioedema: 'f', virilizacao: 'v' })
    expect(volta.naoReconhecidas).toEqual(['Pergunta que sumiu'])
  })
})

describe('etapasParaOficializar (o servidor só oficializa o exame depois da anamnese)', () => {
  it('anamnese salva, exame ainda não: só a anamnese', () => expect(etapasParaOficializar('anamnese', false)).toEqual(['anamnese']))
  it('anamnese salva com o exame já salvo na tela: anamnese e depois exame', () => expect(etapasParaOficializar('anamnese', true)).toEqual(['anamnese', 'exame']))
  it('exame salvo com a anamnese já salva: só o exame', () => expect(etapasParaOficializar('exame', true)).toEqual(['exame']))
  it('exame salvo antes da anamnese: nenhuma (fica gravado como rascunho no servidor)', () => expect(etapasParaOficializar('exame', false)).toEqual([]))
})

describe('diaDaConsulta (o dia no consultório, em São Paulo)', () => {
  it('10h no consultório (13h UTC) é o mesmo dia', () => expect(diaDaConsulta('2027-08-12T13:00:00Z')).toBe('2027-08-12'))
  it('de madrugada em UTC ainda é o dia anterior no consultório', () => expect(diaDaConsulta('2027-08-12T02:00:00Z')).toBe('2027-08-11'))
  it('aceita o formato com deslocamento que o servidor devolve', () => expect(diaDaConsulta('2027-08-12T10:00:00-03:00')).toBe('2027-08-12'))
})

describe('exame do retorno (a Evolução usa o mesmo bloco de exame do servidor)', () => {
  const linhas = [
    { rotulo: 'Aspecto atual das lesões', valor: 'Máculas residuais' },
    { rotulo: 'Extensão', valor: '1' },
    { rotulo: 'Comparado à consulta anterior', valor: 'Bem menos lesões' },
    { rotulo: 'Observações', valor: 'Sem novas lesões' },
  ]
  it('vai e volta sem perder nada', () => {
    const b = exameParaServidor(linhas, true)
    expect(b.exame).toEqual({ morfologia: 'Máculas residuais', localizacao: null, extensao: '1', gravidade: null, achados: 'Bem menos lesões' })
    expect(b.observacoes).toBe('Sem novas lesões')
    const volta = Object.fromEntries(exameDoServidor(b, true).map((c) => [c.rotulo, c.valor]))
    expect(volta).toMatchObject({ 'Aspecto atual das lesões': 'Máculas residuais', Extensão: '1', 'Comparado à consulta anterior': 'Bem menos lesões', Observações: 'Sem novas lesões' })
  })
  it('na primeira consulta o rótulo do retorno continua desconhecido (nada muda)', () => {
    expect(() => exameParaServidor(linhas)).toThrow(/não conhece/)
  })
})
