// Tradução entre os dados da página 1 (tela) e os blocos de anamnese e exame do servidor. Funções puras, sem rede.
import type { AnamneseServidor, ExameServidor } from '../servidor/consulta'
import type { Ficha } from '../modulo/tipos'
import type { Fala, Pergunta, RespostaPergunta } from './exemplo'
import type { FormularioConsulta } from './formulario-consulta'
import type { RespostaAlerta } from './tipos'

type CampoExame = keyof ExameServidor['exame']
/** rótulo na tela (primeira consulta de Dermatologia) → campo do servidor */
const CAMPOS: Record<string, CampoExame> = {
  Morfologia: 'morfologia', 'Localização': 'localizacao', 'Extensão': 'extensao',
  'Gravidade estimada': 'gravidade', 'Achados associados': 'achados',
}
const ROTULOS = Object.fromEntries(Object.entries(CAMPOS).map(([rotulo, campo]) => [campo, rotulo])) as Record<CampoExame, string>
const ORDEM: CampoExame[] = ['morfologia', 'localizacao', 'extensao', 'gravidade', 'achados']
const OBSERVACOES = 'Observações'

export function exameParaServidor(valores: { rotulo: string; valor: string }[]): ExameServidor {
  const exame: ExameServidor['exame'] = { morfologia: null, localizacao: null, extensao: null, gravidade: null, achados: null }
  let observacoes = ''
  for (const { rotulo, valor } of valores) {
    const v = valor.trim()
    if (rotulo === OBSERVACOES) observacoes = v
    else if (rotulo in CAMPOS) exame[CAMPOS[rotulo]] = v || null
    else throw new Error(`Campo do exame que o servidor não conhece: ${rotulo}`)
  }
  return { exame, complementares: [], observacoes }
}

export function exameDoServidor(b: ExameServidor): { rotulo: string; valor: string }[] {
  return [...ORDEM.map((c) => ({ rotulo: ROTULOS[c], valor: b.exame[c] ?? '' })), { rotulo: OBSERVACOES, valor: b.observacoes }]
}

type EntradaAnamnese = {
  texto: string
  falas: Fala[]
  ficha: Ficha
  /** resposta do médico a cada sinal de alerta, pelo id */
  alertas: Record<string, RespostaAlerta | null>
  /** a lista fixa do servidor */
  sinais: { id: string; texto: string }[]
  perguntas: RespostaPergunta[]
  formulario: FormularioConsulta | null
}

export function anamneseParaServidor(e: EntradaAnamnese): AnamneseServidor {
  const f = e.ficha.situacao === 'pronta' ? e.ficha : null
  return {
    queixa: f?.queixa ?? '',
    falas: e.falas.map((x) => ({ quem: x.quem, texto: x.texto })),
    sinais: e.sinais.flatMap((s) => {
      const r = e.alertas[s.id]
      return r ? [{ id: s.id, texto: s.texto, resposta: r === 'v' ? ('sim' as const) : ('nao' as const) }] : []
    }),
    emUso: f?.emUso ?? [],
    antecedentes: f?.antecedentes ?? [],
    alergias: f?.alergias ?? [],
    texto: e.texto,
    perguntas: e.perguntas.map((p) => ({ texto: p.pergunta.texto, resposta: p.resposta, detalhe: p.texto ?? null })),
    formulario: e.formulario ? { respostas: e.formulario.respostas, fotos: Object.keys(e.formulario.fotos) } : null,
  }
}

/** `catalogo`: as perguntas que a tela conhece; a que o servidor guardou e a tela não conhece vem em `naoReconhecidas`. */
export function anamneseDoServidor(b: AnamneseServidor, catalogo: Pergunta[]) {
  const perguntas: RespostaPergunta[] = []
  const naoReconhecidas: string[] = []
  for (const p of b.perguntas) {
    const conhecida = catalogo.find((c) => c.texto === p.texto)
    if (!conhecida) naoReconhecidas.push(p.texto)
    else perguntas.push({ pergunta: conhecida, resposta: p.resposta, ...(p.detalhe !== null ? { texto: p.detalhe } : {}) })
  }
  const alertas = Object.fromEntries(b.sinais.map((s) => [s.id, s.resposta === 'sim' ? ('v' as const) : ('f' as const)]))
  return { texto: b.texto, perguntas, alertas, naoReconhecidas }
}

/**
 * Quais etapas o servidor deve oficializar ao salvar `salva`: ele só oficializa o exame depois da anamnese,
 * mas a tela deixa salvar as duas em qualquer ordem. `outraOficializada`: a outra metade já foi salva na tela.
 */
export function etapasParaOficializar(salva: 'anamnese' | 'exame', outraOficializada: boolean): ('anamnese' | 'exame')[] {
  if (salva === 'anamnese') return outraOficializada ? ['anamnese', 'exame'] : ['anamnese']
  return outraOficializada ? ['exame'] : []
}
