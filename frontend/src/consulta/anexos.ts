// Receita e anexos (página 5, o fim da consulta): a IA monta os documentos SÓ a partir da conduta salva.
// O médico escolhe quais emitir, abre, edita e revisa; assina (só os que exigem) e envia ao paciente.
// Assinatura e envio são simulação nesta fase. Quais documentos exigem certificado digital segue regras
// do CFM que o autor vai mandar antes do deploy — a lista abaixo é provisória.
import { KIT_ROTINA, OUTRO, type Conduta, type ItemReceita } from './conduta'

export type TipoAnexo = 'receita' | 'exames' | 'encaminhamento' | 'orientacoes' | 'atestado' | 'laudo'
/** rascunho → revisado → assinado (só se exige) → enviado. Editar o texto volta a rascunho (a assinatura cai). */
export type EstadoAnexo = 'rascunho' | 'revisado' | 'assinado' | 'enviado'

/**
 * `textoIA`: o que a IA escreveu (para saber se mudou numa nova versão da conduta); `texto`: o que vale.
 * `emitir`: o médico escolheu emitir (os montados da conduta vêm escolhidos; atestado e laudo, não).
 */
export type Anexo = { tipo: TipoAnexo; titulo: string; texto: string; textoIA: string; emitir: boolean; assinatura: boolean; estado: EstadoAnexo }

/** PROVISÓRIO até as regras do CFM: documentos que pedem assinatura com certificado digital. */
export const PRECISA_ASSINATURA: Record<TipoAnexo, boolean> = {
  receita: true, exames: false, encaminhamento: false, orientacoes: false, atestado: true, laudo: true,
}

const TITULO: Record<TipoAnexo, string> = {
  receita: 'Receita', exames: 'Pedido de exames', encaminhamento: 'Encaminhamento', orientacoes: 'Orientações', atestado: 'Atestado', laudo: 'Laudo',
}

/** Dados da consulta que entram nos documentos. `data` 'DD/MM/AAAA', `hora` 'HH:MM'. */
export type DadosConsulta = { paciente: string; idade: number; data: string; hora: string }

const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const rotulos = (c: Conduta, linha: string) =>
  (c.escolha[linha] ?? []).flatMap((id) => c.grupos?.flatMap((g) => g.linhas).find((l) => l.id === linha)?.opcoes.find((o) => o.id === id && o.id !== 'outro')?.rotulo ?? [])

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

/** Número por extenso (1 a 999), concordando com a unidade: 1 → um/uma, 2 → dois/duas, 200 → duzentos/duzentas. */
export function extenso(n: number, feminino = false): string {
  const fem = (x: string) => (feminino ? x.replace(/^um$/, 'uma').replace(/^dois$/, 'duas').replace(/entos$/, 'entas') : x)
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100), r = n % 100, d = Math.floor(r / 10), u = r % 10
  const resto = r < 20 ? (r ? fem(UNIDADES[r]) : '') : [DEZENAS[d], u ? fem(UNIDADES[u]) : ''].filter(Boolean).join(' e ')
  return [c ? fem(CENTENAS[c]) : '', resto].filter(Boolean).join(' e ')
}

/**
 * Um item da receita em 2 linhas: nome (DCB) + concentração [+ forma] (quantidade abreviada, 2 dígitos); posologia — tempo.
 * A forma (sigla) só aparece fora dos parênteses quando a quantidade não a traz: "Limeciclina 300mg (56 CAP)",
 * "Adapaleno 0,1% GEL (01 bisn. 30g)". Por extenso só nos controlados: "(30 CAP — trinta)".
 */
export function linhaReceita(n: number, x: ItemReceita): string {
  const q = x.quantidade
  const forma = q.unidade.includes(x.forma) ? '' : ` ${x.forma}`
  const qtd = `${String(q.n).padStart(2, '0')} ${q.unidade}${x.controlado ? ` — ${extenso(q.n, q.feminino)}` : ''}`
  return `${n}. ${x.nome}${x.concentracao ? ` ${x.concentracao}` : ''}${forma} (${qtd})\n   ${x.posologia.replace(/\.$/, '')} — ${x.duracao}`
}

/**
 * Receita a partir das opções marcadas na conduta salva (cuidados e tópico = uso tópico; sistêmico = uso oral).
 * O "Outro" escrito pelo médico entra como item livre na seção do grupo. Numeração seguida.
 */
function montarReceita(c: Conduta): string {
  const secoes: Record<ItemReceita['via'], string[]> = { topico: [], oral: [] }
  let n = 0
  for (const [linha, via] of [['cuidados', 'topico'], ['topico', 'topico'], ['sistemico', 'oral']] as const) {
    const l = c.grupos?.flatMap((g) => g.linhas).find((x) => x.id === linha)
    for (const o of l?.opcoes.filter((x) => c.escolha[linha]?.includes(x.id)) ?? []) {
      if (o.id === OUTRO) { if (c.outros[linha]?.trim()) secoes[via].push(`${++n}. ${c.outros[linha].trim()}`); continue }
      for (const it of o.receita ?? []) secoes[it.via].push(linhaReceita(++n, it))
    }
  }
  return [secoes.topico.length ? ['USO TÓPICO (EXTERNO)', ...secoes.topico].join('\n') : '', secoes.oral.length ? ['USO ORAL', ...secoes.oral].join('\n') : '']
    .filter(Boolean).join('\n\n')
}

