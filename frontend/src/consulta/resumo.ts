// Para relembrar (página dos diagnósticos): o que pesa na conduta/tratamento, tirado SÓ da história
// clínica salva — alergias, medicamentos em uso, comorbidades, gestação, sinais de alerta, tratamentos prévios.
// Simulação da IA: cada frase da história é lida e, se for relevante, vira um item com V ou F.
// TODOS os itens vão para a conduta com a marca (um F também pode mudar a conduta); a conduta lê só
// isto e os diagnósticos salvos, sem voltar à história. O médico só troca V↔F; não edita o texto.
import type { SecaoHistoria } from './historia'

export type Marca = 'v' | 'f'
export type TipoResumo = 'alergia' | 'alerta' | 'gestacao' | 'comorbidade' | 'medicamento' | 'tratamento' | 'outro'
/**
 * `marcaIA`: como a IA leu a história; `marca`: a que vale (o médico pode trocar).
 * Ambas null só em "Alergias: não informado" (sem marca até a história ter a resposta).
 * `secao`/`trecho`: frase literal da história que sustenta o item (null quando não informado).
 */
export type ItemResumo = { id: string; tipo: TipoResumo; texto: string; marcaIA: Marca | null; marca: Marca | null; secao: string | null; trecho: string | null }

const ANT = 'Antecedentes e alertas'
const HDA = 'História da doença atual'
const ORDEM: TipoResumo[] = ['alergia', 'alerta', 'gestacao', 'comorbidade', 'medicamento', 'tratamento', 'outro']

const frases = (t: string) => t.split(/(?<=\.)\s+/).map((f) => f.trim()).filter(Boolean)
const maiuscula = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
const semPonto = (x: string) => x.trim().replace(/\.$/, '')
const chave = (x: string) => x.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
/** "a, b e c" → ['a','b','c']; vírgula seguida de número fica (ex.: "losartana 50 mg, 1x ao dia") */
const separar = (x: string) => x.split(/,\s(?=\D)|\se\s(?=\S)/).map((p) => p.trim()).filter(Boolean)

type Regra = { padrao: RegExp; tipo: TipoResumo; texto: string; marca: Marca }
/** Frases que a IA reconhece como relevantes para a conduta (além das listas da ficha, tratadas abaixo). */
const REGRAS: Regra[] = [
  { padrao: /^Nega alergias/i, tipo: 'alergia', texto: 'Alergias', marca: 'f' },
  { padrao: /^Nega comorbidades e uso contínuo/i, tipo: 'comorbidade', texto: 'Comorbidades', marca: 'f' },
  { padrao: /^Nega comorbidades e uso contínuo/i, tipo: 'medicamento', texto: 'Medicamentos em uso', marca: 'f' },
  { padrao: /^Nega comorbidades\.?$/i, tipo: 'comorbidade', texto: 'Comorbidades', marca: 'f' },
  { padrao: /^Nega uso contínuo de medica/i, tipo: 'medicamento', texto: 'Medicamentos em uso', marca: 'f' },
  { padrao: /^Relata planejar gravidez/i, tipo: 'gestacao', texto: 'Planeja gravidez', marca: 'v' },
  { padrao: /^Relata não planejar gravidez/i, tipo: 'gestacao', texto: 'Planeja gravidez', marca: 'f' },
  { padrao: /^Relata uso prévio de antibiótico ou isotretinoína/i, tipo: 'tratamento', texto: 'Antibiótico ou isotretinoína prévios', marca: 'v' },
  { padrao: /^Nega uso prévio de antibiótico ou isotretinoína/i, tipo: 'tratamento', texto: 'Antibiótico ou isotretinoína prévios', marca: 'f' },
  { padrao: /^Sem tratamento prévio/i, tipo: 'tratamento', texto: 'Tratamento prévio', marca: 'f' },
  { padrao: /^Uso prévio de corticoide tópico/i, tipo: 'tratamento', texto: 'Corticoide tópico prévio, com recidiva', marca: 'v' },
  { padrao: /^Uso de xampu anticaspa/i, tipo: 'tratamento', texto: 'Xampu anticaspa, melhora parcial', marca: 'v' },
  { padrao: /^Refere irregularidade menstrual ou excesso de pelos/i, tipo: 'outro', texto: 'Irregularidade menstrual ou excesso de pelos', marca: 'v' },
  { padrao: /^Nega irregularidade menstrual/i, tipo: 'outro', texto: 'Irregularidade menstrual ou excesso de pelos', marca: 'f' },
  { padrao: /^Refere uso de anticoagulante/i, tipo: 'medicamento', texto: 'Anticoagulante além do AAS', marca: 'v' },
  { padrao: /^Nega uso de anticoagulante/i, tipo: 'medicamento', texto: 'Anticoagulante além do AAS', marca: 'f' },
  { padrao: /^Refere diabetes ou problema circulatório/i, tipo: 'comorbidade', texto: 'Diabetes ou problema circulatório', marca: 'v' },
  { padrao: /^Nega diabetes e problemas circulatórios/i, tipo: 'comorbidade', texto: 'Diabetes ou problema circulatório', marca: 'f' },
  { padrao: /^Refere início recente de medicamento ou creme/i, tipo: 'medicamento', texto: 'Medicamento ou creme novo', marca: 'v' },
  { padrao: /^Nega medicamento ou creme novo/i, tipo: 'medicamento', texto: 'Medicamento ou creme novo', marca: 'f' },
]

