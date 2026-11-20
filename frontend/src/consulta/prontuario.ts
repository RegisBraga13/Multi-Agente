// Prontuário da consulta (página 6, o fim): a IA organiza SÓ o que foi colhido e salvo nas páginas anteriores
// (história, diagnósticos assinalados, conduta, anexos, fotos, exames). Nada é inventado nem acrescentado:
// campo não colhido some. Só o médico edita antes de salvar.
// Duas camadas: os DADOS (o que fica gravado no prontuário, organizados — ver prontuario/registro.ts) e as
// SEÇÕES (o texto na tela, montado a partir dos dados).
import type { Anexo, DadosConsulta } from './anexos'
import { dataBr, itensReceita, textoFinalidade } from './anexos'
import type { Conduta } from './conduta'
import type { ItemDD } from './diagnosticos'
import type { Complementar } from './exemplo'
import { extensaoDe, type SecaoHistoria } from './historia'
import type { DadosEntrada, DiagnosticoRegistro, DocumentoRegistro, FotoRegistro } from '../prontuario/registro'

/** Uma linha ("• QP: texto"; rótulo vazio = só o texto). `id` estável para atualizar sem perder a edição do médico. */
export type LinhaProntuario = { id: string; rotulo: string; texto: string }
/** Seções do SOAP; só a conduta tem título na tela (`titulo` vazio = sem título). */
export type SecaoProntuario = { id: 'S' | 'O' | 'A' | 'P'; titulo: string; linhas: LinhaProntuario[] }

/** Texto que a história usa quando nada foi colhido: no prontuário a linha some. */
const VAZIO = /^(Não registrad[ao]\.?|Nenhum exame trazido\.?|Ficha da pré-consulta não preenchida\.?)$/i

const daHistoria = (h: SecaoHistoria[], rotulo: string) => {
  const t = h.find((s) => s.rotulo === rotulo)?.texto.trim() ?? ''
  return VAZIO.test(t) ? '' : t
}

/** Frases de um texto (quebra depois de ponto final seguido de maiúscula). */
const frases = (t: string) => t.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/).map((x) => x.trim()).filter(Boolean)

/**
 * Diagnósticos do prontuário: sempre 3. Primeiro os assinalados pelo médico (com mais de 3, os de maior probabilidade);
 * completam os mais bem posicionados pela IA que o médico não descartou ("sugerido").
 */
export function diagnosticosDoProntuario(itens: ItemDD[]): DiagnosticoRegistro[] {
  const porPct = (xs: ItemDD[]) => xs.map((x, i) => ({ x, i })).sort((a, b) => (b.x.hip.pct ?? -1) - (a.x.hip.pct ?? -1) || a.i - b.i).map(({ x }) => x)
  const assinalados = porPct(itens.filter((x) => x.decisao === 'confirmada')).slice(0, 3)
  const sugeridos = porPct(itens.filter((x) => x.decisao === 'pendente')).slice(0, 3 - assinalados.length)
  const reg = (x: ItemDD, situacao: DiagnosticoRegistro['situacao']) => ({ nome: x.hip.nome, cid: x.hip.cid, pct: x.hip.pct, situacao })
  return [...assinalados.map((x) => reg(x, 'assinalado')), ...sugeridos.map((x) => reg(x, 'sugerido'))]
}

export type FontesProntuario = {
  /** a história como está na tela (com as edições do médico) */
  historia: SecaoHistoria[]
  itens: ItemDD[]
  conduta: Conduta
  /** os anexos salvos (a receita enviada, atestado e laudo emitidos) */
  anexos?: Anexo[]
  complementares?: Complementar[]
  fotos?: FotoRegistro[]
  /** o que o médico deixou no campo Extensão do exame físico (vira número no prontuário, se houver) */
  extensao?: string
}

/**
 * Os dados da entrada, das páginas salvas. As orientações da conduta são separadas por frase:
 * "Solicito…" → solicitado; "Encaminho para…" → encaminhado; "Retorno…" → retorno; o resto → orientações gerais.
 */
