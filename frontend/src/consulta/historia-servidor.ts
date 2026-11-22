// Tradução entre a história do servidor (7 campos) e as seções da tela, e as regras das perguntas contextuais.
// Funções puras, sem rede e sem React. Os rótulos são os que o resto da tela já lê (diagnósticos, resumo, prontuário).
import type { HistoriaServidor, PerguntaServidor, SinalDoCatalogo } from '../servidor/consulta'
import { atualizarHistoria, type SecaoHistoria } from './historia'

type CamposHistoria = HistoriaServidor['historia']
type Campo = keyof CamposHistoria

const ROTULOS: Record<Campo, string> = {
  qp: 'Queixa principal',
  hda: 'História da doença atual',
  ap: 'Antecedentes e alertas',
  hp: 'História pessoal',
  hf: 'História familiar',
  exameFisico: 'Exame físico',
  examesTexto: 'Exames complementares',
}
const ORDEM: Campo[] = ['qp', 'hda', 'ap', 'hp', 'hf', 'exameFisico', 'examesTexto']
/** sempre aparecem, mesmo vazias (o médico pode escrever); história pessoal e familiar só quando houver texto */
const SEMPRE: Campo[] = ['qp', 'hda', 'ap', 'exameFisico', 'examesTexto']

export function secoesDoServidor(h: CamposHistoria): SecaoHistoria[] {
  return ORDEM.filter((c) => SEMPRE.includes(c) || h[c].trim()).map((c) => ({ rotulo: ROTULOS[c], texto: h[c] }))
}

/** `base`: o último bloco que o servidor devolveu (segurança, conflitos e extras seguem como estavam). */
export function historiaParaServidor(secoes: { rotulo: string; texto: string }[], base: HistoriaServidor, perguntas: PerguntaServidor[]): HistoriaServidor {
  const historia = Object.fromEntries(ORDEM.map((c) => [c, secoes.find((s) => s.rotulo === ROTULOS[c])?.texto ?? ''])) as CamposHistoria
  return { ...base, historia, perguntas }
}

/** Como `atualizarHistoria`, mas alinhando as seções pelo rótulo (a história pessoal e a familiar podem aparecer ou sumir). */
export function atualizarSecoes(antes: SecaoHistoria[], atuais: string[], novas: SecaoHistoria[]) {
  const achar = (rotulo: string) => antes.findIndex((s) => s.rotulo === rotulo)
  // seção sem versão anterior: conta como "sem mudança de origem" e entra com o texto novo
  const geradasAlinhadas = novas.map((n) => antes[achar(n.rotulo)] ?? n)
  const atuaisAlinhados = novas.map((n) => (achar(n.rotulo) >= 0 ? atuais[achar(n.rotulo)] : n.texto))
  return atualizarHistoria(geradasAlinhadas, atuaisAlinhados, novas)
}

const renumerar = (lista: PerguntaServidor[]) => lista.map((p, i) => ({ ...p, id: p.id.startsWith('c-') ? p.id : `p${i + 1}` }))

/**
 * As perguntas novas, mantendo a resposta da antiga de mesmo texto (a IA reescreve a lista quando a anamnese muda).
 * As que o médico adicionou do catálogo ficam, a menos que a IA já tenha escrito a mesma pergunta (mesmo sinal ou texto).
 */
export function juntarPerguntas(antigas: PerguntaServidor[], novas: PerguntaServidor[]): PerguntaServidor[] {
  const daIa = novas.map((n) => ({ ...n, resposta: antigas.find((a) => a.texto === n.texto)?.resposta ?? null }))
  const doMedico = antigas.filter((a) => a.id.startsWith('c-') && !daIa.some((n) => n.texto === a.texto || (a.sinalId !== null && n.sinalId === a.sinalId)))
  return renumerar([...daIa, ...doMedico])
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Pergunta tirada do catálogo ("Ver mais perguntas"): as frases de prontuário vêm do próprio texto do sinal. */
export function perguntaDoCatalogo(sinal: { id: string; texto: string }): PerguntaServidor {
  return { id: `c-${sinal.id}`, texto: sinal.texto, seSim: `Refere: ${minuscula(sinal.texto)}.`, seNao: `Nega: ${minuscula(sinal.texto)}.`, sinalId: sinal.id, resposta: null }
}

export function adicionarPergunta(lista: PerguntaServidor[], p: PerguntaServidor): PerguntaServidor[] {
  const repetida = lista.some((x) => x.texto === p.texto || (p.sinalId !== null && x.sinalId === p.sinalId))
  return repetida ? lista : [...lista, p]
}

/** Marca a resposta; clicar de novo na já marcada desmarca (volta a "sem resposta"). */
export function responder(lista: PerguntaServidor[], id: string, resposta: 'sim' | 'nao'): PerguntaServidor[] {
  return lista.map((p) => (p.id === id ? { ...p, resposta: p.resposta === resposta ? null : resposta } : p))
}

export type AvisoUrgencia = { id: string; texto: string; acao: string[]; prazo: string }

/** O aviso vermelho: urgência que a história já detectou + urgência do catálogo que o médico respondeu Sim. */
export function avisosDeUrgencia(h: HistoriaServidor, perguntas: PerguntaServidor[], catalogo: SinalDoCatalogo[]): AvisoUrgencia[] {
  const avisos: AvisoUrgencia[] = h.seguranca.sinais.filter((s) => s.tipo === 'urgencia_imediata').map((s) => ({ id: s.id, texto: s.texto, acao: s.acao, prazo: s.prazo }))
  for (const p of perguntas) {
    const s = p.resposta === 'sim' && p.sinalId ? catalogo.find((c) => c.id === p.sinalId) : undefined
    if (s && s.tipo === 'urgencia_imediata' && !avisos.some((a) => a.id === s.id)) avisos.push({ id: s.id, texto: s.texto, acao: s.acao, prazo: s.prazo })
  }
  return avisos
}

/** A mensagem do estado do bloco; `null` quando há perguntas para mostrar. */
export function rotuloDoBloco(e: { carregando: boolean; falhou: boolean; n: number }): string | null {
  if (e.carregando) return 'A IA está pensando nas perguntas…'
  if (e.falhou) return 'Não foi possível escrever as perguntas.'
  return e.n === 0 ? 'Sem perguntas para este caso.' : null
}
