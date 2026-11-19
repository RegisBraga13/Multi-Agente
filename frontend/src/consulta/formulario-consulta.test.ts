import { describe, expect, it } from 'vitest'
import { partesPreConsulta } from '../medico/pre-consulta'
import { FORMULARIO_VAZIO, juntarFormularioAoTexto, textoDoFormulario, type FormularioConsulta } from './formulario-consulta'

const partes = partesPreConsulta('dermatologia')
const hoje = new Date(2026, 10, 19)
const F: FormularioConsulta = {
  dados: { ...FORMULARIO_VAZIO.dados, nomeCompleto: 'Maria Lima', nascimento: '1979-10-19', sexo: 'F', cidade: 'Fortaleza', uf: 'CE', profissao: 'Professora' },
  respostas: { alergias: 'Dipirona', queixa: 'Manchas no rosto', desde_quando: '2 anos', sintomas: ['Coça', 'Dói'], cor_pele: 'Clara', gestacao: 'Não', familia: ['Psoríase'] },
  fotos: { foto_perto: '/x', documentos_1: '/y', documentos_2: '/z' },
}

describe('textoDoFormulario', () => {
  it('vira texto na ordem do formulário; pergunta com "?" seguida da resposta; o que está em branco não entra', () => {
    expect(textoDoFormulario(partes, F, hoje)).toBe([
      'Identificação: Maria Lima, 47 anos, sexo F, Fortaleza/CE.',
      'Alergias: Dipirona.',
      'Estado civil e trabalho: Professora.',
      'Queixa principal: Qual o motivo da sua consulta? Manchas no rosto. Há quanto tempo apareceu? 2 anos. Coça, dói ou sangra? Coça, Dói.',
      'Fototipo e exposição ao sol: Cor da pele: Clara.',
      'Saúde geral: Está grávida ou amamentando? Não.',
      'Histórico familiar: Alguém da família tem ou teve: Psoríase.',
      'Fotos e documentos: 1 foto e 2 documentos (no Exame físico).',
    ].join('\n'))
  })

  it('nome social aparece; "Não tenho alergia" fica escrito como resposta', () => {
    const t = textoDoFormulario(partes, { ...F, dados: { ...F.dados, nomeSocial: 'Mari' }, respostas: { alergias: 'Não tenho alergia' }, fotos: {} }, hoje)
    expect(t.split('\n').slice(0, 2)).toEqual(['Identificação: Maria Lima (nome social: Mari), 47 anos, sexo F, Fortaleza/CE.', 'Alergias: Não tenho alergia.'])
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