export function dadosDaConsulta({ historia, itens, conduta, anexos = [], complementares = [], fotos = [], extensao = '' }: FontesProntuario): DadosEntrada {
  const t = conduta.textos.map((x) => x.trim())
  const orient = frases(t[3] ?? '')
  const receita = anexos.find((x) => x.tipo === 'receita' && x.emitir)?.texto.trim()
  return {
    extensaoPct: extensaoDe(extensao),
    // retorno: a evolução de hoje (a consulta anterior já está no prontuário; nada se repete)
    evolucao: daHistoria(historia, 'Evolução'),
    qp: daHistoria(historia, 'Queixa principal'),
    hda: daHistoria(historia, 'História da doença atual'),
    ap: daHistoria(historia, 'Antecedentes e alertas'),
    // só quando houver (a história ainda não tem essas seções: hoje não aparecem)
    hp: daHistoria(historia, 'História pessoal'),
    hf: daHistoria(historia, 'História familiar'),
    exameFisico: daHistoria(historia, 'Exame físico') || daHistoria(historia, 'Exame'),
    examesTexto: daHistoria(historia, 'Exames complementares'),
    exames: complementares.flatMap((c) => c.itens.map((i) => ({
      exame: c.exame, nome: i.nome, valor: i.v.status === 'MISSING' ? null : i.v.valor, status: i.v.status, data: c.data, origem: c.origem,
    }))),
    diagnosticos: diagnosticosDoProntuario(itens),
    // o tratamento detalhado (o retorno usa o prontuário): a receita enviada, como está; sem receita, o texto da conduta
    receita: receita ? { ...itensReceita(conduta), texto: receita } : null,
    condutaTexto: [t[0], t[1], t[2]].filter(Boolean).join(' '),
    // "Solicito exames de rotina: …" → "exames de rotina" (o kit não é descrito); "Solicito perfil hormonal." → "perfil hormonal"
    solicitado: orient.filter((f) => /^Solicito /.test(f))
      .map((f) => (/^Solicito exames de rotina/.test(f) ? 'exames de rotina' : f.replace(/^Solicito /, '').replace(/\.$/, ''))),
    encaminhado: orient.filter((f) => /^Encaminho para /.test(f)).map((f) => f.replace(/^Encaminho para /, '').replace(/\.$/, '')),
    orientacoes: orient.filter((f) => !/^(Solicito|Encaminho|Retorno) /.test(f)).join(' '),
    retorno: orient.filter((f) => /^Retorno /.test(f)).map((f) => f.replace(/^Retorno /, '')).join(' '),
    documentos: anexos.filter((x) => x.emitir).flatMap(documento),
    fotos,
  }
}

/** Atestado: "de 13/11 a 15/11/2026." (sem período: "comparecimento à consulta."). Laudo: "para o INSS." */
function documento(a: Anexo): DocumentoRegistro[] {
  if (a.tipo === 'atestado') {
    const de = a.periodo?.de || null
    const ate = a.periodo?.ate || null
    if (!de || !ate) return [{ tipo: 'atestado', de: null, ate: null, resumo: 'comparecimento à consulta.' }]
    const curta = de.slice(0, 4) === ate.slice(0, 4) ? dataBr(de).slice(0, 5) : dataBr(de)
    return [{ tipo: 'atestado', de, ate, resumo: `de ${curta} a ${dataBr(ate)}.` }]
  }
  if (a.tipo === 'laudo') {
    const f = textoFinalidade(a.finalidade)
    return [{ tipo: 'laudo', finalidade: f, resumo: f ? `${f}.` : 'emitido.' }]
  }
  return []
}

/** Um por linha: "Acne vulgar (CID-10 L70.0) — 85% · Assinalado". */
export const textoDiagnosticos = (ds: DiagnosticoRegistro[]) =>
  ds.map((d) => `${d.nome}${d.cid ? ` (CID-10 ${d.cid})` : ''}${d.pct !== null ? ` — ${d.pct}%` : ''} · ${d.situacao === 'assinalado' ? 'Assinalado' : 'Sugerido'}`).join('\n')

