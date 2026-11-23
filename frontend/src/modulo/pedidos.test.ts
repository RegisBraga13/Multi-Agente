import { describe, expect, it } from 'vitest'
import { MEDICO_EXEMPLO } from '../medico/exemplo'
import type { PedidoNaAgenda, RetornoNaAgenda } from '../servidor/agenda'
import { atendimentoDoPedido, atendimentoDoRetorno, identificacaoDaChegada, juntarPedidos, juntarRetornos, lembrarHoje, mensagemDaConfirmacao, mensagemDoAviso, mensagemDoFormulario, mensagemDoLembrete, precisaIdentificacao } from './pedidos'
import type { Atendimento } from './tipos'

const PEDIDO: PedidoNaAgenda = {
  id: 'p1', tokenFormulario: 'tok123', modalidade: 'presencial', data: '2026-11-20', inicio: '10:00', nome: 'Maria Teste',
  whatsapp: '5585999990000', pagamento: 'Unimed', transcricao: 'aceita', forma: 'whatsapp',
  situacaoFicha: 'sem-ficha', status: 'novo', criadoEm: '2026-11-19T14:05:00-03:00', formulario: null,
}
const AGORA = new Date(2026, 10, 19, 15, 0)

describe('atendimentoDoPedido', () => {
  it('pedido sem formulário: sem ficha, sem nascimento, marcado como pedido novo', () => {
    const at = atendimentoDoPedido(PEDIDO, AGORA)
    expect(at).toMatchObject({
      id: 'pedido-p1', inicio: '10:00', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Unimed',
      paciente: { nome: 'Maria Teste', nascimento: '' }, ficha: { situacao: 'sem-ficha' }, atendido: false, temHistorico: false,
      pedido: { id: 'p1', whatsapp: '5585999990000', token: 'tok123', novo: true },
    })
  })

  it('link enviado aparece como link enviado', () => {
    expect(atendimentoDoPedido({ ...PEDIDO, situacaoFicha: 'link-enviado' }, AGORA).ficha).toEqual({ situacao: 'link-enviado' })
  })

  it('formulário recebido vira ficha pronta; "Não tenho alergia" = nenhuma alergia', () => {
    const at = atendimentoDoPedido({
      ...PEDIDO,
      situacaoFicha: 'pronta',
      formulario: {
        dados: {
          nomeCompleto: 'Maria Teste da Silva', nomeSocial: '', nascimento: '1990-05-02', sexo: 'F', whatsapp: '', email: '', cidade: 'Fortaleza', uf: 'CE',
          estadoCivil: 'casado', profissao: 'professora', trabalhoExposto: '',
        },
        respostas: { queixa: 'Manchas no rosto', medicamentos: 'Anticoncepcional', doencas: 'Hipotireoidismo', alergias: 'Não tenho alergia' },
        fotos: [], recebidoEm: '2026-11-19T17:30:00Z',
      },
    }, AGORA)
    expect(at.paciente).toMatchObject({ nome: 'Maria Teste da Silva', nascimento: '1990-05-02' })
    expect(at.ficha).toEqual({
      situacao: 'pronta', recebidaAs: '14:30', sexo: 'F', estadoCivil: 'casado', profissao: 'professora',
      queixa: 'Manchas no rosto', emUso: ['Anticoncepcional'], antecedentes: ['Hipotireoidismo'], alergias: [], transcricao: 'aceita',
    })
  })

  it('alergia escrita vira alergia (a reação fica para o médico perguntar)', () => {
    const f = atendimentoDoPedido({
      ...PEDIDO, situacaoFicha: 'pronta',
      formulario: {
        dados: { nomeCompleto: 'Maria', nomeSocial: '', nascimento: '1990-05-02', sexo: 'F', whatsapp: '', email: '', cidade: 'X', uf: 'CE', estadoCivil: '', profissao: '', trabalhoExposto: '' },
        respostas: { alergias: 'Dipirona' }, fotos: [], recebidoEm: '2026-11-19T17:30:00Z',
      },
    }, AGORA).ficha
    expect(f.situacao === 'pronta' && f.alergias).toEqual([{ substancia: 'Dipirona', reacao: '' }])
  })
})

