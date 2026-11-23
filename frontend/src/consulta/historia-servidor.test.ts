import { describe, expect, it } from 'vitest'
import type { HistoriaServidor, PerguntaServidor, SinalDisparadoServidor, SinalDoCatalogo } from '../servidor/consulta'
import { adicionarPergunta, atualizarSecoes, avisosDeUrgencia, historiaDaEvolucaoParaServidor, historiaParaServidor, juntarPerguntas, perguntaDoCatalogo, responder, secoesDaEvolucaoDoServidor, secoesDoServidor } from './historia-servidor'

const historia = (extra: Partial<HistoriaServidor['historia']> = {}): HistoriaServidor['historia'] => ({
  qp: 'Ferida no nariz.', hda: 'Paciente, 73 anos, refere ferida há 3 meses.', ap: 'Hipertensão.', hp: '', hf: '',
  exameFisico: 'Pápula perolada.', examesTexto: '', ...extra,
})
const urgencia: SinalDisparadoServidor = { id: 'angioedema', texto: 'Inchaço de lábios/língua ou falta de ar', tipo: 'urgencia_imediata', acao: ['Encaminhar'], prazo: 'imediato', origem: 'ia', trecho: 'lábios inchados' }
const base = (sinais: SinalDisparadoServidor[] = []): HistoriaServidor => ({
  historia: historia(), seguranca: { alergias: [], emUso: [], sinais }, conflitos: [], extrasIa: [], perguntas: [],
})
const q = (id: string, texto: string, resposta: PerguntaServidor['resposta'] = null, sinalId: string | null = null): PerguntaServidor =>
  ({ id, texto, seSim: 'Refere.', seNao: 'Nega.', sinalId, resposta })
const catalogo: SinalDoCatalogo[] = [
  { id: 'angioedema', texto: 'Inchaço de lábios/língua ou falta de ar', tipo: 'urgencia_imediata', acao: ['Encaminhar'], prazo: 'imediato' },
  { id: 'lesao-sangra-facil', texto: 'Lesão que sangra ao toque leve', tipo: 'prioridade', acao: ['Biópsia'], prazo: 'semanas' },
]

describe('secoesDoServidor / historiaParaServidor', () => {
  it('sem história pessoal nem familiar: 5 seções, com os rótulos que o resto da tela lê', () => {
    expect(secoesDoServidor(historia()).map((s) => s.rotulo)).toEqual(['Queixa principal', 'História da doença atual', 'Antecedentes e alertas', 'Exame físico', 'Exames complementares'])
  })
  it('com história pessoal preenchida ela entra depois dos antecedentes', () => {
    expect(secoesDoServidor(historia({ hp: 'Cirurgia em 2019.' })).map((s) => s.rotulo)).toEqual(['Queixa principal', 'História da doença atual', 'Antecedentes e alertas', 'História pessoal', 'Exame físico', 'Exames complementares'])
  })
  it('exames vazio continua como seção (o médico pode escrever)', () => {
    expect(secoesDoServidor(historia()).slice(-1)[0]).toEqual({ rotulo: 'Exames complementares', texto: '' })
  })
  it('ida e volta preserva o texto editado e devolve os 7 campos', () => {
    const secoes = secoesDoServidor(historia({ hf: 'Mãe com câncer de pele.' })).map((s) => (s.rotulo === 'Exame físico' ? { ...s, texto: 'Editado pelo médico.' } : s))
    const volta = historiaParaServidor(secoes, base([urgencia]), [])
    expect(volta.historia).toEqual({ ...historia({ hf: 'Mãe com câncer de pele.' }), exameFisico: 'Editado pelo médico.' })
    expect(volta.seguranca.sinais).toEqual([urgencia])
  })
  it('seção apagada pelo médico volta como string vazia', () => {
    const secoes = secoesDoServidor(historia()).filter((s) => s.rotulo !== 'Antecedentes e alertas')
    expect(historiaParaServidor(secoes, base(), []).historia.ap).toBe('')
  })
  it('as perguntas vão junto', () => {
    expect(historiaParaServidor(secoesDoServidor(historia()), base(), [q('p1', 'A?', 'sim')]).perguntas).toEqual([q('p1', 'A?', 'sim')])
  })
})

describe('atualizarSecoes (alinha por rótulo)', () => {
  it('seção que o médico editou e a IA mudou vira sugestão e não sobrescreve', () => {
    const antes = secoesDoServidor(historia())
    const atuais = antes.map((s) => (s.rotulo === 'História da doença atual' ? 'Meu texto.' : s.texto))
    const novas = secoesDoServidor(historia({ hda: 'Texto novo da IA.' }))
    const r = atualizarSecoes(antes, atuais, novas)
    const i = novas.findIndex((s) => s.rotulo === 'História da doença atual')
    expect(r.textos[i]).toBe('Meu texto.')
    expect(r.sugestoes[i]).toBe('Texto novo da IA.')
  })
  it('seção que apareceu agora (história pessoal) entra com o texto novo sem quebrar o resto', () => {
    const antes = secoesDoServidor(historia())
    const novas = secoesDoServidor(historia({ hp: 'Cirurgia em 2019.' }))
    const r = atualizarSecoes(antes, antes.map((s) => s.texto), novas)
    expect(r.textos).toEqual(novas.map((s) => s.texto))
  })
})