/** O texto do prontuário, montado dos dados (QP… HD, CONDUTA). Linha sem dado some; seção sem nada também. */
export function secoesDosDados(d: DadosEntrada): SecaoProntuario[] {
  const ponto = (xs: string[]) => (xs.length ? `${xs.join(', ')}.` : '')
  const secoes: SecaoProntuario[] = [
    { id: 'S', titulo: '', linhas: [
      { id: 'evolucao', rotulo: 'Evolução', texto: d.evolucao ?? '' },
      { id: 'qp', rotulo: 'QP', texto: d.qp },
      { id: 'hda', rotulo: 'HDA', texto: d.hda },
      { id: 'ap', rotulo: 'AP', texto: d.ap },
      { id: 'hp', rotulo: 'HP', texto: d.hp },
      { id: 'hf', rotulo: 'HF', texto: d.hf },
    ] },
    { id: 'O', titulo: '', linhas: [
      { id: 'exame', rotulo: 'Ex. físico', texto: d.exameFisico },
      // exames trazidos pelo paciente (ou, no retorno, os resultados dos pedidos): um por linha
      { id: 'exames', rotulo: 'Exames', texto: d.examesTexto },
    ] },
    { id: 'A', titulo: '', linhas: [{ id: 'hd', rotulo: 'HD', texto: textoDiagnosticos(d.diagnosticos) }] },
    { id: 'P', titulo: 'Conduta', linhas: [
      { id: 'conduta', rotulo: '', texto: d.receita?.texto || d.condutaTexto },
      { id: 'solicitado', rotulo: 'Solicitado', texto: ponto(d.solicitado) },
      { id: 'encaminhado', rotulo: 'Encaminhado para', texto: ponto(d.encaminhado) },
      { id: 'orientacoes', rotulo: 'Orientações gerais', texto: d.orientacoes },
      ...d.documentos.map((x) => ({ id: x.tipo, rotulo: x.tipo === 'atestado' ? 'Atestado' : 'Laudo', texto: x.resumo })),
      { id: 'retorno', rotulo: 'Retorno', texto: d.retorno },
    ] },
  ]
  return secoes.map((s) => ({ ...s, linhas: s.linhas.filter((l) => l.texto) })).filter((s) => s.linhas.length)
}

/** Atalho: as seções direto das páginas salvas. */
export const montarProntuario = (historia: SecaoHistoria[], itens: ItemDD[], conduta: Conduta, anexos?: Anexo[]) =>
  secoesDosDados(dadosDaConsulta({ historia, itens, conduta, anexos }))

/** Linhas narrativas: a edição do médico vai para o próprio dado. As outras (HD, receita…) guardam a edição à parte. */
const NARRATIVAS: Record<string, keyof DadosEntrada> = {
  'S.evolucao': 'evolucao', 'S.qp': 'qp', 'S.hda': 'hda', 'S.ap': 'ap', 'S.hp': 'hp', 'S.hf': 'hf', 'O.exame': 'exameFisico', 'O.exames': 'examesTexto', 'P.orientacoes': 'orientacoes',
}

/** Ao salvar: os dados com as edições do médico (narrativas no próprio dado; linha estruturada reescrita → `edicoes`). */
export function aplicarEdicoes(d: DadosEntrada, textos: Record<string, string>): { dados: DadosEntrada; edicoes: Record<string, string> } {
  const dados = { ...d }
  const edicoes: Record<string, string> = {}
  for (const s of secoesDosDados(d)) for (const l of s.linhas) {
    const k = chave(s, l)
    const novo = textos[k]?.trim()
    if (novo === undefined || novo === l.texto) continue
    if (NARRATIVAS[k]) (dados[NARRATIVAS[k]] as string) = novo
    else edicoes[k] = novo
  }
  return { dados, edicoes }
}

/** O texto de uma entrada salva: as seções dos dados, com as linhas estruturadas que o médico reescreveu. */
export const secoesDaEntrada = (e: { dados: DadosEntrada; edicoes: Record<string, string> }): SecaoProntuario[] =>
  secoesDosDados(e.dados).map((s) => ({ ...s, linhas: s.linhas.map((l) => ({ ...l, texto: e.edicoes[chave(s, l)] ?? l.texto })) }))

/** Cabeçalho: "Data: … | Hora: … | Presencial" e "Paciente: … | Idade: … anos". */
export const cabecalhoProntuario = (d: DadosConsulta, modalidade: 'presencial' | 'online') =>
  [`Data: ${d.data}  |  Hora: ${d.hora}  |  ${modalidade === 'online' ? 'Online' : 'Presencial'}`, `Paciente: ${d.paciente}  |  Idade: ${d.idade} anos`]

/** Chave de uma linha (seção + id). */
export const chave = (s: Pick<SecaoProntuario, 'id'>, l: Pick<LinhaProntuario, 'id'>) => `${s.id}.${l.id}`

/**
 * As páginas anteriores mudaram e foram salvas de novo: a linha cuja origem não mudou fica como está
 * (com a edição do médico); a que mudou é reescrita (mudou = true, para escrever ao vivo só ela).
 */
export function atualizarProntuario(geradas: SecaoProntuario[], textos: Record<string, string>, novas: SecaoProntuario[]) {
  const antes = new Map(geradas.flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto] as const)))
  const novosTextos: Record<string, string> = {}
  const mudou: Record<string, boolean> = {}
  for (const s of novas) for (const l of s.linhas) {
    const k = chave(s, l)
    const igual = antes.get(k) === l.texto
    novosTextos[k] = igual ? textos[k] ?? l.texto : l.texto
    mudou[k] = !igual
  }
  return { textos: novosTextos, mudou }
}
