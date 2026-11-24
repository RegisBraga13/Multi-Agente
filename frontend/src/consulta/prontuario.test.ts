import { describe, expect, it } from 'vitest'
import { escolherOpcao, montarConduta, revelar, type Conduta } from './conduta'
import type { ItemDD } from './diagnosticos'
import { definirCampos, montarAnexos } from './anexos'
import { CONDUTAS } from './conduta-exemplo'
import type { DadosEntrada } from '../prontuario/registro'
import { aplicarEdicoes, atualizarProntuario, chave, dadosDaConsulta, edicoesDoMedico, diagnosticosDoProntuario, montarProntuario, secoesDaEntrada, secoesDosDados } from './prontuario'

const item = (id: string, nome: string, cid: string, decisao: ItemDD['decisao']): ItemDD => ({ hip: { id, nome, cid, pct: 50, evidencias: [] }, decisao, propria: false, mudou: false, aviso: null })
const ITENS = [item('acne', 'Acne grau II · papulopustulosa', 'L70.0', 'confirmada'), item('rosacea', 'Rosácea', 'L71', 'descartada')]
const HISTORIA = [
  { rotulo: 'Identificação', texto: 'Mariana Costa, 34 anos' },
  { rotulo: 'Queixa principal', texto: 'Espinhas no rosto.' },
  { rotulo: 'História da doença atual', texto: 'Paciente de 34 anos refere espinhas há 6 meses.' },
  { rotulo: 'Antecedentes e alertas', texto: 'Nega alergias.' },
  { rotulo: 'Exame físico', texto: 'Pápulas e pústulas em face.' },
  { rotulo: 'Exames complementares', texto: 'Nenhum exame trazido.' },
]
const conduta = (): Conduta => [0, 1, 2, 3].reduce((x, i) => revelar(x, i), [['cuidados', 'oleosa'], ['topico', 'adapaleno-bpo'], ['exames', 'hormonal'], ['retorno', '8s'], ['encaminhamento', 'gineco']]
  .reduce((x, [l, o]) => escolherOpcao(x, l, o), montarConduta([ITENS[0]], [], '2026-11-13')!))
const linhas = (xs: ReturnType<typeof montarProntuario>) => Object.fromEntries(xs.flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto])))

describe('montarProntuario (QP, HDA, AP, Ex. físico, HD e Conduta; só o que foi colhido)', () => {
  const p = montarProntuario(HISTORIA, ITENS, conduta())
  const t = linhas(p)
  it('S e O vêm da história salva; campo não colhido some (exames avaliados, sinais vitais)', () => {
    expect(t['S.qp']).toBe('Espinhas no rosto.')
    expect(t['S.hda']).toMatch(/^Paciente de 34 anos refere/)
    expect(t['S.ap']).toBe('Nega alergias.')
    expect(t['O.exame']).toBe('Pápulas e pústulas em face.')
    expect('O.exames' in t).toBe(false)
  })
  it('HD: o assinalado pelo médico, com CID e probabilidade; descartado não entra (só 1 sugerível aqui)', () => {
    expect(t['A.hd']).toBe('Acne grau II · papulopustulosa (CID-10 L70.0) — 50% · Assinalado')
  })
  it('conduta: o tratamento sem rótulo; solicitado (kit = "exames de rotina", sem descrever), encaminhado, orientações, retorno', () => {
    expect(p.find((s) => s.id === 'P')!.titulo).toBe('Conduta')
    expect(p.filter((s) => s.titulo).length).toBe(1)
    expect(t['P.conduta']).toContain('Adapaleno')
    expect(p.find((s) => s.id === 'P')!.linhas[0].rotulo).toBe('')
    expect(t['P.solicitado']).toBe('exames de rotina, perfil hormonal.')
    expect(t['P.encaminhado']).toBe('ginecologia.')
    expect(t['P.orientacoes']).toBe('Não manipular lesões inflamatórias. Ajustar frequência conforme tolerabilidade cutânea.')
    expect(t['P.avaliacao']).toBe('em 8 semanas, em 08/01/2027.')
  })
  it('HP e HF só quando houver na história', () => {
    expect('S.hp' in t || 'S.hf' in t).toBe(false)
    const com = linhas(montarProntuario([...HISTORIA, { rotulo: 'História familiar', texto: 'Mãe com acne na adolescência.' }], ITENS, conduta()))
    expect(com['S.hf']).toBe('Mãe com acne na adolescência.')
  })
  it('seção sem nenhum dado colhido não aparece', () => {
    const vazia = montarProntuario(HISTORIA.map((s) => (s.rotulo === 'Exame físico' ? { ...s, texto: 'Não registrado.' } : s)), ITENS, conduta())
    expect(vazia.map((s) => s.id)).toEqual(['S', 'A', 'P'])
  })
})

