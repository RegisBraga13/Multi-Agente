// Conduta e tratamento (página 4): a IA sugere SÓ a partir dos diagnósticos salvos (confirmados) e do
// "Para relembrar" com a marca V/F — sem voltar à história (Constituição, fase 4).
// À esquerda, os grupos ficam fechados (só o título, como as hipóteses do DD). O médico abre um grupo,
// vê as opções que a IA sugeriu (nenhuma vem marcada), escolhe e fecha; a seção aparece à direita,
// no texto corrido da conduta, que ele pode editar.
// "4. Orientações" (antes "Seguimento") reúne orientações gerais, exames, avaliação em X semanas e encaminhamento.
// Não há opção "Não solicitar"/"Não encaminhar"/"Não indicar": não marcar nada já significa isso.
import type { ItemDD } from './diagnosticos'
import { CONDUTAS } from './conduta-exemplo'
import type { ItemResumo } from './resumo'

/** `texto`: a frase que entra na conduta quando a opção está marcada ('' = não escreve nada) */
/** `dias`: avaliação em X semanas — a data (dia da consulta + dias) entra no fim da frase */
/**
 * Item da receita — o que a receita exige: nome pela DCB (genérico), forma farmacêutica, concentração/dosagem,
 * quantidade (algarismos e por extenso: `feminino` concorda o número com a unidade) e posologia com a via.
 * `via` decide a seção da receita (uso tópico/externo ou oral). Concentração '' = não se aplica (dermocosmético).
 */
export type ItemReceita = {
  nome: string; forma: string; concentracao: string
  quantidade: { n: number; unidade: string; feminino: boolean }
  via: 'topico' | 'oral' | 'injetavel'; posologia: string
  /** tempo de tratamento, no fim do item: '8sem', '30 dias', 'uso contínuo' */
  duracao: string
  /** controlado (ex.: isotretinoína): a quantidade vai também por extenso */
  controlado?: boolean
}
/** `receita`: os itens que a opção põe na receita (só nos grupos de tratamento) */
export type Opcao = { id: string; rotulo: string; texto: string; dias?: number; receita?: ItemReceita[] }
/**
 * Uma escolha dentro do grupo. `rotulo` null = o grupo tem uma linha só (como na landing).
 * `prefixo`: as opções marcadas viram uma frase só ("Encaminho para" + "ginecologia e cardiologia.").
 * `outro`: como o texto do "Outro" entra na frase ('{}' = o que o médico escreveu; padrão: a frase dele).
 */
export type Linha = { id: string; rotulo: string | null; opcoes: Opcao[]; prefixo?: string; outro?: string; /** a linha aceita mais de uma opção (vem do servidor); sem isto vale a regra por id (`ehMultipla`) */ multipla?: boolean }

/** Um "Outro" por grupo, no fim: marcado, abre um campo para o médico escrever.
 *  No grupo de uma linha, é a última opção dela; no de várias (Orientações), uma linha própria no fim. */
export const OUTRO = 'outro'

/** Kit de exames de rotina: o mesmo em todas as especialidades; vem marcado (o médico pode desmarcar). */
export const KIT_ROTINA = ['hemograma', 'glicemia de jejum', 'perfil lipídico', 'TSH', 'função renal', 'função hepática', 'EAS']
/** `fixo`: frase que abre o texto do grupo, qualquer que seja a opção (ex.: orientações gerais) */
export type Grupo = { id: string; rotulo: string; linhas: Linha[]; fixo?: string }

/**
 * Regra de todos os módulos: tratamento sistêmico e encaminhamento são de múltipla escolha — um não exclui
 * outro; nada é desmarcado sozinho; nada marcado = sem tratamento sistêmico / sem encaminhamento (não há
 * opção "Não indicar"/"Não encaminhar"). Quais opções aparecem é decisão da IA; o médico escolhe e edita.
 * O valor é a dica mostrada ao abrir.
 */
export const LINHAS_MULTIPLAS: Record<string, string> = {
  sistemico: 'Pode marcar mais de um. Nenhum = sem tratamento sistêmico.',
  encaminhamento: 'Encaminhamento: pode marcar mais de um. Nenhum = sem encaminhamento.',
}
export const ehMultipla = (linha: string) => linha in LINHAS_MULTIPLAS