/** Frase de antecedentes que não é reconhecida por nenhuma regra nem lista: a primeira é a lista de comorbidades da ficha. */
const OUTRAS = /^(Nega|Em uso|Alergia|Alerta|Ficha|História familiar|Relata|Refere)/i

/** Retorno: as alergias do prontuário como uma seção que o resumo entende ("Alergia a X (reação)."). */
export function secaoDeAlergias(alergias: { substancia: string; reacao: string }[]): SecaoHistoria | null {
  if (!alergias.length) return null
  return { rotulo: 'Antecedentes e alertas', texto: alergias.map((a) => `Alergia a ${a.substancia} (${a.reacao || 'reação não informada'}).`).join('\n') }
}

export function montarResumo(historia: SecaoHistoria[]): ItemResumo[] {
  const itens: ItemResumo[] = []
  const por = (tipo: TipoResumo, texto: string, marca: Marca, secao: string, trecho: string) => {
    const id = `${tipo}:${chave(texto)}`
    if (!itens.some((x) => x.id === id)) itens.push({ id, tipo, texto, marcaIA: marca, marca, secao, trecho })
  }

  for (const secao of [ANT, HDA]) {
    const texto = historia.find((s) => s.rotulo === secao)?.texto ?? ''
    frases(texto).forEach((f, i) => {
      for (const r of REGRAS) if (r.padrao.test(f)) por(r.tipo, r.texto, r.marca, secao, f)
      if (secao !== ANT) return
      const alergia = f.match(/^Alergia a (.+?)\s*\((.+)\)\.?$/i)
      if (alergia) por('alergia', `Alergia a ${alergia[1]} (${alergia[2]})`, 'v', secao, f)
      const alerta = f.match(/^Alerta:\s*(.+)$/i)
      if (alerta) por('alerta', maiuscula(semPonto(alerta[1])), 'v', secao, f)
      const emUso = f.match(/^Em uso de (.+)$/i)
      if (emUso) separar(semPonto(emUso[1])).forEach((m) => por('medicamento', maiuscula(m), 'v', secao, f))
      if (i === 0 && !OUTRAS.test(f)) separar(semPonto(f)).forEach((c) => por('comorbidade', maiuscula(c), 'v', secao, f))
    })
  }

  // alergia aparece sempre: sem nada na história, "não informado" e sem marca
  if (!itens.some((x) => x.tipo === 'alergia')) itens.push({ id: 'alergia:nao-informado', tipo: 'alergia', texto: 'Alergias: não informado', marcaIA: null, marca: null, secao: null, trecho: null })
  return itens.sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
}

/** História salva de novo: refaz o resumo; a troca do médico fica se a IA leu igual ao que lia antes. */
export function atualizarResumo(antes: ItemResumo[], novos: ItemResumo[]): ItemResumo[] {
  return novos.map((n) => {
    const a = antes.find((x) => x.id === n.id)
    return a && a.marcaIA === n.marcaIA ? { ...n, marca: a.marca } : n
  })
}

/** O médico troca a marca (V↔F). "Não informado" não tem marca para trocar. */
export function marcarResumo(itens: ItemResumo[], id: string, marca: Marca): ItemResumo[] {
  return itens.map((x) => (x.id === id && x.marcaIA !== null ? { ...x, marca } : x))
}
