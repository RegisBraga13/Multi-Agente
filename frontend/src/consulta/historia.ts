// História clínica: montada SÓ com a anamnese e o exame físico salvos (Constituição, fase 2).
// Simulação da IA: organiza o que foi salvo em seções, como na landing.
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import { minuscula, type Complementar, type Fala } from './exemplo'
import type { RespostaAlerta } from './tipos'

export type SecaoHistoria = { rotulo: string; texto: string }

/**
 * A anamnese ou o exame mudou e foi salvo de novo: a IA não reescreve tudo.
 * - origem da seção não mudou → fica como está (com as edições do médico);
 * - mudou e o médico não tinha mexido → a IA reescreve (mudou = true);
 * - mudou e o médico tinha editado → o texto dele fica; a IA SUGERE ao lado (ele aceita ou mantém o seu).
 */
export function atualizarHistoria(
  geradasAntes: SecaoHistoria[],
  atuais: string[],
  novas: SecaoHistoria[],
): { textos: string[]; mudou: boolean[]; sugestoes: (string | null)[] } {
  const origemMudou = novas.map((s, i) => s.texto !== geradasAntes[i]?.texto)
  const editada = atuais.map((t, i) => t !== geradasAntes[i]?.texto)
  return {
    textos: novas.map((s, i) => (origemMudou[i] && !editada[i] ? s.texto : atuais[i])),
    mudou: novas.map((_, i) => origemMudou[i] && !editada[i]),
    sugestoes: novas.map((s, i) => (origemMudou[i] && editada[i] ? s.texto : null)),
  }
}

/** O que a IA sabe da anamnese salva além do texto: como escrever cada fala e os sinais de alerta respondidos. */
export type ContextoHistoria = { falas: Fala[]; sinais: { texto: string; resposta: RespostaAlerta | null }[] }

const ponto = (x: string) => (/[.!?:]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`)
const maiuscula = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
/** ['a','b','c'] → 'a, b e c' */
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** História da doença atual, em linguagem médica corrida (como na landing), a partir das falas do paciente. */
function hda(anamnese: string, idadeAnos: number, falas: Fala[]): string {
  const linhas = anamnese.split('\n').map((l) => l.trim()).filter(Boolean)
  // anamnese escrita à mão (sem falas): o texto do médico entra inteiro
  if (!linhas.some((l) => /^(Médico|Paciente):/.test(l))) return linhas.join(' ') || 'Não registrada.'
  const comoEscrever = new Map(falas.filter((f) => f.quem === 'Paciente' && f.clinico !== undefined).map((f) => [f.texto, f.clinico!]))
  const partes = linhas
    .filter((l) => l.startsWith('Paciente:'))
    .map((l) => l.slice('Paciente:'.length).trim())
    // fala conhecida → como a IA escreve; fala nova (fora do roteiro) → entra como relato
    .map((t) => (comoEscrever.has(t) ? comoEscrever.get(t)! : `Relata: ${t}`))
    .filter(Boolean)
  if (!partes.length) return 'Não registrada.'
  // a IA organiza: a queixa vem primeiro, mesmo que tenha sido dita depois (ex.: perguntas feitas no começo)
  const q = partes.findIndex((x) => x.startsWith('refere '))
  if (q > 0) partes.unshift(...partes.splice(q, 1))
  const [primeira, ...resto] = partes
  const inicio = primeira.startsWith('refere ') ? ponto(`Paciente de ${idadeAnos} anos ${primeira}`) : `Paciente de ${idadeAnos} anos. ${ponto(maiuscula(primeira))}`
  return [inicio, ...resto.map((x) => ponto(maiuscula(x)))].join(' ')
}

/** Exame físico em texto corrido: "Morfologia em localização. Extensão. Achados. Gravidade estimada: x." + observações. */
function exameFisico(exame: { rotulo: string; valor: string }[]): string {
  const v = (r: string) => exame.find((x) => x.rotulo === r)?.valor.trim().replace(/\.$/, '') ?? ''
  const conhecidos = ['Morfologia', 'Localização', 'Extensão', 'Gravidade estimada', 'Achados associados', 'Observações']
  const [morf, loc, ext, grav, ach, obs] = conhecidos.map(v)
  const frases = [
    morf ? `${morf}${loc ? ` em ${minuscula(loc)}` : ''}` : loc ? `Localização: ${minuscula(loc)}` : '',
    ext,
    ach,
    grav ? `Gravidade estimada: ${minuscula(grav)}` : '',
    ...exame.filter((x) => !conhecidos.includes(x.rotulo) && x.valor.trim()).map((x) => `${x.rotulo}: ${x.valor.trim()}`),
    obs,
  ].filter(Boolean)
  return frases.length ? frases.map(ponto).join(' ') : 'Não registrado.'
}

export function montarHistoria(
  at: Atendimento,
  agora: Date,
  anamnese: string,
  exame: { rotulo: string; valor: string }[],
  complementares: Complementar[],
  contexto: ContextoHistoria = { falas: [], sinais: [] },
): SecaoHistoria[] {
  const f = at.ficha
  const pronta = f.situacao === 'pronta' ? f : null
  const anos = idade(at.paciente.nascimento, agora)

  // sinal de alerta marcado V entra na história; F (ou sem resposta) não entra
  const sinais = contexto.sinais.filter((x) => x.resposta === 'v').map((x) => `Alerta: ${minuscula(x.texto)}.`)
  const antecedentes = (pronta
    ? [
        !pronta.antecedentes.length && !pronta.emUso.length ? 'Nega comorbidades e uso contínuo de medicações.'
          : [
              pronta.antecedentes.length ? ponto(maiuscula(lista(pronta.antecedentes.map((x) => x.toLowerCase())))) : 'Nega comorbidades.',
              pronta.emUso.length ? `Em uso de ${lista(pronta.emUso.map(minuscula))}.` : 'Nega uso contínuo de medicações.',
            ].join(' '),
        pronta.alergias.length ? pronta.alergias.map((a) => `Alergia a ${a.substancia.toLowerCase()} (${a.reacao}).`).join(' ') : 'Nega alergias.',
        ...sinais,
      ]
    : ['Ficha da pré-consulta não preenchida.', ...sinais]).join(' ')

  // como na landing: exame de laboratório, um resultado por linha; outro laudo (biópsia...) numa linha só
  const item = (i: Complementar['itens'][number]) =>
    `${i.nome}: ${i.v.status === 'MISSING' ? 'não encontrado no laudo' : `${i.v.valor}${i.v.status === 'INFERRED' ? ' (conferir no laudo)' : ''}`}`
  const exames = complementares.length
    ? complementares.flatMap((c) => (/laborat/i.test(c.exame) ? c.itens.map((i) => `${item(i)}.`) : [`${c.exame}: ${c.itens.map(item).join('; ')}.`])).join('\n')
    : 'Nenhum exame trazido.'

  return [
    { rotulo: 'Identificação', texto: `${at.paciente.nome}, ${anos} anos · ${at.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · ${at.modalidade === 'online' ? 'Online' : 'Presencial'}` },
    { rotulo: 'Queixa principal', texto: pronta?.queixa || 'Não registrada na ficha.' },
    { rotulo: 'História da doença atual', texto: hda(anamnese, anos, contexto.falas) },
    { rotulo: 'Antecedentes e alertas', texto: antecedentes },
    { rotulo: 'Exame físico', texto: exameFisico(exame) },
    { rotulo: 'Exames complementares', texto: exames },
  ]
}
