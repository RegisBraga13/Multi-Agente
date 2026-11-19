import { describe, expect, it } from 'vitest'
import { FORMULARIO_VAZIO } from './formulario-consulta'
import { frasesDoFormulario } from './historia-formulario'

// o exemplo aprovado pelo autor (19/11/2026)
const MARCYA = {
  dados: { ...FORMULARIO_VAZIO.dados, sexo: 'F' as const, estadoCivil: 'casado' as const, profissao: 'Educadora física', trabalhoExposto: 'sim' as const },
  respostas: {
    alergias: 'Dipirona', queixa: 'Manchas no rosto', local: 'Rosto', desde_quando: '2 anos', mudou: 'Não', sintomas: ['Nenhum dos três'],
    cor_pele: 'Morena clara', cor_olhos: 'Castanho-claros', cor_cabelo: 'Castanho', reacao_sol: 'Raramente queimar e bronzear fácil',
    protetor: 'Às vezes', bronzeamento: 'Não', familia: ['Dermatite atópica'],
  },
}

describe('frasesDoFormulario', () => {
  it('o exemplo aprovado: HDA corrida e antecedentes, sem "nega" para o que não foi respondido', () => {
    const f = frasesDoFormulario(MARCYA)
    expect(f.queixa).toBe('refere manchas no rosto há 2 anos, sem mudança de cor, tamanho ou formato, sem prurido, dor ou sangramento')
    expect(f.habitos).toBe('Trabalha exposta ao sol; usa protetor solar às vezes; nega bronzeamento artificial.')
    expect(f.antecedentes).toEqual([
      'Alergia a dipirona.',
      'Pele morena clara, raramente queima e bronzeia fácil.',
      'História familiar de dermatite atópica.',
    ])
  })

  it('local entra só se a queixa ainda não diz onde; sintomas marcados viram termos médicos', () => {
    const f = frasesDoFormulario({ ...MARCYA, respostas: { queixa: 'Pinta que cresceu', local: 'Costas', desde_quando: 'há 3 meses', mudou: 'Sim', sintomas: ['Coça', 'Sangra'] } })
    expect(f.queixa).toBe('refere pinta que cresceu em costas há 3 meses, com mudança de cor, tamanho ou formato, com prurido e sangramento')
  })

  it('respostas negativas e positivas dos antecedentes', () => {
    const f = frasesDoFormulario({
      dados: { ...MARCYA.dados, sexo: 'M', trabalhoExposto: 'nao' },
      respostas: { alergias: 'Não tenho alergia', doencas: 'Hipertensão', medicamentos: 'Losartana 50 mg', familia: ['Nenhum desses'], protetor: 'Nunca' },
    })
    expect(f.habitos).toBe('Não trabalha exposto ao sol nem a produtos químicos; não usa protetor solar.')
    expect(f.antecedentes).toEqual(['Nega alergias.', 'Hipertensão.', 'Em uso de losartana 50 mg.', 'Nega história familiar de doenças de pele.'])
  })

  it('sem queixa no formulário: nada para abrir a HDA', () => {
    expect(frasesDoFormulario({ dados: MARCYA.dados, respostas: {} }).queixa).toBe('')
  })
})