/** ['a','b','c'] → 'a, b e c' */
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const maiuscula = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

/** Linha do kit, posta no começo de "4. Orientações" de todo diagnóstico. */
const LINHA_KIT: Linha = {
  id: 'kit', rotulo: 'Exames de rotina',
  opcoes: [{ id: 'kit', rotulo: 'Kit de rotina', texto: `Solicito exames de rotina: ${lista(KIT_ROTINA)}.` }],
}

/** Regra que lê o "Para relembrar": com o item com aquela marca, a IA põe estas opções em primeiro na linha. */
export type Regra = { item: string; marca: 'v' | 'f'; linha: string; opcoes: string[] }
export type ModeloConduta = { grupos: Grupo[]; regras: Regra[] }

export type Escolha = Record<string, string[]>

/**
 * `grupos`: os do modelo, com as opções na ordem que a IA sugere (as das regras primeiro), o kit e o "Outro".
 * `motivo`: item do "Para relembrar" que mudou a sugestão da linha (a fonte, mostrada no grupo).
 * `escolha`: o que o médico marcou (começa só com o kit). `outros`: texto do "Outro" de cada linha.
 * `revelado`: grupo já fechado ao menos uma vez
 * (a seção aparece à direita). `textos`: texto de cada grupo; `editado`: o médico mexeu no texto.
 */
export type Conduta = {
  /** dia da consulta ('YYYY-MM-DD'): base da data de retorno */
  dia: string
  diagnostico: { id: string; nome: string; cid: string }
  grupos: Grupo[] | null
  /** nomes dos 4 grupos na especialidade (sem proposta, as seções abrem em branco com estes nomes) */
  rotulos?: string[]
  motivo: Record<string, string>
  escolha: Escolha
  outros: Record<string, string>
  revelado: boolean[]
  textos: string[]
  editado: boolean[]
}

