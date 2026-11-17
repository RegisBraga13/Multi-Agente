// Diagnósticos diferenciais: sugeridos SÓ a partir da história clínica salva (Constituição, fase 3).
// Simulação da IA: cada hipótese de exemplo tem pistas; a pista só vale se estiver na história salva,
// citando o trecho. Sem nenhuma pista a favor, a hipótese não é sugerida (evidência obrigatória).
import type { SecaoHistoria } from './historia'
import { EXTRAS, MODELOS } from './diagnosticos-exemplo'

export type Evidencia = { lado: 'favor' | 'contra'; texto: string; /** rótulo da seção da história */ secao: string; /** frase da história que justifica */ trecho: string }
/** `pct` = sinal da IA para ordenar (a calibrar com uso real); null no diagnóstico do médico */
export type Hipotese = { id: string; nome: string; cid: string; pct: number | null; evidencias: Evidencia[] }
export type NaoPerder = { nome: string; cid: string; porque: string; como: string }
export type Decisao = 'pendente' | 'confirmada' | 'descartada'
/** `aviso`: sugestão ao lado de uma decisão do médico (a IA nunca muda a decisão dele) */
export type Aviso = { tipo: 'mudou'; antes: number | null } | { tipo: 'saiu' }
export type ItemDD = { hip: Hipotese; decisao: Decisao; propria: boolean; /** a IA (re)escreveu nesta versão */ mudou: boolean; aviso: Aviso | null }

/** Frase da seção que contém o termo (sempre um trecho literal da história). */
function trechoCom(texto: string, termo: RegExp): string | null {
  return texto.split(/(?<=\.)\s+/).find((f) => termo.test(f))?.trim() ?? null
}

export function montarDiagnosticos(slug: string, paciente: string, historia: SecaoHistoria[]): { hipoteses: Hipotese[]; naoPerder: NaoPerder | null } {
  const modelo = slug === 'dermatologia' ? MODELOS[paciente] : undefined
  if (!modelo) return { hipoteses: [], naoPerder: null }
  const textoDe = (secao: string) => historia.find((s) => s.rotulo === secao)?.texto ?? ''

  const hipoteses = [...modelo.hipoteses, ...(EXTRAS[paciente] ?? [])].flatMap((m): Hipotese[] => {
    const evidencias = m.pistas.flatMap((p): Evidencia[] => {
      const trecho = trechoCom(textoDe(p.secao), p.termo)
      return trecho ? [{ lado: p.lado, texto: p.texto, secao: p.secao, trecho }] : []
    })
    const conta = (lado: Evidencia['lado']) => [evidencias.filter((e) => e.lado === lado).length, m.pistas.filter((p) => p.lado === lado).length]
    const [favor, favorTotal] = conta('favor')
    const [contra, contraTotal] = conta('contra')
    if (favor === 0) return []
    // menos pistas a favor → menor; pista contra que sumiu → maior
    const fator = (0.5 + 0.5 * (favor / favorTotal)) * (contraTotal ? 1.25 - 0.25 * (contra / contraTotal) : 1)
    return [{ id: m.id, nome: m.nome, cid: m.cid, pct: Math.min(99, Math.max(1, Math.round(m.base * fator))), evidencias }]
  })
  return { hipoteses: hipoteses.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)), naoPerder: modelo.naoPerder }
}

export function primeirosItens(hipoteses: Hipotese[]): ItemDD[] {
  return hipoteses.map((hip) => ({ hip, decisao: 'pendente', propria: false, mudou: true, aviso: null }))
}

/** Aparecem logo 3 hipóteses; o médico chama mais, uma por vez, pelo "+" (até 3 a mais). */
export const INICIAIS = 3
export const MAX_EXTRAS = 3
/** `reserva`: hipóteses que a IA já tem e que o "+" mostra, na ordem */
export type Diferenciais = { itens: ItemDD[]; reserva: Hipotese[] }