describe('retorno marcado no prontuário (a Conduta só recomenda "Avaliação")', () => {
  const fontes = { historia: HISTORIA, itens: ITENS, conduta: conduta() }
  const linhaRetorno = (retornoMarcado?: { data: string; inicio: string; modalidade: 'presencial' | 'online' } | null) =>
    secoesDosDados(dadosDaConsulta({ ...fontes, retornoMarcado })).find((s) => s.id === 'P')!.linhas.slice(-1)[0]
  it('termina com "Sem retorno" quando não há retorno marcado', () => {
    expect(linhaRetorno(null)).toEqual({ id: 'retorno', rotulo: '', texto: 'Sem retorno' })
    expect(linhaRetorno(undefined).texto).toBe('Sem retorno')
  })
  it('termina com o dia, a hora e a modalidade do retorno marcado', () => {
    expect(linhaRetorno({ data: '2026-12-05', inicio: '14:00', modalidade: 'presencial' })).toEqual({ id: 'retorno', rotulo: 'Retorno', texto: '05/12/2026 às 14:00, presencial' })
  })
  it('a avaliação em semanas é outra linha, antes do retorno', () => {
    const ids = secoesDosDados(dadosDaConsulta({ ...fontes })).find((s) => s.id === 'P')!.linhas.map((l) => l.id)
    expect(ids.slice(-2)).toEqual(['avaliacao', 'retorno'])
  })
})

describe('atualizarProntuario', () => {
  it('linha cuja origem não mudou mantém a edição do médico; a que mudou é reescrita', () => {
    const antes = montarProntuario(HISTORIA, ITENS, conduta())
    const textos = { ...linhas(antes), 'S.qp': 'Editado pelo médico.' }
    const novas = montarProntuario(HISTORIA, ITENS, escolherOpcao(conduta(), 'retorno', '4s'))
    const r = atualizarProntuario(antes, textos, novas)
    expect(r.textos['S.qp']).toBe('Editado pelo médico.')
    expect(r.mudou['S.qp']).toBe(false)
    expect(r.textos['P.avaliacao']).toMatch(/^em 4 semanas/)
    expect(r.mudou['P.avaliacao']).toBe(true)
  })
})

describe('tratamento no prontuário (detalhado: o retorno pode usar só o prontuário)', () => {
  const DADOS = { paciente: 'Mariana Costa', idade: 34, data: '13/11/2026', hora: '08:00' }
  it('é a receita enviada, como está (com a edição do médico); sem receita, o texto da conduta', () => {
    const c = escolherOpcao(conduta(), 'sistemico', 'limeciclina')
    const anexos = montarAnexos(c, DADOS)
    const receita = anexos.find((a) => a.tipo === 'receita')!.texto
    expect(linhas(montarProntuario(HISTORIA, ITENS, c, anexos))['P.conduta']).toBe(receita)
    const editada = anexos.map((a) => (a.tipo === 'receita' ? { ...a, texto: 'Receita editada.' } : a))
    expect(linhas(montarProntuario(HISTORIA, ITENS, c, editada))['P.conduta']).toBe('Receita editada.')
    expect(linhas(montarProntuario(HISTORIA, ITENS, c))['P.conduta']).toContain('Limeciclina oral, associada ao tratamento tópico — 8sem.')
  })
  it('todo item da receita de exemplo tem o tempo de tratamento', () => {
    const itens = Object.values(CONDUTAS).flatMap((m) => m.grupos.flatMap((g) => g.linhas.flatMap((l) => l.opcoes.flatMap((o) => o.receita ?? []))))
    expect(itens.length).toBeGreaterThan(0)
    for (const x of itens) expect(x.duracao).toMatch(/^(\d+sem|\d+ dias|uso contínuo)$/)
  })
})