describe('perguntas', () => {
  it('juntarPerguntas mantém a resposta da de mesmo texto, zera a nova e reenumera', () => {
    const r = juntarPerguntas([q('p1', 'Sangra?', 'sim'), q('p2', 'Dói?', 'nao')], [q('p1', 'Dói?'), q('p2', 'Coça?'), q('p3', 'Sangra?')])
    expect(r.map((x) => [x.id, x.texto, x.resposta])).toEqual([['p1', 'Dói?', 'nao'], ['p2', 'Coça?', null], ['p3', 'Sangra?', 'sim']])
  })
  it('juntarPerguntas não perde a pergunta que o médico adicionou do catálogo, nem a duplica se a IA a escreveu', () => {
    const doCatalogo = { ...q('c-lesao-sangra-facil', 'Lesão que sangra ao toque leve', 'sim', 'lesao-sangra-facil') }
    expect(juntarPerguntas([doCatalogo], [q('p1', 'Dói?')]).map((x) => [x.id, x.resposta])).toEqual([['p1', null], ['c-lesao-sangra-facil', 'sim']])
    expect(juntarPerguntas([doCatalogo], [q('p1', 'Outro texto?', null, 'lesao-sangra-facil')]).map((x) => x.id)).toEqual(['p1'])
  })
  it('perguntaDoCatalogo escreve as frases com a primeira letra em minúscula', () => {
    expect(perguntaDoCatalogo(catalogo[1])).toEqual({ id: 'c-lesao-sangra-facil', texto: 'Lesão que sangra ao toque leve', seSim: 'Refere: lesão que sangra ao toque leve.', seNao: 'Nega: lesão que sangra ao toque leve.', sinalId: 'lesao-sangra-facil', resposta: null })
  })
  it('adicionarPergunta não duplica o mesmo sinal nem o mesmo texto', () => {
    const c = perguntaDoCatalogo(catalogo[1])
    const uma = adicionarPergunta([], c)
    expect(adicionarPergunta(uma, c)).toHaveLength(1)
    expect(adicionarPergunta([q('p1', 'Lesão que sangra ao toque leve')], c)).toHaveLength(1)
  })
  it('responder marca, troca e desmarca ao clicar de novo', () => {
    const l = [q('p1', 'A?')]
    const sim = responder(l, 'p1', 'sim')
    expect(sim[0].resposta).toBe('sim')
    expect(responder(sim, 'p1', 'nao')[0].resposta).toBe('nao')
    expect(responder(sim, 'p1', 'sim')[0].resposta).toBeNull()
  })
})

describe('avisosDeUrgencia', () => {
  it('mostra a urgência que a história já detectou', () => {
    expect(avisosDeUrgencia(base([urgencia]), [], catalogo)).toEqual([{ id: 'angioedema', texto: urgencia.texto, acao: ['Encaminhar'], prazo: 'imediato' }])
  })
  it('mostra a urgência do catálogo respondida Sim, e não a de prioridade, nem a respondida Não', () => {
    const perguntas = [q('p1', 'A?', 'sim', 'angioedema'), q('p2', 'B?', 'sim', 'lesao-sangra-facil'), q('p3', 'C?', 'nao', 'angioedema')]
    expect(avisosDeUrgencia(base(), perguntas, catalogo).map((a) => a.id)).toEqual(['angioedema'])
    expect(avisosDeUrgencia(base(), [q('p3', 'C?', 'nao', 'angioedema')], catalogo)).toEqual([])
  })
  it('não duplica quando a história já tinha o mesmo sinal', () => {
    expect(avisosDeUrgencia(base([urgencia]), [q('p1', 'A?', 'sim', 'angioedema')], catalogo)).toHaveLength(1)
  })
})

describe('História da evolução (retorno): as 3 seções da tela guardadas nos campos do servidor', () => {
  const secoes = [{ rotulo: 'Evolução', texto: 'Paciente relata melhora.' }, { rotulo: 'Exame', texto: 'Máculas residuais.' }, { rotulo: 'Exames', texto: 'Nenhum exame novo.' }]
  const base: HistoriaServidor = { historia: { qp: '', hda: '', ap: '', hp: '', hf: '', exameFisico: '', examesTexto: '' }, seguranca: { alergias: [], emUso: [], sinais: [] }, conflitos: [], extrasIa: [], perguntas: [] }
  it('Evolução → hda, Exame → exame físico, Exames → exames; o resto fica vazio', () => {
    expect(historiaDaEvolucaoParaServidor(secoes, base).historia).toEqual({ qp: '', hda: 'Paciente relata melhora.', ap: '', hp: '', hf: '', exameFisico: 'Máculas residuais.', examesTexto: 'Nenhum exame novo.' })
  })
  it('volta como as mesmas 3 seções, sempre presentes (mesmo vazias)', () => {
    const h = historiaDaEvolucaoParaServidor(secoes, base).historia
    expect(secoesDaEvolucaoDoServidor(h)).toEqual(secoes)
    expect(secoesDaEvolucaoDoServidor({ ...h, hda: '' }).map((s) => s.rotulo)).toEqual(['Evolução', 'Exame', 'Exames'])
  })
})
