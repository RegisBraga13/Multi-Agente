// Tradução dos anexos enviados entre a tela e o servidor. Funções puras, sem rede e sem React.
// Só o anexo ENVIADO é gravado (o servidor guarda um documento por tipo e não sabe apagar): rascunho, revisão e
// assinatura ficam só na tela.
import type { DocumentoServidor } from '../servidor/consulta'
import type { Anexo, TipoAnexo } from './anexos'
import { registroDoAnexo } from './prontuario'

/** O anexo como o servidor o guarda: enviado, com o texto exato e o resumo do atestado/laudo (os demais, sem registro). */
export const documentoParaServidor = (a: Anexo): DocumentoServidor => ({ tipo: a.tipo, estado: 'enviado', texto: a.texto, registro: registroDoAnexo(a) })

/** Consulta retomada: o que o servidor guardou como enviado volta como enviado, com o texto que foi enviado. */
export function aplicarDocumentos(anexos: Anexo[], docs: DocumentoServidor[]): Anexo[] {
  return anexos.map((a) => {
    const d = docs.find((x) => x.tipo === a.tipo && x.estado === 'enviado')
    return d ? { ...a, estado: 'enviado', emitir: true, texto: d.texto, textoIA: d.texto } : a
  })
}

/** O anexo do tipo não estava enviado e agora está (é a hora de gravar no servidor). */
export const virouEnviado = (antes: Anexo[], depois: Anexo[], tipo: TipoAnexo): boolean =>
  antes.find((a) => a.tipo === tipo)?.estado !== 'enviado' && depois.find((a) => a.tipo === tipo)?.estado === 'enviado'
