import { describe, expect, it } from 'vitest'
import { blocoRespondido, blocosDaAnamnese, blocosDoFormulario, blocosVisiveis, faltaResponder } from './blocos'
import { partesPreConsulta } from './pre-consulta'
import type { DadosPessoais } from './regras'

const partes = partesPreConsulta('dermatologia')
const dados: DadosPessoais = {
  nomeCompleto: 'Maria Lima', nomeSocial: '', nascimento: '1990-05-02', sexo: 'M', whatsapp: '85912345678', email: '',
  cidade: 'Fortaleza', uf: 'CE', estadoCivil: '', profissao: '', trabalhoExposto: '',
}
const hoje = new Date(2026, 10, 16)

describe('blocosDoFormulario', () => {
  it('só a identificação é obrigatória; o resto (alergias também) é opcional', () => {
    const b = blocosDoFormulario(partes)
    expect(b.map((x) => x.titulo)).toEqual([
      'Identificação', 'Estado civil e trabalho', 'Queixa principal', 'Fototipo e exposição ao sol',
      'Rotina de cuidados', 'Saúde geral', 'Histórico familiar', 'Fotos e documentos', 'Algo mais que seu médico deva saber?',
    ])
    expect(b.map((x) => x.obrigatorio)).toEqual([true, false, false, false, false, false, false, false, false])
    expect(new Set(b.map((x) => x.id)).size).toBe(b.length)
  })
})

describe('blocoRespondido', () => {
  const [ident, trabalho, queixa, , , saude, , fotos] = blocosDoFormulario(partes)
  it('identificação conta só quando está válida', () => {
    expect(blocoRespondido(ident, { dados, respostas: {}, fotos: [], hoje })).toBe(true)
    expect(blocoRespondido(ident, { dados: { ...dados, uf: '' }, respostas: {}, fotos: [], hoje })).toBe(false)
  })
  it('trabalho: qualquer campo preenchido', () => {
    expect(blocoRespondido(trabalho, { dados, respostas: {}, fotos: [], hoje })).toBe(false)
    expect(blocoRespondido(trabalho, { dados: { ...dados, trabalhoExposto: 'nao' }, respostas: {}, fotos: [], hoje })).toBe(true)
  })
  it('parte da especialidade: alguma resposta visível não vazia', () => {
    expect(blocoRespondido(queixa, { dados, respostas: { queixa: '  ', sintomas: [] }, fotos: [], hoje })).toBe(false)
    expect(blocoRespondido(queixa, { dados, respostas: { sintomas: ['Coça'] }, fotos: [], hoje })).toBe(true)
    // gestação não aparece para sexo masculino: não conta
    expect(blocoRespondido(saude, { dados, respostas: { gravida: 'Não', amamentando: 'Não' }, fotos: [], hoje })).toBe(false)
  })
  it('fotos: conta quando alguma foto foi escolhida', () => {
    expect(blocoRespondido(fotos, { dados, respostas: {}, fotos: [], hoje })).toBe(false)
    expect(blocoRespondido(fotos, { dados, respostas: {}, fotos: ['foto_perto'], hoje })).toBe(true)
  })
})

describe('faltaResponder', () => {
  const [ident, , queixa, , , saude] = blocosDoFormulario(partes)
  const estado = (respostas: Record<string, string | string[]>) => ({ dados, respostas, fotos: [], hoje })
  it('alergias em branco não trava nada (a identificação tem a sua própria validação)', () => {
    expect(faltaResponder(ident, estado({}))).toEqual([])
    expect(faltaResponder(saude, estado({}))).toEqual([])
  })
  it('as outras partes nunca faltam', () => {
    expect(faltaResponder(queixa, estado({}))).toEqual([])
    expect(faltaResponder(saude, estado({}))).toEqual([])
  })
})

describe('blocosDaAnamnese (tela do médico)', () => {
  it('reumatologia: Onde dói e Rigidez e dor em duas telas cada, sem perder pergunta', () => {
    const reumato = partesPreConsulta('reumatologia')
    const b = blocosDaAnamnese(reumato)
    expect(b.map((x) => x.titulo)).toContain('Onde dói 1/2')
    expect(b.map((x) => x.titulo)).toContain('Rigidez e dor 2/2')
    const ids = b.flatMap((x) => ('parte' in x ? x.parte.perguntas.map((q) => q.id) : []))
    expect(ids.sort()).toEqual(reumato.flatMap((p) => p.perguntas.map((q) => q.id)).sort())
  })
})

describe('blocosVisiveis', () => {
  it('some a parte cujas perguntas não se aplicam (queixa não marcada); as outras ficam', () => {
    const todos = blocosDoFormulario(partesPreConsulta('neurologia'))
    const titulos = (r: Record<string, string | string[]>) => blocosVisiveis(todos, 'F', r).map((b) => b.titulo)
    expect(titulos({ motivo: ['Dor de cabeça'] })).toContain('Dor')
    expect(titulos({ motivo: ['Dor de cabeça'] })).not.toContain('Tremor ou movimentos')
    expect(titulos({})).toContain('Histórico de saúde')
  })
})

describe('Estado civil e trabalho', () => {
  it('pediatria não tem (o paciente é criança); as outras têm (autor, 26/11/2026)', () => {
    expect(blocosDoFormulario(partesPreConsulta('pediatria')).map((b) => b.id)).not.toContain('trabalho')
    for (const esp of ['geriatria', 'psiquiatria', 'otorrinolaringologia', 'dermatologia']) {
      expect(blocosDoFormulario(partesPreConsulta(esp))[1].id).toBe('trabalho')
    }
  })
})
