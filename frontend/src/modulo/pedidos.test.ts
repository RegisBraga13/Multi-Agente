import { describe, expect, it } from 'vitest'
import { MEDICO_EXEMPLO } from '../medico/exemplo'
import type { PedidoNaAgenda } from '../servidor/agenda'
import { atendimentoDoPedido, juntarPedidos, mensagemDoFormulario } from './pedidos'
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
          nomeCompleto: 'Maria Teste da Silva', nascimento: '1990-05-02', sexo: 'F', whatsapp: '', email: '', cidade: 'Fortaleza', uf: 'CE',
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
        dados: { nomeCompleto: 'Maria', nascimento: '1990-05-02', sexo: 'F', whatsapp: '', email: '', cidade: 'X', uf: 'CE', estadoCivil: '', profissao: '', trabalhoExposto: '' },
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