export function iniciarDiagnosticos(hipoteses: Hipotese[]): Diferenciais {
  return { itens: primeirosItens(hipoteses.slice(0, INICIAIS)), reserva: hipoteses.slice(INICIAIS, INICIAIS + MAX_EXTRAS) }
}

/** "+": a próxima hipótese da reserva entra depois das da IA (as do médico ficam no fim). */
export function chamarMais({ itens, reserva }: Diferenciais): Diferenciais {
  const [hip, ...resto] = reserva
  if (!hip) return { itens, reserva }
  const nova: ItemDD = { hip, decisao: 'pendente', propria: false, mudou: false, aviso: null }
  return { itens: [...itens.filter((x) => !x.propria), nova, ...itens.filter((x) => x.propria)], reserva: resto }
}

/**
 * História salva de novo: as hipóteses que já estavam à mostra seguem à mostra (atualizadas);
 * se faltar, completa até 3 com as mais prováveis; o resto volta para a reserva do "+".
 */
export function atualizarComReserva(itens: ItemDD[], novas: Hipotese[]): Diferenciais {
  const vistas = new Set(itens.filter((x) => !x.propria).map((x) => x.hip.id))
  const ficam = novas.filter((h) => vistas.has(h.id))
  const entram = novas.filter((h) => !vistas.has(h.id)).slice(0, Math.max(0, INICIAIS - ficam.length))
  const mostrar = novas.filter((h) => ficam.includes(h) || entram.includes(h))
  const reserva = novas.filter((h) => !mostrar.includes(h)).slice(0, Math.max(0, INICIAIS + MAX_EXTRAS - mostrar.length))
  return { itens: atualizarDiagnosticos(itens, mostrar), reserva }
}

const igual = (a: Hipotese, b: Hipotese) => JSON.stringify([a.pct, a.evidencias]) === JSON.stringify([b.pct, b.evidencias])

/**
 * A história mudou e foi salva de novo: a IA não refaz tudo. Por hipótese:
 * - igual → fica como está (com a decisão do médico);
 * - mudou e o médico não tinha decidido → a IA reescreve (mudou = true);
 * - mudou e o médico tinha decidido → a decisão fica; aviso ao lado para ele manter ou rever;
 * - a IA não sugere mais → some se ninguém decidiu; se o médico decidiu, fica com aviso;
 * - diagnóstico do próprio médico → nunca é tocado.
 */
export function atualizarDiagnosticos(itens: ItemDD[], novas: Hipotese[]): ItemDD[] {
  const daIA = itens.filter((x) => !x.propria)
  const atualizadas = novas.map((hip): ItemDD => {
    const antes = daIA.find((x) => x.hip.id === hip.id)
    if (!antes) return { hip, decisao: 'pendente', propria: false, mudou: true, aviso: null }
    if (igual(antes.hip, hip)) return { ...antes, hip, mudou: false }
    if (antes.decisao === 'pendente') return { ...antes, hip, mudou: true, aviso: null }
    return { ...antes, hip, mudou: false, aviso: { tipo: 'mudou', antes: antes.aviso?.tipo === 'mudou' ? antes.aviso.antes : antes.hip.pct } }
  })
  const sairam = daIA
    .filter((x) => x.decisao !== 'pendente' && !novas.some((h) => h.id === x.hip.id))
    .map((x): ItemDD => ({ ...x, mudou: false, aviso: { tipo: 'saiu' } }))
  return [...atualizadas, ...sairam, ...itens.filter((x) => x.propria)]
}

/** O que impede salvar (null = pode salvar). Mostrado só depois de uma tentativa. */
export function pendenciasDiagnosticos(itens: ItemDD[], naoPerderAvaliado: boolean): string | null {
  const avisos = itens.filter((x) => x.aviso).length
  if (avisos) return `Falta decidir ${avisos} ${avisos === 1 ? 'sugestão' : 'sugestões'}`
  if (!naoPerderAvaliado) return 'Avalie o "não pode perder"'
  if (!itens.some((x) => x.decisao === 'confirmada')) return 'Confirme ao menos um diagnóstico'
  return null
}