describe('prontuário gravado como dados organizados', () => {
  const DADOS = { paciente: 'Mariana Costa', idade: 34, data: '13/11/2026', hora: '08:00' }
  const c = escolherOpcao(conduta(), 'sistemico', 'limeciclina')
  it('diagnósticos: sempre 3 — assinalados (com mais de 3, os de maior %) e, para completar, os sugeridos pela IA; descartado não entra', () => {
    const pct = (id: string, p: number | null, d: ItemDD['decisao'] = 'confirmada'): ItemDD => ({ ...item(id, id, 'X', d), hip: { id, nome: id, cid: 'X', pct: p, evidencias: [] } })
    const resumo = (xs: ItemDD[]) => diagnosticosDoProntuario(xs).map((x) => `${x.nome}:${x.situacao}`)
    expect(resumo([pct('a', 20), pct('b', 70), pct('c', null), pct('d', 40), pct('e', 90, 'descartada'), pct('f', 95, 'pendente')])).toEqual(['b:assinalado', 'd:assinalado', 'a:assinalado'])
    expect(resumo([pct('a', 20), pct('e', 90, 'descartada'), pct('f', 60, 'pendente'), pct('g', 15, 'pendente'), pct('h', 30, 'pendente')]))
      .toEqual(['a:assinalado', 'f:sugerido', 'h:sugerido'])
    expect(resumo([pct('a', 20), pct('b', 50), pct('f', 60, 'pendente'), pct('g', 15, 'pendente')])).toEqual(['b:assinalado', 'a:assinalado', 'f:sugerido'])
  })
  it('receita: os itens estruturados (com dose e tempo) e o texto como foi enviado', () => {
    const anexos = montarAnexos(c, DADOS)
    const d = dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: c, anexos })
    expect(d.receita!.itens.map((x) => x.nome)).toEqual(expect.arrayContaining(['Limeciclina', 'Adapaleno + peróxido de benzoíla']))
    expect(d.receita!.itens.find((x) => x.nome === 'Limeciclina')!.duracao).toBe('8sem')
    expect(d.receita!.texto).toBe(anexos.find((a) => a.tipo === 'receita')!.texto)
  })
  it('atestado e laudo emitidos entram como linha da conduta; não emitidos, não', () => {
    const anexos = montarAnexos(c, DADOS)
    expect(dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: c, anexos }).documentos).toEqual([])
    const comAtestado = anexos.map((a) => (a.tipo === 'atestado' ? { ...a, emitir: true } : a))
    expect(linhas(montarProntuario(HISTORIA, ITENS, c, comAtestado))['P.atestado']).toBe('comparecimento à consulta.')
    const comPeriodo = definirCampos(comAtestado, 'atestado', { periodo: { de: '2026-11-13', ate: '2026-11-15' } })
    const comLaudo = definirCampos(comPeriodo.map((a) => (a.tipo === 'laudo' ? { ...a, emitir: true } : a)), 'laudo', { finalidade: { tipo: 'inss', outra: '' } })
    const t = linhas(montarProntuario(HISTORIA, ITENS, c, comLaudo))
    expect(t['P.atestado']).toBe('de 13/11 a 15/11/2026.')
    expect(t['P.laudo']).toBe('para o INSS.')
    // só o resumo: o texto do documento não vai para o prontuário
    expect(t['P.atestado']).not.toMatch(/Atesto/)
  })
  it('exames trazidos: um registro por item, com valor e data (base do gráfico no retorno); não encontrado = null', () => {
    const complementares = [{ exame: 'Exames laboratoriais', data: '02/10/2026', origem: 'laudo.pdf', itens: [
      { nome: 'Glicemia', v: { status: 'PRESENT' as const, valor: '132 mg/dL', origem: 'pág. 1' } },
      { nome: 'TSH', v: { status: 'MISSING' as const, valor: null } },
    ] }]
    const d = dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: c, complementares })
    expect(d.exames).toEqual([
      { exame: 'Exames laboratoriais', nome: 'Glicemia', valor: '132 mg/dL', status: 'PRESENT', data: '02/10/2026', origem: 'laudo.pdf' },
      { exame: 'Exames laboratoriais', nome: 'TSH', valor: null, status: 'MISSING', data: '02/10/2026', origem: 'laudo.pdf' },
    ])
  })
  it('edição do médico: narrativa vai para o próprio dado; linha estruturada (HD) fica à parte e aparece no lugar', () => {
    const d = dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: c })
    const r = aplicarEdicoes(d, { 'S.hda': 'HDA reescrita.', 'A.hd': 'Acne (revisar).', 'S.qp': 'Espinhas no rosto.' })
    expect(r.dados.hda).toBe('HDA reescrita.')
    expect(r.dados.diagnosticos).toEqual(d.diagnosticos)
    expect(r.edicoes).toEqual({ 'A.hd': 'Acne (revisar).' })
    const t = Object.fromEntries(secoesDaEntrada(r).flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto])))
    expect(t['A.hd']).toBe('Acne (revisar).')
    expect(t['S.hda']).toBe('HDA reescrita.')
  })
})

