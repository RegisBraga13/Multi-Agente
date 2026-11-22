import { describe, expect, it } from 'vitest'
import { estadoDoServidor, soAlergias, editar, inicial, oficializar, pendenciasAnamnese, podeOficializar, podeGravar, responderAlerta, situacaoDaEtapa } from './etapas'
import type { EstadoConsulta } from './tipos'

const tudoOficializado = (): EstadoConsulta =>
  (['anamnese', 'exame', 'historia', 'diagnosticos', 'conduta'] as const).reduce((e, b) => oficializar(e, b), inicial([]))

describe('etapas da consulta', () => {
  it('começa com a página 1 em rascunho e a história aguardando', () => {
    const e = inicial([])
    expect(situacaoDaEtapa(e, 'anamnese-exame')).toBe('rascunho_ia')
    expect(situacaoDaEtapa(e, 'historia')).toBe('bloqueado')
    expect(situacaoDaEtapa(e, 'diagnosticos')).toBe('bloqueado')
  })

  it('a história só libera com anamnese e exame oficializados', () => {
    const so = oficializar(inicial([]), 'anamnese')
    expect(situacaoDaEtapa(so, 'historia')).toBe('bloqueado')
    expect(situacaoDaEtapa(so, 'anamnese-exame')).toBe('rascunho_ia')
    const ambos = oficializar(so, 'exame')
    expect(situacaoDaEtapa(ambos, 'anamnese-exame')).toBe('oficializado')
    expect(situacaoDaEtapa(ambos, 'historia')).toBe('rascunho_ia')
  })

  it('editar a anamnese depois de oficializada desatualiza as etapas seguintes', () => {
    const e = editar(tudoOficializado(), 'anamnese')
    expect(situacaoDaEtapa(e, 'anamnese-exame')).toBe('revisado_medico')
    expect(situacaoDaEtapa(e, 'historia')).toBe('desatualizado')
    expect(situacaoDaEtapa(e, 'diagnosticos')).toBe('desatualizado')
    expect(situacaoDaEtapa(e, 'conduta')).toBe('desatualizado')
  })

  it('editar um rascunho não desatualiza nada', () => {
    const e = editar(inicial([]), 'exame')
    expect(e.blocos.exame.estado).toBe('revisado_medico')
    expect(e.blocos.historia.desatualizado).toBe(false)
  })

  it('oficializar de novo tira o "desatualizado" do próprio bloco', () => {
    const editado = editar(tudoOficializado(), 'exame')
    expect(situacaoDaEtapa(editado, 'historia')).toBe('desatualizado')
    const e = oficializar(oficializar(editado, 'exame'), 'historia')
    expect(situacaoDaEtapa(e, 'historia')).toBe('oficializado')
    expect(situacaoDaEtapa(e, 'diagnosticos')).toBe('desatualizado')
  })

  it('conta os sinais de alerta sem resposta', () => {
    let e = inicial(['a', 'b'])
    expect(pendenciasAnamnese(e)).toBe(2)
    e = responderAlerta(e, 'a', 'f')
    expect(pendenciasAnamnese(e)).toBe(1)
    e = responderAlerta(e, 'b', 'v')
    expect(pendenciasAnamnese(e)).toBe(0)
  })
})

describe('fase alcançada não some', () => {
  it('história já liberada fica desatualizada (não bloqueada) quando a anamnese é editada', () => {
    const pag1 = oficializar(oficializar(inicial([]), 'anamnese'), 'exame')
    expect(situacaoDaEtapa(pag1, 'historia')).toBe('rascunho_ia')
    const e = editar(pag1, 'anamnese')
    expect(situacaoDaEtapa(e, 'historia')).toBe('desatualizado')
    expect(podeOficializar(e, 'historia')).toBe(false)
    expect(situacaoDaEtapa(oficializar(e, 'anamnese'), 'historia')).toBe('rascunho_ia')
  })
  it('fase nunca alcançada continua bloqueada', () => {
    expect(situacaoDaEtapa(editar(inicial([]), 'anamnese'), 'historia')).toBe('bloqueado')
  })
})