describe('juntarPedidos', () => {
  const exemplo = (inicio: string): Atendimento => ({
    id: `ex-${inicio}`, inicio, paciente: { id: 'x', nome: 'Exemplo', nascimento: '1980-01-01' }, tipo: 'consulta',
    modalidade: 'presencial', pagamento: 'Particular', ficha: { situacao: 'sem-ficha' }, atendido: false, temHistorico: false,
  })

  it('pedido do dia entra no lugar do exemplo do mesmo horário, em ordem; cancelado e de outro dia ficam de fora', () => {
    const lista = juntarPedidos([exemplo('08:00'), exemplo('10:00')], [
      PEDIDO, { ...PEDIDO, id: 'p2', inicio: '09:00', status: 'cancelado' }, { ...PEDIDO, id: 'p3', data: '2026-11-21' },
    ], '2026-11-20', AGORA)
    expect(lista.map((x) => x.id)).toEqual(['ex-08:00', 'pedido-p1'])
  })
})

describe('mensagemDoFormulario', () => {
  it('primeiro nome, médico, dia, hora e o link', () => {
    const m = mensagemDoFormulario(PEDIDO, MEDICO_EXEMPLO, 'http://192.168.100.60:5180')
    expect(m).toBe(
      'Olá, Maria! Para a sua consulta com Dra. Ana Souza, sexta-feira, 20 de novembro, às 10h (presencial), '
      + 'preencha o formulário: http://192.168.100.60:5180/formulario/tok123',
    )
  })
})

describe('preencher na consulta (Identificação na chegada)', () => {
  it('sem formulário a consulta pede a Identificação; com formulário, não', () => {
    expect(precisaIdentificacao(PEDIDO)).toBe(true)
    const dados = { ...identificacaoDaChegada(PEDIDO), nascimento: '1990-05-02', sexo: 'F' as const, cidade: 'Fortaleza', uf: 'CE' }
    expect(precisaIdentificacao({ ...PEDIDO, formulario: { dados, respostas: {}, fotos: [], recebidoEm: '' } })).toBe(false)
  })

  it('já vem com o nome e o WhatsApp do pedido; o resto em branco', () => {
    expect(identificacaoDaChegada(PEDIDO)).toEqual({
      nomeCompleto: 'Maria Teste', nomeSocial: '', nascimento: '', sexo: '', whatsapp: '(85) 99999-0000', email: '', cidade: '', uf: '',
      estadoCivil: '', profissao: '', trabalhoExposto: '',
    })
  })
})

describe('aviso no dia (preencher na consulta)', () => {
  const NA_CONSULTA = { ...PEDIDO, forma: 'consulta' as const }
  it('só no dia da consulta, para quem escolheu preencher na consulta e ainda não preencheu', () => {
    expect(lembrarHoje(NA_CONSULTA, '2026-11-20')).toBe(true)
    expect(lembrarHoje(NA_CONSULTA, '2026-11-19')).toBe(false)
    expect(lembrarHoje(PEDIDO, '2026-11-20')).toBe(false)
    const dados = { ...identificacaoDaChegada(PEDIDO), nascimento: '1990-05-02', sexo: 'F' as const, cidade: 'Fortaleza', uf: 'CE' }
    expect(lembrarHoje({ ...NA_CONSULTA, formulario: { dados, respostas: {}, fotos: [], recebidoEm: '' } }, '2026-11-20')).toBe(false)
  })

  it('mensagem: hoje, médico, hora e o link', () => {
    expect(mensagemDoLembrete(NA_CONSULTA, MEDICO_EXEMPLO, 'https://x.trycloudflare.com')).toBe(
      'Olá, Maria! Hoje é a sua consulta com Dra. Ana Souza, às 10h (presencial). Se puder, preencha o formulário antes. Leva poucos minutos: '
      + 'https://x.trycloudflare.com/formulario/tok123',
    )
  })
})