describe('extensão das lesões gravada como número', () => {
  const dados = (extensao?: string) => dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: conduta(), extensao })
  it('o valor do campo Extensão do exame vira número no prontuário', () => {
    expect(dados('Cerca de 4% da superfície corporal').extensaoPct).toBe(4)
    expect(dados('1').extensaoPct).toBe(1)
    expect(dados('6,5%').extensaoPct).toBe(6.5)
  })
  it('sem número no campo (vazio ou texto), fica null: nada é inventado', () => {
    expect(dados().extensaoPct).toBeNull()
    expect(dados('7 lesões na face').extensaoPct).toBeNull()
  })
})

describe('retorno: a Evolução vai para o prontuário', () => {
  const EVOLUCAO = [
    { rotulo: 'Evolução', texto: 'Paciente relata melhora importante das placas. Nega efeitos colaterais.' },
    { rotulo: 'Exame', texto: 'Placas residuais. Extensão das lesões: 1% (consulta anterior, 18/09: 4%), redução de 3 pontos percentuais.' },
    { rotulo: 'Exames', texto: 'Resultados comparados na tabela abaixo.' },
  ]
  const dados = () => dadosDaConsulta({ historia: EVOLUCAO, itens: ITENS, conduta: conduta(), extensao: '1' })
  it('a entrada do retorno guarda a Evolução e o Exame de hoje; sem queixa, HDA ou antecedentes', () => {
    const d = dados()
    expect(d.evolucao).toBe('Paciente relata melhora importante das placas. Nega efeitos colaterais.')
    expect(d.exameFisico).toMatch(/^Placas residuais/)
    expect([d.qp, d.hda, d.ap, d.examesTexto]).toEqual(['', '', '', ''])
    expect(d.extensaoPct).toBe(1)
  })
  it('a primeira consulta não tem Evolução', () => {
    expect(dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: conduta() }).evolucao).toBe('')
  })
  it('o texto mostra a linha Evolução no lugar de QP/HDA/AP, e o médico pode editá-la', () => {
    const secoes = secoesDosDados(dados())
    expect(secoes[0].linhas.map((l) => l.rotulo)).toEqual(['Evolução'])
    const editado = aplicarEdicoes(dados(), { 'S.evolucao': 'Paciente informa melhora. Nega efeitos colaterais.' })
    expect(editado.dados.evolucao).toBe('Paciente informa melhora. Nega efeitos colaterais.')
  })
})