describe('podeOficializar', () => {
  it('etapa seguinte só com a anterior oficializada e em dia', () => {
    expect(podeOficializar(inicial([]), 'historia')).toBe(false)
    const pag1 = oficializar(oficializar(inicial([]), 'anamnese'), 'exame')
    expect(podeOficializar(pag1, 'historia')).toBe(true)
    expect(podeOficializar(pag1, 'diagnosticos')).toBe(false)
  })
  it('história desatualizada não pode ser oficializada enquanto o exame editado não for oficializado de novo', () => {
    const e = editar(tudoOficializado(), 'exame')
    expect(podeOficializar(e, 'historia')).toBe(false)
    expect(podeOficializar(oficializar(e, 'exame'), 'historia')).toBe(true)
  })
  it('diagnósticos não oficializam sobre história desatualizada', () => {
    const e = editar(tudoOficializado(), 'anamnese')
    expect(podeOficializar(oficializar(e, 'anamnese'), 'diagnosticos')).toBe(false)
  })
})

describe('podeGravar', () => {
  const pronta = { situacao: 'pronta' as const, recebidaAs: '07:00', sexo: 'F' as const, estadoCivil: '' as const, profissao: '', queixa: '', emUso: [], antecedentes: [], alergias: [] }
  it('só com ficha pronta e transcrição aceita', () => {
    expect(podeGravar({ ...pronta, transcricao: 'aceita' })).toBe(true)
    expect(podeGravar({ ...pronta, transcricao: 'recusada' })).toBe(false)
    expect(podeGravar({ situacao: 'link-enviado' })).toBe(false)
    expect(podeGravar({ situacao: 'sem-ficha' })).toBe(false)
  })
})


describe('soAlergias (a página 1 não pergunta mais os sinais de alerta)', () => {
  it('deixa só as alergias, na mesma ordem', () => {
    const alertas = [{ id: 'alergia-0', tipo: 'alergia' }, { id: 'sinal-0', tipo: 'sinal' }, { id: 'alergia-1', tipo: 'alergia' }]
    expect(soAlergias(alertas).map((a) => a.id)).toEqual(['alergia-0', 'alergia-1'])
  })
  it('sem alergia a lista fica vazia', () => {
    expect(soAlergias([{ id: 'sinal-0', tipo: 'sinal' }])).toEqual([])
  })
})


describe('estadoDoServidor (retomar a consulta de onde parou)', () => {
  const b = (etapa: string, estado: 'rascunho_ia' | 'revisado_medico' | 'oficializado', desatualizado = false) => ({ etapa, estado, desatualizado })
  const todasSalvas = ['anamnese', 'exame', 'historia', 'diagnosticos', 'conduta'].map((e) => b(e, 'oficializado'))

  it('sem blocos no servidor, nada muda', () => {
    expect(estadoDoServidor(inicial([]), [])).toEqual(inicial([]))
  })
  it('as 5 etapas salvas: a consulta continua nos Anexos, e o Prontuário segue bloqueado', () => {
    const e = estadoDoServidor(inicial([]), todasSalvas)
    expect(situacaoDaEtapa(e, 'anamnese-exame')).toBe('oficializado')
    expect(situacaoDaEtapa(e, 'historia')).toBe('oficializado')
    expect(situacaoDaEtapa(e, 'conduta')).toBe('oficializado')
    expect(situacaoDaEtapa(e, 'anexos')).toBe('rascunho_ia')
    expect(situacaoDaEtapa(e, 'prontuario')).toBe('bloqueado')
    expect(podeOficializar(e, 'anexos')).toBe(true)
  })
  it('só a página 1 salva e a história ainda rascunho: a história está liberada e os diagnósticos bloqueados', () => {
    const e = estadoDoServidor(inicial([]), [b('anamnese', 'oficializado'), b('exame', 'oficializado'), b('historia', 'rascunho_ia')])
    expect(situacaoDaEtapa(e, 'historia')).toBe('rascunho_ia')
    expect(situacaoDaEtapa(e, 'diagnosticos')).toBe('bloqueado')
  })
  it('etapa desatualizada continua desatualizada', () => {
    const e = estadoDoServidor(inicial([]), [b('anamnese', 'oficializado'), b('exame', 'oficializado'), b('historia', 'oficializado', true)])
    expect(situacaoDaEtapa(e, 'historia')).toBe('desatualizado')
  })
  it('etapa alcançada antes e depois desatualizada não volta a "bloqueada"', () => {
    const e = estadoDoServidor(inicial([]), [b('anamnese', 'revisado_medico'), b('exame', 'oficializado'), b('historia', 'oficializado')])
    expect(situacaoDaEtapa(e, 'historia')).toBe('desatualizado')
  })
  it('bloco de etapa que a tela não controla é ignorado', () => {
    expect(estadoDoServidor(inicial([]), [b('qualquer', 'oficializado')])).toEqual(inicial([]))
  })
})