/** Monta os anexos a partir da conduta salva (grupos: 0 cuidados, 1 tópico, 2 sistêmico, 3 orientações). */
export function montarAnexos(c: Conduta, d: DadosConsulta): Anexo[] {
  const t = c.textos.map((x) => x.trim())
  const dx = `${c.diagnostico.nome}${c.diagnostico.cid ? ` (CID 10 ${c.diagnostico.cid})` : ''}`
  const docs: [TipoAnexo, string, boolean][] = []

  // receita: dos itens estruturados das opções marcadas (sem modelo, o médico escreve)
  const receita = montarReceita(c)
  if (receita) docs.push(['receita', receita, true])

  // pedido de exames: o kit de rotina (se marcado) + os exames do caso
  const exames = [...((c.escolha.kit ?? []).length ? KIT_ROTINA : []), ...rotulos(c, 'exames').map((x) => x.toLowerCase())]
  if (exames.length) docs.push(['exames', `Solicito: ${lista(exames)}.\nIndicação clínica: ${dx}.`, true])

  const especialistas = rotulos(c, 'encaminhamento').map((x) => x.toLowerCase())
  if (especialistas.length) docs.push(['encaminhamento', `Encaminho para avaliação em ${lista(especialistas)}.\nPaciente de ${d.idade} anos, com ${dx}.${t[1] || t[2] ? `\nTratamento atual: ${[t[1], t[2]].filter(Boolean).join(' ')}` : ''}`, true])

  if (t[3]) docs.push(['orientacoes', t[3], true])

  // o médico decide se emite
  docs.push(['atestado', `Atesto, para os devidos fins, que ${d.paciente} esteve em consulta médica em ${d.data}, às ${d.hora}.`, false])
  docs.push(['laudo', `Paciente de ${d.idade} anos, em acompanhamento por ${dx}.${t[1] || t[2] ? `\nConduta: ${[t[1], t[2]].filter(Boolean).join(' ')}` : ''}`, false])

  return docs.map(([tipo, texto, emitir]) => ({ tipo, titulo: TITULO[tipo], texto, textoIA: texto, emitir, assinatura: PRECISA_ASSINATURA[tipo], estado: 'rascunho' }))
}

/** Conduta salva de novo: o anexo cujo texto da IA não mudou fica como está (com a edição e o estado); o resto é refeito. */
export function atualizarAnexos(antes: Anexo[], novos: Anexo[]): Anexo[] {
  return novos.map((n) => {
    const a = antes.find((x) => x.tipo === n.tipo)
    return a && a.textoIA === n.textoIA ? a : a ? { ...n, emitir: a.emitir } : n
  })
}

const no = (xs: Anexo[], tipo: TipoAnexo, f: (a: Anexo) => Anexo) => xs.map((a) => (a.tipo === tipo ? f(a) : a))

/** Escolher/retirar da emissão. Um já enviado não sai. */
export const alternarEmitir = (xs: Anexo[], tipo: TipoAnexo) => no(xs, tipo, (a) => (a.estado === 'enviado' ? a : { ...a, emitir: !a.emitir }))

/** Editar o texto: volta a rascunho (assinatura cai). Enviado não se edita. */
export const editarAnexo = (xs: Anexo[], tipo: TipoAnexo, texto: string) =>
  no(xs, tipo, (a) => (a.estado === 'enviado' ? a : { ...a, texto, estado: 'rascunho' }))

/** O próximo passo de um anexo escolhido (null = enviado ou não escolhido). */
export function proximoPasso(a: Anexo): 'revisar' | 'assinar' | 'enviar' | null {
  if (!a.emitir || a.estado === 'enviado') return null
  if (a.estado === 'rascunho') return 'revisar'
  if (a.assinatura && a.estado === 'revisado') return 'assinar'
  return 'enviar'
}

/** Dá o próximo passo (revisar → assinar, se exige → enviar). Simulação. */
export function avancar(xs: Anexo[], tipo: TipoAnexo): Anexo[] {
  return no(xs, tipo, (a) => {
    const p = proximoPasso(a)
    if (!p) return a
    if (!a.texto.trim()) return a
    return { ...a, estado: p === 'revisar' ? 'revisado' : p === 'assinar' ? 'assinado' : 'enviado' }
  })
}

/** O que impede finalizar a consulta (null = pode). */
export function pendenciasAnexos(xs: Anexo[]): string | null {
  const faltam = xs.filter((a) => a.emitir && a.estado !== 'enviado').length
  if (faltam) return `Falta enviar ${faltam} ${faltam === 1 ? 'anexo' : 'anexos'}`
  return null
}
