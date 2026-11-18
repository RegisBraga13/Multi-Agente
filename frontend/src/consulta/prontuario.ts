// Prontuário da consulta (página 6, o fim): a IA organiza no modelo SOAP SÓ o que foi colhido e salvo
// nas páginas anteriores (história, diagnósticos confirmados, conduta). Nada é inventado nem acrescentado:
// campo não colhido some (não aparece "não aferido"). Só o médico edita antes de salvar.
import type { Conduta } from './conduta'
import type { DadosConsulta } from './anexos'
import type { ItemDD } from './diagnosticos'
import type { SecaoHistoria } from './historia'

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
 * Monta o prontuário. Fontes (todas já salvas): `historia` (texto na tela, com as edições do médico),
 * `itens` dos diagnósticos (só os confirmados entram, com o CID), a `receita` enviada (o tratamento) e os textos da conduta salva
 * (0 cuidados, 1 tópico, 2 sistêmico, 3 orientações). As orientações são separadas por frase:
 * "Solicito…" → Solicitado; "Encaminho para…" → Encaminhado para; "Retorno…" → Retorno; o resto → orientações gerais.
 */
export function montarProntuario(historia: SecaoHistoria[], itens: ItemDD[], conduta: Conduta, receita?: string): SecaoProntuario[] {
  const confirmados = itens.filter((x) => x.decisao === 'confirmada')
  const t = conduta.textos.map((x) => x.trim())
  const orient = frases(t[3] ?? '')
  // "Solicito exames de rotina: …" → "exames de rotina" (o kit não é descrito); "Solicito perfil hormonal." → "perfil hormonal"
  const solicitado = orient.filter((f) => /^Solicito /.test(f))
    .map((f) => (/^Solicito exames de rotina/.test(f) ? 'exames de rotina' : f.replace(/^Solicito /, '').replace(/\.$/, '')))
  const encaminhado = orient.filter((f) => /^Encaminho para /.test(f)).map((f) => f.replace(/^Encaminho para /, '').replace(/\.$/, ''))
  const retorno = orient.filter((f) => /^Retorno /.test(f)).map((f) => f.replace(/^Retorno /, '')).join(' ')

  const secoes: SecaoProntuario[] = [
    { id: 'S', titulo: '', linhas: [
      { id: 'qp', rotulo: 'QP', texto: daHistoria(historia, 'Queixa principal') },
      { id: 'hda', rotulo: 'HDA', texto: daHistoria(historia, 'História da doença atual') },
      { id: 'ap', rotulo: 'AP', texto: daHistoria(historia, 'Antecedentes e alertas') },
      // só quando houver (a história ainda não tem essas seções: hoje não aparecem)
      { id: 'hp', rotulo: 'HP', texto: daHistoria(historia, 'História pessoal') },
      { id: 'hf', rotulo: 'HF', texto: daHistoria(historia, 'História familiar') },
    ] },
    { id: 'O', titulo: '', linhas: [
      // sinais vitais: só quando colhidos (ainda não há esse campo na consulta)
      { id: 'exame', rotulo: 'Ex. físico', texto: daHistoria(historia, 'Exame físico') },
      // exames trazidos pelo paciente (ou, no retorno, os resultados dos pedidos): um por linha
      { id: 'exames', rotulo: 'Exames', texto: daHistoria(historia, 'Exames complementares') },
    ] },
    { id: 'A', titulo: '', linhas: [
      { id: 'hd', rotulo: 'HD', texto: confirmados.map((x) => `${x.hip.nome}${x.hip.cid ? ` (CID-10 ${x.hip.cid})` : ''}`).join('; ') },
    ] },
    { id: 'P', titulo: 'Conduta', linhas: [
      // o tratamento detalhado (o retorno pode usar só o prontuário): a receita enviada, como está; sem receita, o texto da conduta
      { id: 'conduta', rotulo: '', texto: receita?.trim() || [t[0], t[1], t[2]].filter(Boolean).join(' ') },
      { id: 'solicitado', rotulo: 'Solicitado', texto: solicitado.length ? `${solicitado.join(', ')}.` : '' },
      { id: 'encaminhado', rotulo: 'Encaminhado para', texto: encaminhado.length ? `${encaminhado.join(', ')}.` : '' },
      { id: 'orientacoes', rotulo: 'Orientações gerais', texto: orient.filter((f) => !/^(Solicito|Encaminho|Retorno) /.test(f)).join(' ') },
      { id: 'retorno', rotulo: 'Retorno', texto: retorno },
    ] },
  ]
  // campo não colhido some; seção sem nada também
  return secoes.map((s) => ({ ...s, linhas: s.linhas.filter((l) => l.texto) })).filter((s) => s.linhas.length)
}

/** Cabeçalho: "Data: … | Hora: …" e "Paciente: … | Idade: … anos". */
export const cabecalhoProntuario = (d: DadosConsulta) => [`Data: ${d.data}  |  Hora: ${d.hora}`, `Paciente: ${d.paciente}  |  Idade: ${d.idade} anos`]

/** Chave de uma linha (seção + id). */
export const chave = (s: SecaoProntuario, l: LinhaProntuario) => `${s.id}.${l.id}`

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
