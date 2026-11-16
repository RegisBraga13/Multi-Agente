import { describe, expect, it } from 'vitest'
import {
  calcularIdade, convenioAtendido, FOTO_MAX_BYTES, normalizarWhatsapp, validarAtendimento, validarContato, validarDadosPessoais, validarFoto, validarPedido,
  type DadosPessoais, type RascunhoPedido,
} from './regras'

const base: RascunhoPedido = {
  modalidade: 'presencial', data: '2026-11-17', inicio: '08:00',
  nome: 'Maria Lima', whatsapp: '(85) 99101-8813', atendimento: 'particular', convenio: '', transcricao: 'aceita', forma: 'whatsapp',
}

describe('normalizarWhatsapp', () => {
  it('normaliza WhatsApp digitado de vários jeitos', () => {
    for (const t of ['(85) 99101-8813', '85991018813', '+55 85 99101-8813', '55 (85) 9 9101 8813'])
      expect(normalizarWhatsapp(t)).toBe('5585991018813')
  })

  it('recusa fixo, curto e DDD inválido', () => {
    for (const t of ['85 3101-8813', '991018813', '(05) 99101-8813', ''])
      expect(normalizarWhatsapp(t)).toBeNull()
  })
})

describe('validarPedido', () => {
  it('pedido completo passa; recusar a transcrição também passa', () => {
    expect(validarPedido(base)).toEqual({})
    expect(validarPedido({ ...base, transcricao: 'recusada' })).toEqual({})
  })

  it('exige horário, nome, WhatsApp, atendimento, resposta da transcrição e forma', () => {
    const e = validarPedido({ ...base, data: null, nome: '  ', whatsapp: '123', atendimento: null, transcricao: null, forma: null })
    expect(Object.keys(e).sort()).toEqual(['atendimento', 'forma', 'horario', 'nome', 'transcricao', 'whatsapp'])
  })

  it('quem escolhe preencher na consulta ainda precisa de nome e WhatsApp', () => {
    expect(validarPedido({ ...base, forma: 'consulta', whatsapp: '' }).whatsapp).toBeDefined()
  })
})

describe('validarAtendimento', () => {
  it('particular basta; convênio exige o nome do convênio', () => {
    expect(validarAtendimento({ atendimento: 'particular', convenio: '' })).toEqual({})
    expect(validarAtendimento({ atendimento: 'convenio', convenio: 'Unimed' })).toEqual({})
    expect(Object.keys(validarAtendimento({ atendimento: 'convenio', convenio: '  ' }))).toEqual(['convenio'])
    expect(Object.keys(validarAtendimento({ atendimento: null, convenio: '' }))).toEqual(['atendimento'])
  })
})

describe('convenioAtendido', () => {
  const lista = ['Unimed', 'Bradesco Saúde']
  it('compara sem diferenciar maiúsculas, acentos e espaços', () => {
    expect(convenioAtendido(lista, 'unimed')).toBe(true)
    expect(convenioAtendido(lista, ' bradesco saude ')).toBe(true)
    expect(convenioAtendido(lista, 'Amil')).toBe(false)
  })
})

describe('validarContato', () => {
  it('só olha nome e WhatsApp', () => {
    expect(validarContato({ nome: 'Maria', whatsapp: '85991018813' })).toEqual({})
    expect(Object.keys(validarContato({ nome: 'Ma', whatsapp: '' })).sort()).toEqual(['nome', 'whatsapp'])
  })
})

describe('validarDadosPessoais', () => {
  it('nome completo, nascimento válido, e-mail opcional', () => {
    const hoje = new Date(2026, 10, 15)
    const d: DadosPessoais = {
      nomeCompleto: 'Maria Lima', nascimento: '1990-05-02', sexo: 'F',
      whatsapp: '85991018813', email: '', cidade: 'Fortaleza', uf: 'CE',
      profissao: '', trabalhoExposto: '',
    }
    expect(validarDadosPessoais(d, hoje)).toEqual({})
    // profissão e trabalho exposto são opcionais
    expect(validarDadosPessoais({ ...d, profissao: 'Pedreiro', trabalhoExposto: 'sim' }, hoje)).toEqual({})
    expect(validarDadosPessoais({ ...d, nomeCompleto: 'Maria' }, hoje).nomeCompleto).toBeDefined()
    expect(validarDadosPessoais({ ...d, nascimento: '2027-01-01' }, hoje).nascimento).toBeDefined()
    expect(validarDadosPessoais({ ...d, nascimento: '1890-01-01' }, hoje).nascimento).toBeDefined()
    expect(validarDadosPessoais({ ...d, nascimento: '2026-02-31' }, hoje).nascimento).toBeDefined()
    expect(validarDadosPessoais({ ...d, email: 'maria@' }, hoje).email).toBeDefined()
    const vazio = validarDadosPessoais({ ...d, sexo: '', cidade: ' ', uf: 'XX', whatsapp: '1' }, hoje)
    expect(Object.keys(vazio).sort()).toEqual(['cidade', 'sexo', 'uf', 'whatsapp'])
  })
})

describe('calcularIdade', () => {
  const hoje = new Date(2026, 10, 15)
  it('conta os anos completos, virando no dia do aniversário', () => {
    expect(calcularIdade('1990-11-15', hoje)).toBe(36)
    expect(calcularIdade('1990-11-16', hoje)).toBe(35)
    expect(calcularIdade('1990-05-02', hoje)).toBe(36)
    expect(calcularIdade('2026-11-15', hoje)).toBe(0)
  })
  it('nascido em 29/02 faz aniversário em 01/03 nos anos comuns', () => {
    expect(calcularIdade('2000-02-29', new Date(2026, 1, 28))).toBe(25)
    expect(calcularIdade('2000-02-29', new Date(2026, 2, 1))).toBe(26)
  })
  it('data incompleta, impossível ou futura não tem idade', () => {
    for (const iso of ['', '1990-02-31', '2027-01-01', '1890-01-01']) expect(calcularIdade(iso, hoje)).toBeNull()
  })
})

describe('validarFoto', () => {
  it('só imagem até 10 MB', () => {
    expect(validarFoto({ type: 'image/jpeg', size: 2_000_000 })).toBeNull()
    expect(validarFoto({ type: 'application/pdf', size: 1000 })).not.toBeNull()
    expect(validarFoto({ type: 'image/png', size: FOTO_MAX_BYTES + 1 })).not.toBeNull()
  })
})
