import { describe, expect, it } from 'vitest'
import { MEDICO_EXEMPLO } from './exemplo'
import { mensagemFormulario } from './mensagem'
import { partesPreConsulta } from './pre-consulta'
import type { DadosPessoais, RascunhoPedido } from './regras'

const pedido: RascunhoPedido = {
  modalidade: 'presencial', data: '2026-11-16', inicio: '08:00',
  nome: 'Maria Lima', whatsapp: '85912345678', atendimento: 'convenio', convenio: 'Unimed', transcricao: 'aceita', forma: 'pagina',
}
const dados: DadosPessoais = {
  nomeCompleto: 'Maria Lima', nascimento: '1990-05-02', sexo: 'F', whatsapp: '85912345678', email: '',
  cidade: 'Fortaleza', uf: 'CE', estadoCivil: '', profissao: '', trabalhoExposto: 'sim',
}
const hoje = new Date(2026, 10, 15)
const base = { medico: MEDICO_EXEMPLO, pedido, dados, partes: partesPreConsulta('dermatologia'), fotos: 0, hoje }

describe('mensagemFormulario', () => {
  it('abre com o médico, o pedido, o atendimento e a transcrição', () => {
    const m = mensagemFormulario({ ...base, respostas: {} })
    expect(m).toContain('*Formulário da consulta · Dra. Ana Souza*')
    expect(m).toContain('Pedido: segunda-feira, 16 de novembro, às 08:00 · Presencial')
    expect(m).toContain('Atendimento: Convênio (Unimed)')
    expect(m).toContain('Transcrição da consulta: aceita')
  })

  it('identificação com idade calculada; trabalho à parte; sem campos vazios', () => {
    const m = mensagemFormulario({ ...base, respostas: {} })
    expect(m).toContain('*1. Identificação*')
    expect(m).toContain('Nascimento: 02/05/1990 (36 anos)')
    expect(m).toContain('Sexo: Feminino')
    expect(m).toContain('WhatsApp: (85) 91234-5678')
    expect(m).toContain('Cidade: Fortaleza/CE')
    expect(m).toContain('*2. Estado civil e trabalho*\nTrabalha ao ar livre, exposto ao sol ou a produtos químicos: Sim')
    expect(m).not.toContain('E-mail')
    expect(m).not.toContain('Profissão')
  })

  it('só as partes respondidas, com a numeração do formulário; várias opções juntas', () => {
    const m = mensagemFormulario({ ...base, respostas: { queixa: 'Manchas no rosto', sintomas: ['Coça', 'Dói'], familia: [] } })
    expect(m).toContain('*3. Queixa principal*\nQual o motivo da sua consulta? Manchas no rosto\nCoça, dói ou sangra? Coça, Dói')
    expect(m).not.toContain('Fototipo')
    expect(m).not.toContain('Histórico familiar')
  })

  it('sem trabalho preenchido, o bloco não aparece; particular aparece como particular', () => {
    const m = mensagemFormulario({ ...base, pedido: { ...pedido, atendimento: 'particular' }, dados: { ...dados, trabalhoExposto: '' }, respostas: {} })
    expect(m).not.toContain('Estado civil e trabalho')
    expect(m).toContain('Atendimento: Particular')
  })

  it('pergunta que não aparece para o sexo marcado não vai na mensagem', () => {
    const m = mensagemFormulario({ ...base, dados: { ...dados, sexo: 'M' }, respostas: { gestacao: 'Grávida' } })
    expect(m).not.toContain('Grávida')
    expect(m).not.toContain('Saúde geral')
  })

  it('sem pré-consulta respondida, avisa; com fotos, pede para mandar em seguida', () => {
    expect(mensagemFormulario({ ...base, respostas: { queixa: '  ' } })).toContain('Pré-consulta: não respondida.')
    const m = mensagemFormulario({ ...base, respostas: {}, fotos: 2 })
    expect(m).toContain('Vou enviar 2 fotos em seguida, nesta conversa.')
  })
})