describe('edicoesDoMedico (o que o médico mudou na revisão final)', () => {
  const dados: DadosEntrada = {
    qp: 'Espinhas.', hda: 'HDA original.', ap: 'Hipertensão.', hp: '', hf: '', exameFisico: 'Pápulas.', examesTexto: '', exames: [],
    diagnosticos: [{ nome: 'Acne vulgar', cid: 'L70.0', pct: 85, situacao: 'assinalado' }], receita: null,
    condutaTexto: 'Rotina.', solicitado: [], encaminhado: [], orientacoes: '', avaliacao: 'em 8 semanas.', documentos: [], fotos: [],
  }
  const textos = () => Object.fromEntries(secoesDosDados(dados).flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto])))
  const NARRATIVA_DO_SERVIDOR: Record<string, keyof DadosEntrada> = { 'S.qp': 'qp', 'S.hda': 'hda', 'S.ap': 'ap', 'S.hp': 'hp', 'S.hf': 'hf', 'O.exame': 'exameFisico', 'O.exames': 'examesTexto', 'P.orientacoes': 'orientacoes' }

  it('devolve a linha narrativa e a estruturada que ele mudou', () => {
    expect(edicoesDoMedico(dados, { ...textos(), 'S.hda': 'HDA corrigida.', 'A.hd': 'Meu HD' })).toEqual({ 'S.hda': 'HDA corrigida.', 'A.hd': 'Meu HD' })
  })
  it('sem mudança devolve vazio', () => expect(edicoesDoMedico(dados, textos())).toEqual({}))
  it('texto apagado vem como vazio (a linha some)', () => expect(edicoesDoMedico(dados, { ...textos(), 'S.ap': '  ' })).toEqual({ 'S.ap': '' }))
  it('linha que não existe nos dados é ignorada', () => expect(edicoesDoMedico(dados, { ...textos(), 'S.hp': 'Inventado.' })).toEqual({}))
  it('a cópia local é igual ao que o servidor guarda (narrativas nos dados, o resto em edicoes)', () => {
    const t = { ...textos(), 'S.hda': 'HDA corrigida.', 'O.exame': 'Pápulas e pústulas.', 'A.hd': 'Meu HD' }
    const todas = edicoesDoMedico(dados, t)
    const noServidor = { ...dados } as Record<string, unknown>
    const resto: Record<string, string> = {}
    for (const [k, v] of Object.entries(todas)) {
      if (NARRATIVA_DO_SERVIDOR[k]) noServidor[NARRATIVA_DO_SERVIDOR[k]] = v.trim()
      else resto[k] = v
    }
    const local = aplicarEdicoes(dados, t)
    expect(noServidor).toEqual(local.dados)
    expect(resto).toEqual(local.edicoes)
  })
})

describe('registro do retorno: só o que mudou (regra 14.8)', () => {
  const base = dadosDaConsulta({ historia: HISTORIA, itens: ITENS, conduta: conduta() })
  const linha = (d: DadosEntrada, id: string) => secoesDosDados(d).flatMap((s) => s.linhas).find((l) => l.id === id)?.texto
  const acne = { nome: 'Acne vulgar', cid: 'L70.0', pct: null, situacao: 'assinalado' as const }

  it('confirmado sem %, nova hipótese com %, conduta e orientações só o que mudou', () => {
    const d: DadosEntrada = { ...base, comparacao: {
      referencia: 'Consulta 1', confirmados: [acne],
      novasHipoteses: [{ nome: 'Tinha do corpo', cid: 'B35.4', pct: 30, situacao: 'assinalado' }],
      conduta: [{ tipo: 'iniciado', texto: 'Cetoconazol 2% CREME' }, { tipo: 'suspenso', texto: 'Limeciclina' }],
      orientacoes: 'Evitar sol.',
    } }
    expect(linha(d, 'hd')).toBe('Acne vulgar (CID-10 L70.0) · Confirmado\nNova hipótese: Tinha do corpo (CID-10 B35.4) — 30%')
    expect(linha(d, 'conduta')).toBe('Iniciado: Cetoconazol 2% CREME\nSuspenso: Limeciclina')
    expect(linha(d, 'orientacoes')).toBe('Evitar sol.')
  })

  it('nada mudou: HD vide consulta, conduta mantida, sem orientações', () => {
    const d: DadosEntrada = { ...base, comparacao: { referencia: 'Consulta 1', confirmados: [], novasHipoteses: [], conduta: [], orientacoes: '' } }
    expect(linha(d, 'hd')).toBe('Vide consulta 1')
    expect(linha(d, 'conduta')).toBe('Mantida.')
    expect(linha(d, 'orientacoes')).toBeUndefined()
  })
})