/** Rótulos dos 4 grupos (iguais para todos os diagnósticos). Sem modelo, o médico escreve em cada um. */
export const GRUPOS_CONDUTA = ['1. Cuidados básicos', '2. Tratamento tópico', '3. Tratamento sistêmico', '4. Orientações']
/** Os mesmos 4 grupos (cuidados, tópico, sistêmico, orientações), com os nomes de cada especialidade (autor, 24/11/2026). */
const GRUPOS_POR_ESPECIALIDADE: Partial<Record<string, string[]>> = {
  reumatologia: ['1. Cuidados e reabilitação', '2. Tópico e infiltração', '3. Tratamento sistêmico', '4. Exames e orientações'],
  // PROPOSTA (26/11/2026), aguardando o autor: o grupo "tópico" vira Procedimentos (cardio) e Tratamento local (gastro)
  cardiologia: ['1. Estilo de vida e reabilitação', '2. Procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  gastroenterologia: ['1. Dieta e hábitos', '2. Tratamento local', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  neurologia: ['1. Cuidados e reabilitação', '2. Procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  endocrinologia: ['1. Estilo de vida', '2. Monitorização e educação', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  hematologia: ['1. Cuidados gerais', '2. Procedimentos e transfusão', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  infectologia: ['1. Cuidados gerais', '2. Vacinas e profilaxias', '3. Antimicrobianos e outros remédios', '4. Exames e orientações'],
  oncologia: ['1. Suporte e cuidados', '2. Tratamento oncológico', '3. Controle de sintomas', '4. Exames e orientações'],
  nefrologia: ['1. Dieta e hábitos', '2. Diálise e procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  ginecologia: ['1. Cuidados gerais', '2. Tratamento local', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  urologia: ['1. Hábitos e cuidados', '2. Procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  geriatria: ['1. Cuidados e reabilitação', '2. Revisão dos remédios', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  pediatria: ['1. Cuidados gerais', '2. Vacinas e prevenção', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  psiquiatria: ['1. Psicoterapia e cuidados', '2. Segurança e apoio', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  otorrinolaringologia: ['1. Cuidados gerais', '2. Tratamento local e procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  pneumologia: ['1. Cuidados e reabilitação', '2. Inalatórios e oxigênio', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  hepatologia: ['1. Dieta e hábitos', '2. Procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
  'cirurgia-geral': ['1. Cuidados e preparo', '2. Cirurgia e procedimentos', '3. Tratamento medicamentoso', '4. Exames e orientações'],
}
export const gruposConduta = (especialidade?: string): string[] => GRUPOS_POR_ESPECIALIDADE[especialidade ?? ''] ?? GRUPOS_CONDUTA

/** O diagnóstico que guia a conduta: o primeiro confirmado com conduta de exemplo; senão o primeiro confirmado. */
export function diagnosticoPrincipal(itens: ItemDD[]): ItemDD | null {
  const confirmados = itens.filter((x) => x.decisao === 'confirmada')
  return confirmados.find((x) => !x.propria && CONDUTAS[x.hip.id]) ?? confirmados[0] ?? null
}

const marcaDe = (resumo: ItemResumo[], texto: string) => resumo.find((x) => x.texto === texto)?.marca ?? null

/** Sugestão da IA: as opções do modelo; com o item do "Para relembrar" marcado, as da regra vêm primeiro. */
export function sugerir(modelo: ModeloConduta, resumo: ItemResumo[]): { grupos: Grupo[]; motivo: Record<string, string> } {
  const primeiro: Record<string, string[]> = {}
  const motivo: Record<string, string> = {}
  for (const r of modelo.regras) {
    if (marcaDe(resumo, r.item) !== r.marca) continue
    primeiro[r.linha] = r.opcoes
    motivo[r.linha] = r.item
  }
  const outro: Opcao = { id: OUTRO, rotulo: 'Outro', texto: '' }
  const grupos = modelo.grupos.map((g) => {
    const linhas = [...(g.id === 'orientacoes' ? [LINHA_KIT] : []), ...g.linhas].map((l) => {
      const p = primeiro[l.id] ?? []
      return { ...l, opcoes: [...l.opcoes.filter((o) => p.includes(o.id)), ...l.opcoes.filter((o) => !p.includes(o.id))] }
    })
    // um "Outro" só por grupo
    if (linhas.length === 1) return { ...g, linhas: [{ ...linhas[0], opcoes: [...linhas[0].opcoes, outro] }] }
    return { ...g, linhas: [...linhas, { id: `${g.id}-outro`, rotulo: null, opcoes: [outro] }] }
  })
  return { grupos, motivo }
}

/** Texto de um grupo: a frase fixa + a frase de cada opção marcada, em linguagem corrida. Nada marcado = vazio. */
export function textoDoGrupo(g: Grupo, escolha: Escolha, dia: string, outros: Record<string, string> = {}): string {
  // na ordem das opções (não na ordem dos cliques); "Outro" vazio não escreve nada
  const frases = g.linhas.flatMap((l) => {
    const outro = (outros[l.id] ?? '').trim().replace(/\.$/, '')
    const marcadas = l.opcoes.filter((o) => escolha[l.id]?.includes(o.id) && (o.id !== OUTRO || outro))
    const texto = (o: Opcao) => (o.id === OUTRO ? outro : o.texto)
    if (l.prefixo) return marcadas.length ? [`${l.prefixo} ${lista(marcadas.map(texto))}.`] : []
    return marcadas.map((o) => o.id === OUTRO ? (l.outro ?? '{}.').replace('{}', l.outro ? outro : maiuscula(outro))
      : o.dias !== undefined ? `${o.texto.replace(/\.$/, '')}, em ${dataMais(dia, o.dias)}.`
      : o.receita?.length ? `${o.texto.replace(/\.$/, '')} — ${[...new Set(o.receita.map((x) => x.duracao))].join(' / ')}.`
      : o.texto)
  })
  return frases.length ? [g.fixo ?? '', ...frases].filter(Boolean).join(' ') : ''
}

/** 'YYYY-MM-DD' + dias → 'DD/MM/AAAA' */
export function dataMais(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  const x = new Date(a, m - 1, d + dias)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

export function montarConduta(itens: ItemDD[], resumo: ItemResumo[], dia: string): Conduta | null {
  const dx = diagnosticoPrincipal(itens)
  if (!dx) return null
  const diagnostico = { id: dx.hip.id, nome: dx.hip.nome, cid: dx.hip.cid }
  const modelo = dx.propria ? null : CONDUTAS[dx.hip.id] ?? null
  const vazio = GRUPOS_CONDUTA.map(() => false)
  const base = { dia, diagnostico, escolha: {}, outros: {}, textos: GRUPOS_CONDUTA.map(() => ''), editado: vazio }
  // sem modelo, não há o que abrir: as 4 seções aparecem para o médico escrever
  if (!modelo) return { ...base, grupos: null, motivo: {}, revelado: GRUPOS_CONDUTA.map(() => true) }
  const { grupos, motivo } = sugerir(modelo, resumo)
  // o kit de rotina vem marcado
  const escolha: Escolha = { kit: ['kit'] }
  return { ...base, grupos, motivo, escolha, textos: grupos.map((g) => textoDoGrupo(g, escolha, dia)), revelado: vazio }
}

/**
 * Diagnósticos salvos de novo: mesmo diagnóstico → a IA refaz só a sugestão (ordem e fonte);
 * o que o médico escolheu, revelou e escreveu fica. Outro diagnóstico → conduta nova.
 */
export function atualizarConduta(antes: Conduta, nova: Conduta): Conduta {
  if (antes.diagnostico.id !== nova.diagnostico.id || !nova.grupos) return nova
  return { ...nova, escolha: antes.escolha, outros: antes.outros, revelado: antes.revelado, textos: antes.textos, editado: antes.editado }
}

/**
 * O médico clica numa opção: na linha de uma escolha, marca aquela (outro clique nela desmarca);
 * na de múltipla escolha (sistêmico), marca ou desmarca só aquela — as outras ficam como estão.
 * O texto daquele grupo é refeito (a troca dele vale mais que a edição anterior).
 */
export function escolherOpcao(c: Conduta, linha: string, opcao: string): Conduta {
  if (!c.grupos) return c
  const i = c.grupos.findIndex((g) => g.linhas.some((l) => l.id === linha))
  if (i < 0 || !c.grupos[i].linhas.find((l) => l.id === linha)!.opcoes.some((o) => o.id === opcao)) return c
  const antes = c.escolha[linha] ?? []
  const multipla = c.grupos[i].linhas.find((l) => l.id === linha)!.multipla ?? ehMultipla(linha)
  const marcadas = antes.includes(opcao) ? antes.filter((id) => id !== opcao) : multipla ? [...antes, opcao] : [opcao]
  return refazer({ ...c, escolha: { ...c.escolha, [linha]: marcadas } }, i)
}

/** O médico escreve no campo do "Outro" da linha: o texto do grupo é refeito. */
export function escreverOutro(c: Conduta, linha: string, texto: string): Conduta {
  const i = c.grupos?.findIndex((g) => g.linhas.some((l) => l.id === linha)) ?? -1
  if (i < 0) return c
  return refazer({ ...c, outros: { ...c.outros, [linha]: texto } }, i)
}

/** Refaz o texto do grupo i a partir das escolhas (a troca do médico vale mais que a edição anterior). */
function refazer(c: Conduta, i: number): Conduta {
  return {
    ...c,
    textos: c.textos.map((t, j) => (j === i ? textoDoGrupo(c.grupos![i], c.escolha, c.dia, c.outros) : t)),
    editado: c.editado.map((e, j) => (j === i ? false : e)),
  }
}

/** O médico fechou o grupo: a seção aparece à direita. */
export function revelar(c: Conduta, i: number): Conduta {
  return c.revelado[i] ? c : { ...c, revelado: c.revelado.map((r, j) => r || j === i) }
}

export function editarTexto(c: Conduta, i: number, texto: string): Conduta {
  return { ...c, textos: c.textos.map((t, j) => (j === i ? texto : t)), editado: c.editado.map((e, j) => (j === i ? true : e)) }
}

/** O que impede salvar (null = pode salvar). Mostrado só depois de uma tentativa. */
export function pendenciasConduta(c: Conduta): string | null {
  const faltam = c.revelado.filter((r) => !r).length
  if (faltam) return `Falta abrir ${faltam} ${faltam === 1 ? 'grupo' : 'grupos'}`
  return c.textos.some((t) => t.trim()) ? null : 'Escreva a conduta'
}
