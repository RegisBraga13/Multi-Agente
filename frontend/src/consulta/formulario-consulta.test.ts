import { describe, expect, it } from 'vitest'
import { partesPreConsulta } from '../medico/pre-consulta'
import { FORMULARIO_VAZIO, formularioParaHistoria, juntarFormularioAoTexto, lembretesDoFormulario, textoDoFormulario, type FormularioConsulta } from './formulario-consulta'

const partes = partesPreConsulta('dermatologia')
const hoje = new Date(2026, 10, 19)
const F: FormularioConsulta = {
  dados: { ...FORMULARIO_VAZIO.dados, nomeCompleto: 'Maria Lima', nascimento: '1979-10-19', sexo: 'F', cidade: 'Fortaleza', uf: 'CE', profissao: 'Professora' },
  respostas: { alergias: 'Dipirona', queixa: 'Manchas no rosto', desde_quando: '2 anos', sintomas: ['Coça', 'Dói'], cor_pele: 'Clara', gravida: 'Não', familia: ['Psoríase'] },
  fotos: { foto_perto: '/x', documentos_1: '/y', documentos_2: '/z' },
}

describe('textoDoFormulario', () => {
  it('vira texto na ordem do formulário; pergunta com "?" seguida da resposta; o que está em branco não entra', () => {
    expect(textoDoFormulario(partes, F, hoje)).toBe([
      'Identificação: 47 anos, sexo F.',
      'Estado civil e trabalho: Professora.',
      'Queixa principal: Qual o motivo da sua consulta? Manchas no rosto. Há quanto tempo apareceu? 2 anos. Coça, dói ou sangra? Coça, Dói.',
      'Fototipo e exposição ao sol: Cor da pele: Clara.',
      'Saúde geral: Alergias: Dipirona. Está grávida? Não.',
      'Histórico familiar: Alguém da família tem ou teve: Psoríase.',
      'Fotos e documentos: 1 foto e 2 documentos (no Exame físico).',
    ].join('\n'))
  })

  it('sem nome, nome social ou cidade (só idade e sexo); "Não tenho alergia" fica escrito como resposta', () => {
    const t = textoDoFormulario(partes, { ...F, dados: { ...F.dados, nomeSocial: 'Mari' }, respostas: { alergias: 'Não tenho alergia' }, fotos: {} }, hoje)
    expect(t.split('\n')).toEqual(['Identificação: 47 anos, sexo F.', 'Estado civil e trabalho: Professora.', 'Saúde geral: Alergias: Não tenho alergia.'])
  })
})

describe('lembretesDoFormulario', () => {
  it('alergias sempre aparece em Perguntas, mesmo respondida; as outras só quando em branco', () => {
    const ids = lembretesDoFormulario(partes, F).map((q) => q.id)
    expect(ids.filter((id) => id === 'alergias')).toEqual(['alergias'])
    expect(ids).not.toContain('queixa')
    expect(ids).toContain('local')
    expect(lembretesDoFormulario(partes, FORMULARIO_VAZIO).filter((q) => q.id === 'alergias')).toHaveLength(1)
  })
})

describe('juntarFormularioAoTexto', () => {
  it('o formulário entra no começo da caixa, antes do que já foi gravado ou escrito', () => {
    expect(juntarFormularioAoTexto('Médico: Bom dia!\n', 'FORM', null)).toBe('FORM\n\nMédico: Bom dia!\n')
    // caixa vazia: deixa uma linha em branco para a conversa gravada começar separada
    expect(juntarFormularioAoTexto('', 'FORM', null)).toBe('FORM\n\n')
  })
  it('salvar o formulário de novo troca o texto antigo dele, sem duplicar', () => {
    expect(juntarFormularioAoTexto('VELHO\n\nMédico: oi', 'NOVO', 'VELHO')).toBe('NOVO\n\nMédico: oi')
  })
})