describe('Confirmar', () => {
  it('mensagem: primeiro nome, médico, dia, hora e modalidade', () => {
    expect(mensagemDaConfirmacao(PEDIDO, MEDICO_EXEMPLO)).toBe(
      'Olá, Maria! Sua consulta com Dra. Ana Souza está confirmada: sexta-feira, 20 de novembro, às 10h (presencial).',
    )
  })
})

describe('Avisar (não vai poder atender)', () => {
  it('mensagem: dia, hora e o link da página de agendar', () => {
    expect(mensagemDoAviso(PEDIDO, MEDICO_EXEMPLO, 'https://x.trycloudflare.com')).toBe(
      'Olá, Maria! Infelizmente não será possível atender sexta-feira, 20 de novembro, às 10h. '
      + 'Escolha outro horário: https://x.trycloudflare.com/medico/ana-souza',
    )
  })
})

const RETORNO: RetornoNaAgenda = {
  id: 'r1', pacienteId: 'pac1', pacienteNome: 'João Lima', consultaOrigemId: 'c1', data: '2026-11-20', inicio: '14:00', modalidade: 'online',
}

describe('cartão "Retorno" na agenda (abrir o cartão é a parte 2)', () => {
  it('atendimentoDoRetorno: tipo retorno, hora, modalidade, nome; não é pedido', () => {
    const at = atendimentoDoRetorno(RETORNO, AGORA)
    expect(at).toMatchObject({
      id: 'retorno-r1', inicio: '14:00', tipo: 'retorno', modalidade: 'online', pagamento: '',
      paciente: { id: 'pac1', nome: 'João Lima' }, atendido: false, temHistorico: true, retornoMarcado: { id: 'r1' },
    })
    expect(at.pedido).toBeUndefined()
  })
  it('o que vem da consulta de origem: aceite da gravação e alergias (o retorno não tem ficha própria)', () => {
    expect(atendimentoDoRetorno(RETORNO, AGORA).gravacaoAutorizada).toBeUndefined()
    const origem = { gravacaoAutorizada: true, alergias: [{ substancia: 'Penicilina', reacao: 'urticária' }] }
    expect(atendimentoDoRetorno(RETORNO, AGORA, origem)).toMatchObject({ gravacaoAutorizada: true, alergiasDoProntuario: origem.alergias })
    expect(atendimentoDoRetorno(RETORNO, AGORA, { gravacaoAutorizada: false, alergias: [] }).gravacaoAutorizada).toBe(false)
  })
  it('o nascimento vem do cadastro do paciente (o cartão não traz), para a idade não sair NaN', () => {
    expect(atendimentoDoRetorno(RETORNO, AGORA).paciente.nascimento).toBe('')
    expect(atendimentoDoRetorno(RETORNO, AGORA, { gravacaoAutorizada: true, alergias: [], nascimento: '1990-05-02' }).paciente.nascimento).toBe('1990-05-02')
  })
  it('retorno de dia que já passou aparece como atendido', () => {
    expect(atendimentoDoRetorno({ ...RETORNO, data: '2026-11-10' }, AGORA).atendido).toBe(true)
  })
  it('juntarRetornos: só os do dia, ordenados com os outros por horário; o retorno ocupa o horário do exemplo', () => {
    const exemplo = (inicio: string): Atendimento => ({ ...atendimentoDoPedido(PEDIDO, AGORA), id: `ex-${inicio}`, inicio, pedido: undefined })
    const lista = juntarRetornos([exemplo('14:00'), exemplo('09:00')], [RETORNO, { ...RETORNO, id: 'r2', data: '2026-11-21' }], '2026-11-20', AGORA)
    expect(lista.map((x) => x.id)).toEqual(['ex-09:00', 'retorno-r1'])
  })
})
