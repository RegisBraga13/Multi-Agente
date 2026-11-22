import { describe, expect, it } from 'vitest'
import type { DocumentoServidor } from '../servidor/consulta'
import { atualizarAnexos, type Anexo, type TipoAnexo } from './anexos'
import { aplicarDocumentos, documentoParaServidor, virouEnviado } from './anexos-servidor'

const anexo = (tipo: TipoAnexo, extra: Partial<Anexo> = {}): Anexo => ({
  tipo, titulo: tipo, texto: `Texto da ${tipo}.`, base: `Texto da ${tipo}.`, textoIA: `Texto da ${tipo}.`, emitir: true, assinatura: false, estado: 'revisado', ...extra,
})

describe('documentoParaServidor', () => {
  it('receita: enviada, com o texto exato e sem registro', () => {
    expect(documentoParaServidor(anexo('receita', { texto: 'USO TÓPICO\n1. Clobetasol' }))).toEqual({ tipo: 'receita', estado: 'enviado', texto: 'USO TÓPICO\n1. Clobetasol', registro: null })
  })
  it('atestado com período leva as datas e o resumo', () => {
    const d = documentoParaServidor(anexo('atestado', { periodo: { de: '2026-11-13', ate: '2026-11-15' } }))
    expect(d.registro).toEqual({ tipo: 'atestado', de: '2026-11-13', ate: '2026-11-15', resumo: 'de 13/11 a 15/11/2026.' })
  })
  it('atestado sem período é só comparecimento', () => {
    const d = documentoParaServidor(anexo('atestado', { periodo: { de: '', ate: '' } }))
    expect(d.registro).toEqual({ tipo: 'atestado', de: null, ate: null, resumo: 'comparecimento à consulta.' })
  })
  it('laudo leva a finalidade escolhida', () => {
    const d = documentoParaServidor(anexo('laudo', { finalidade: { tipo: 'inss', outra: '' } }))
    expect(d.registro).toEqual({ tipo: 'laudo', finalidade: 'para o INSS', resumo: 'para o INSS.' })
  })
  it('exames, encaminhamento e orientações não levam registro', () => {
    for (const t of ['exames', 'encaminhamento', 'orientacoes'] as const) expect(documentoParaServidor(anexo(t)).registro).toBeNull()
  })
})

describe('aplicarDocumentos (retomar a consulta)', () => {
  const docs: DocumentoServidor[] = [
    { tipo: 'receita', estado: 'enviado', texto: 'Receita como foi enviada.', registro: null },
    { tipo: 'atestado', estado: 'revisado', texto: 'Não deveria voltar.', registro: null },
  ]
  it('marca como enviado só o tipo que o servidor guardou enviado, com o texto dele', () => {
    const r = aplicarDocumentos([anexo('receita', { estado: 'rascunho', emitir: false }), anexo('atestado', { estado: 'rascunho' }), anexo('exames')], docs)
    expect(r[0]).toMatchObject({ tipo: 'receita', estado: 'enviado', emitir: true, texto: 'Receita como foi enviada.', textoIA: 'Receita como foi enviada.' })
    expect(r[1].estado).toBe('rascunho')
    expect(r[2]).toEqual(anexo('exames'))
  })
  it('ida e volta: o anexo enviado volta igual', () => {
    const enviado = anexo('receita', { estado: 'enviado', texto: 'Receita final.', textoIA: 'Receita final.', base: 'Receita final.' })
    expect(aplicarDocumentos([anexo('receita', { estado: 'rascunho' })], [documentoParaServidor(enviado)])[0]).toMatchObject({ estado: 'enviado', texto: 'Receita final.', emitir: true })
  })
  it('documento sem anexo correspondente é ignorado', () => {
    expect(aplicarDocumentos([anexo('exames')], docs)).toEqual([anexo('exames')])
  })
})

describe('virouEnviado', () => {
  it('é verdadeiro só na passagem de não enviado para enviado', () => {
    const antes = [anexo('receita', { estado: 'revisado' })]
    expect(virouEnviado(antes, [anexo('receita', { estado: 'enviado' })], 'receita')).toBe(true)
    expect(virouEnviado(antes, [anexo('receita', { estado: 'assinado' })], 'receita')).toBe(false)
    expect(virouEnviado([anexo('receita', { estado: 'enviado' })], [anexo('receita', { estado: 'enviado' })], 'receita')).toBe(false)
  })
})

describe('conduta refeita depois de enviar um anexo', () => {
  it('o anexo enviado, cuja base não mudou, não é refeito nem perdido', () => {
    const enviado = anexo('receita', { estado: 'enviado', texto: 'Receita final.' })
    const refeitos = atualizarAnexos([enviado, anexo('exames')], [anexo('receita'), anexo('exames')])
    expect(refeitos[0]).toEqual(enviado)
    expect(aplicarDocumentos(refeitos, [documentoParaServidor(enviado)])[0]).toMatchObject({ estado: 'enviado', texto: 'Receita final.' })
  })
})
