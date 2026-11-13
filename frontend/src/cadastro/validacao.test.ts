import { describe, expect, it } from 'vitest'
import { forcaSenha, limparCrm, validarCadastro, validarComplemento, type DadosCadastro } from './validacao'

const valido: DadosCadastro = {
  nome: 'Ana Ribeiro', email: 'ana@clinica.com.br', crm: '123456', uf: 'SP',
  especialidade: 'geriatria', senha: 'Consulta2026!', aceite: true,
}

describe('validarCadastro', () => {
  it('aceita um cadastro completo', () => {
    expect(validarCadastro(valido)).toEqual({})
  })

  it('exige CRM, inclusive no teste grátis', () => {
    expect(validarCadastro({ ...valido, crm: '' }).crm).toBeDefined()
    expect(validarCadastro({ ...valido, crm: 'abc' }).crm).toBeDefined()
    expect(validarCadastro({ ...valido, crm: '123456789' }).crm).toBeDefined()
  })

  it('aceita CRM digitado com pontos e espaços', () => {
    expect(validarCadastro({ ...valido, crm: '123.456' }).crm).toBeUndefined()
    expect(limparCrm(' 12.345-6 ')).toBe('123456')
  })

  it('exige UF válida', () => {
    expect(validarCadastro({ ...valido, uf: '' }).uf).toBeDefined()
    expect(validarCadastro({ ...valido, uf: 'XX' }).uf).toBeDefined()
  })

  it('recusa especialidade inexistente ou ainda em breve', () => {
    expect(validarCadastro({ ...valido, especialidade: 'xyz' }).especialidade).toBeDefined()
    expect(validarCadastro({ ...valido, especialidade: 'neurologia' }).especialidade).toMatch(/ainda não/)
  })

  it('exige e-mail, nome, senha forte e aceite', () => {
    const e = validarCadastro({ ...valido, nome: 'A', email: 'ana@', senha: 'curta', aceite: false })
    expect(Object.keys(e).sort()).toEqual(['aceite', 'email', 'nome', 'senha'])
    expect(validarCadastro({ ...valido, senha: 'consultamedica' }).senha).toBeDefined()
  })
})

describe('validarComplemento (entrada com Google)', () => {
  it('exige CRM, UF, especialidade e aceite, sem pedir nome, e-mail ou senha', () => {
    expect(validarComplemento({ crm: '123456', uf: 'RJ', especialidade: 'psiquiatria', aceite: true })).toEqual({})
    const e = validarComplemento({ crm: '', uf: '', especialidade: '', aceite: false })
    expect(Object.keys(e).sort()).toEqual(['aceite', 'crm', 'especialidade', 'uf'])
  })
})

describe('forcaSenha', () => {
  it('vai de 0 a 4', () => {
    expect(forcaSenha('')).toBe(0)
    expect(forcaSenha('abcdefghij')).toBe(1)
    expect(forcaSenha('Abcdefghij')).toBe(2)
    expect(forcaSenha('Abcdefghi1')).toBe(3)
    expect(forcaSenha('Abcdefgh1!')).toBe(4)
  })
})
