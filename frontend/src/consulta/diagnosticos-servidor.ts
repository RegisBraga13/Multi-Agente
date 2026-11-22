// Tradução dos diagnósticos entre o servidor e a tela. Funções puras, sem rede e sem React.
// A lógica de decisão, reserva do "+", avisos e atualização continua toda em `diagnosticos.ts`.
import type { DiagnosticosServidor, HipoteseServidor, ItemDDServidor } from '../servidor/consulta'
import type { Hipotese, ItemDD } from './diagnosticos'
import { CHAVE_DA_SECAO, ROTULO_DA_SECAO } from './historia-servidor'

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Estável entre gerações: a mesma hipótese (CID + nome) tem sempre o mesmo id, e é assim que a decisão do médico a acompanha. */
export function idDaHipotese(h: { nome: string; cid: string }): string {
  return `${h.cid.toLowerCase()}-${semAcento(h.nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

const daIa = (h: HipoteseServidor): Hipotese => ({
  id: idDaHipotese(h), nome: h.nome, cid: h.cid, pct: h.pct,
  evidencias: h.evidencias.map((e) => ({ ...e, secao: ROTULO_DA_SECAO[e.secao] ?? e.secao })),
})

/** As hipóteses que a IA sugeriu (o diagnóstico do médico não entra: a IA nunca o toca). */
export const hipotesesDoServidor = (b: DiagnosticosServidor): Hipotese[] => b.itens.filter((i) => !i.propria).map((i) => daIa(i.hipotese))

/** Todos os itens como o servidor guardou, com a decisão salva (volta como rascunho, sem avisos). */
export const itensDoServidor = (b: DiagnosticosServidor): ItemDD[] =>
  b.itens.map((i) => ({ hip: daIa(i.hipotese), decisao: i.decisao, propria: i.propria, mudou: false, aviso: null }))

/** `base`: o último bloco que o servidor devolveu (dele vêm a certeza de cada hipótese, o "não pode perder" e o "rastrear"). */
export function diagnosticosParaServidor(itens: ItemDD[], base: DiagnosticosServidor | null): DiagnosticosServidor {
  const certezaDe = (id: string) => base?.itens.find((i) => idDaHipotese(i.hipotese) === id)?.hipotese.certeza ?? 'hipotese'
  const paraItem = (x: ItemDD): ItemDDServidor => ({
    hipotese: x.propria
      ? { nome: x.hip.nome, cid: x.hip.cid, certeza: 'clinico', pct: null, evidencias: [] }
      : { nome: x.hip.nome, cid: x.hip.cid, certeza: certezaDe(x.hip.id), pct: x.hip.pct, evidencias: x.hip.evidencias.map((e) => ({ ...e, secao: CHAVE_DA_SECAO[e.secao] ?? e.secao })) },
    decisao: x.decisao,
    propria: x.propria,
  })
  return { itens: itens.map(paraItem), naoPodePerder: base?.naoPodePerder ?? null, rastrear: base?.rastrear ?? [] }
}