describe('formularioParaHistoria', () => {
  it('formulário salvo + respostas dos lembretes: as respostas entram; em branco não', () => {
    const h = formularioParaHistoria(F, F.dados, { local: 'Rosto', protetor: '', bronzeamento: [] })!
    expect(h.respostas.local).toBe('Rosto')
    expect(h.respostas.queixa).toBe('Manchas no rosto')
    expect('protetor' in h.respostas).toBe(false)
    expect('bronzeamento' in h.respostas).toBe(false)
  })
  it('formulário não salvo: só o que foi respondido nos lembretes (o resto do formulário não foi conferido)', () => {
    const h = formularioParaHistoria(null, F.dados, { gravida: 'Não' })!
    expect(h.respostas).toEqual({ gravida: 'Não' })
    expect(h.dados.sexo).toBe('F')
  })
  it('sem formulário salvo e sem resposta nos lembretes: nada', () => {
    expect(formularioParaHistoria(null, F.dados, { local: '  ' })).toBeNull()
  })
})

describe('textoDoFormulario: reumatologia', () => {
  const reumato = partesPreConsulta('reumatologia')
  it('"Outro" vira o próprio texto; outra opção que abre linha leva o texto entre parênteses; "Algo mais" sem rótulo', () => {
    const t = textoDoFormulario(reumato, {
      ...FORMULARIO_VAZIO,
      respostas: {
        inicio: 'Após algum evento específico', inicio_qual: 'dengue',
        regioes: ['Joelhos', 'Outro'], regioes_qual: 'mandíbula',
        nota_dor: '7',
        algo_mais: 'Piorou depois da vacina',
      },
    }, hoje)
    expect(t.split('\n')).toEqual([
      'Motivo da consulta: Como os sintomas começaram? Após algum evento específico (dengue).',
      'Onde dói: Quais regiões do corpo doem ou incomodam no momento? Joelhos, mandíbula.',
      'Rigidez e dor: Em uma escala de 0 a 10, qual nota você dá para a sua dor na última semana? 7.',
      'Algo mais que seu médico deva saber? Piorou depois da vacina.',
    ])
  })
})

describe('lembrete "Nota da dor (0 a 10)" (todos os módulos; autor, 24/11/2026)', () => {
  // sem "Dói" marcado: a nota não aparece no formulário da dermatologia, só pelo que foi falado
  const S: FormularioConsulta = { ...F, respostas: { ...F.respostas, sintomas: ['Coça'] } }
  const temNota = (falado: string, f: FormularioConsulta = S) => lembretesDoFormulario(partes, f, falado).some((q) => q.id === 'nota_dor')
  it('entra quando o paciente fala de dor e a nota não foi dita', () => {
    expect(temNota('Paciente diz que o joelho dói muito há duas semanas.')).toBe(true)
    expect(temNota('Refere dor nas costas.')).toBe(true)
  })
  it('não entra sem dor, com a nota dita ou já respondida no formulário', () => {
    expect(temNota('Manchas que coçam.')).toBe(false)
    expect(temNota('Dor no joelho, nota 7.')).toBe(false)
    expect(temNota('Dor no joelho, 8/10.')).toBe(false)
    expect(temNota('Dor no joelho.', { ...S, respostas: { ...S.respostas, nota_dor: '6' } })).toBe(false)
    expect(temNota('Sem doenças crônicas.')).toBe(false)
  })
  it('na dermatologia, a nota só aparece no formulário para quem marcou "Dói"', () => {
    const semDoi = { ...F, respostas: { ...F.respostas, sintomas: ['Coça'] } }
    expect(lembretesDoFormulario(partes, semDoi).some((q) => q.id === 'nota_dor')).toBe(false)
    // F marcou "Coça" e "Dói" e não deu a nota: vira lembrete do formulário
    expect(lembretesDoFormulario(partes, F).find((q) => q.id === 'nota_dor')?.lembrete).toBe('Nota da dor (0 a 10)')
  })
})

describe('"Algo mais" em branco', () => {
  it('não vira lembrete em Perguntas (autor, 25/11/2026)', () => {
    expect(lembretesDoFormulario(partes, FORMULARIO_VAZIO).some((q) => q.id === 'algo_mais')).toBe(false)
  })
})
