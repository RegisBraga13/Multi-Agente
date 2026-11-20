// História clínica: montada SÓ com a anamnese e o exame físico salvos (Constituição, fase 2).
// Simulação da IA: organiza o que foi salvo em seções, como na landing.
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import { estadoCivilNoTexto, type EstadoCivil } from '../medico/regras'
import type { Parte } from '../medico/pre-consulta'
import type { Respostas } from '../servidor/agenda'
import type { FormularioConsulta } from './formulario-consulta'
import { frasesDoFormulario } from './historia-formulario'
import { minuscula, type Complementar, type Fala, type RespostaPergunta } from './exemplo'
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
/** `perguntas`: as que o médico respondeu Sim/Não (entram contextualizadas na HDA ou nos antecedentes) */
/** `formulario`: o formulário do paciente salvo na anamnese (vira frases de prontuário; as linhas dele na caixa não entram de novo) */
export type ContextoHistoria = {
  falas: Fala[]; sinais: { texto: string; resposta: RespostaAlerta | null }[]; perguntas?: RespostaPergunta[]
  /** retorno: consultas anteriores do prontuário, da mais recente para a mais antiga (data 'AAAA-MM-DD') */
  anteriores?: { data: string; exameFisico: string; /** número gravado no prontuário (entradas antigas não têm: lê do texto) */ extensaoPct?: number | null }[]
  formulario?: { dados: FormularioConsulta['dados']; respostas: Respostas; partes: Parte[] }
}

const ponto = (x: string) => (/[.!?:]$/.test(x.trim()) ? x.trim() : `${x.trim()}.`)
const maiuscula = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)
/** ['a','b','c'] → 'a, b e c' */
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** História da doença atual, em linguagem médica corrida (como na landing), a partir das falas do paciente. */
/** `ident`: "Paciente, 52 anos, casado, comerciante" (estado civil e profissão da ficha; o que não foi respondido não entra) */
function hda(anamnese: string, ident: string, falas: Fala[], extras: string[]): string {
  const linhas = anamnese.split('\n').map((l) => l.trim()).filter(Boolean)
  // anamnese escrita à mão (sem falas): o texto do médico entra inteiro
  // (a identificação abre a HDA, a menos que o médico já tenha começado por "Paciente…")
  if (!linhas.some((l) => /^(Médico|Paciente):/.test(l))) {
    const escrito = [linhas.join(' '), ...extras].filter(Boolean).join(' ')
    return !escrito ? 'Não registrada.' : /^paciente\b/i.test(escrito) ? escrito : `${ident}. ${escrito}`
  }
  const comoEscrever = new Map(falas.filter((f) => f.quem === 'Paciente' && f.clinico !== undefined).map((f) => [f.texto, f.clinico!]))
  const partes = linhas
    .filter((l) => l.startsWith('Paciente:'))
    .map((l) => l.slice('Paciente:'.length).trim())
    // fala conhecida → como a IA escreve; fala nova (fora do roteiro) → entra como relato
    .map((t) => (comoEscrever.has(t) ? comoEscrever.get(t)! : `Relata: ${t}`))
    .filter(Boolean)
  if (!partes.length) return extras.length ? `${ident}. ${extras.join(' ')}` : 'Não registrada.'
  // a IA organiza: a queixa vem primeiro, mesmo que tenha sido dita depois (ex.: perguntas feitas no começo)
  const q = partes.findIndex((x) => x.startsWith('refere '))
  if (q > 0) partes.unshift(...partes.splice(q, 1))
  const [primeira, ...resto] = partes
  const inicio = primeira.startsWith('refere ') ? ponto(`${ident}, ${primeira}`) : `${ident}. ${ponto(maiuscula(primeira))}`
  return [inicio, ...resto.map((x) => ponto(maiuscula(x))), ...extras].join(' ')
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

/** "Paciente, 52 anos, casado, comerciante": idade de hoje + estado civil e profissão da ficha desta consulta (mudou na ficha, muda aqui). */
export function identificacaoHda(anos: number, f: { sexo: 'F' | 'M' | 'I' | ''; estadoCivil: EstadoCivil | ''; profissao: string } | null): string {
  return ['Paciente', `${anos} anos`, f?.estadoCivil ? estadoCivilNoTexto(f.estadoCivil, f.sexo) : '', minuscula(f?.profissao.trim() ?? '')].filter(Boolean).join(', ')
}

const textoResposta = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()

/**
 * HDA quando o formulário foi salvo na anamnese: o formulário abre a história em linguagem de prontuário
 * (exemplo aprovado pelo autor em 19/11/2026) e o que foi gravado ou escrito continua depois, sem repetir a queixa.
 */
function hdaComFormulario(anamnese: string, anos: number, form: NonNullable<ContextoHistoria['formulario']>, falas: Fala[], extras: string[]): string {
  const ident = identificacaoHda(anos, form.dados)
  const f = frasesDoFormulario(form)
  // as linhas do formulário na caixa ("Queixa principal: ...") já estão nas frases acima
  const rotulos = ['Identificação', 'Alergias', 'Estado civil e trabalho', ...form.partes.map((p) => p.titulo)]
  const resto = anamnese.split('\n').filter((l) => !rotulos.some((r) => l.trim().startsWith(`${r}:`))).join('\n')
  let depois = hda(resto, ident, falas, extras)
  if (depois === 'Não registrada.') depois = ''
  depois = depois.replace(new RegExp(`^${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,.] ?`), '')
  // a queixa já veio do formulário: a mesma queixa dita na gravação não entra de novo
  if (f.queixa && depois.startsWith('refere ')) depois = depois.replace(/^refere [^.]*\.\s*/, '')
  depois = depois.charAt(0).toUpperCase() + depois.slice(1)
  const abertura = f.queixa ? ponto(`${ident}, ${f.queixa}`) : ''
  const texto = [abertura, f.habitos, depois].filter(Boolean).join(' ')
  return !texto ? 'Não registrada.' : abertura ? texto : `${ident}. ${texto}`
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
  const respostas = (secao: 'hda' | 'ant') => (contexto.perguntas ?? []).filter((x) => x.pergunta.secao === secao).map((x) => (x.resposta === 'sim' ? x.pergunta.sim : x.pergunta.nao))

  // sinal de alerta marcado V entra na história; F (ou sem resposta) não entra
  const sinais = contexto.sinais.filter((x) => x.resposta === 'v').map((x) => `Alerta: ${minuscula(x.texto)}.`)
  const form = contexto.formulario
  const antecedentes = form
    ? [...frasesDoFormulario(form).antecedentes, ...respostas('ant'), ...sinais].join(' ') || 'Não informados no formulário.'
    : (pronta
    ? [
        !pronta.antecedentes.length && !pronta.emUso.length ? 'Nega comorbidades e uso contínuo de medicações.'
          : [
              pronta.antecedentes.length ? ponto(maiuscula(lista(pronta.antecedentes.map((x) => x.toLowerCase())))) : 'Nega comorbidades.',
              pronta.emUso.length ? `Em uso de ${lista(pronta.emUso.map(minuscula))}.` : 'Nega uso contínuo de medicações.',
            ].join(' '),
        ...respostas('ant'),
        pronta.alergias.length ? pronta.alergias.map((a) => `Alergia a ${a.substancia.toLowerCase()}${a.reacao ? ` (${a.reacao})` : ''}.`).join(' ') : 'Nega alergias.',
        ...sinais,
      ]
    : ['Ficha da pré-consulta não preenchida.', ...respostas('ant'), ...sinais]).join(' ')

  const exames = textoExames(complementares, 'Nenhum exame trazido.')

  return [
    // história só serve de fonte para DD e tratamento (depois some): sem nome, sem consulta/retorno, sem presencial/online
    { rotulo: 'Identificação', texto: `Paciente, ${anos} anos` },
    { rotulo: 'Queixa principal', texto: (form && textoResposta(form.respostas.queixa)) || pronta?.queixa || 'Não registrada na ficha.' },
    { rotulo: 'História da doença atual', texto: form ? hdaComFormulario(anamnese, anos, form, contexto.falas, respostas('hda')) : hda(anamnese, identificacaoHda(anos, pronta), contexto.falas, respostas('hda')) },
    { rotulo: 'Antecedentes e alertas', texto: antecedentes },
    { rotulo: 'Exame físico', texto: exameFisico(exame) },
    { rotulo: 'Exames complementares', texto: exames },
  ]
}

/** Exames complementares em texto: laboratório, um resultado por linha; outro laudo (biópsia...) numa linha só. */
function textoExames(complementares: Complementar[], vazio: string): string {
  const item = (i: Complementar['itens'][number]) =>
    `${i.nome}: ${i.v.status === 'MISSING' ? 'não encontrado no laudo' : `${i.v.valor}${i.v.status === 'INFERRED' ? ' (conferir no laudo)' : ''}`}`
  return complementares.length
    ? complementares.flatMap((c) => (/laborat/i.test(c.exame) ? c.itens.map((i) => `${item(i)}.`) : [`${c.exame}: ${c.itens.map(item).join('; ')}.`])).join('\n')
    : vazio
}

/** Percentual da superfície do corpo num texto ("BSA estimada em 4%", "1", "6,5%"); null se não houver número. */
export function extensaoDe(texto: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(texto) ?? /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(texto)
  return m ? Number(m[1].replace(',', '.')) : null
}
const numero = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** "Extensão das lesões: 1% (consulta anterior, 18/09: 4%), redução de 3 pontos percentuais." (o médico digita o número) */
function frasePercentual(digitado: string, anteriores: { data: string; exameFisico: string; extensaoPct?: number | null }[]): string {
  if (!digitado) return ''
  const hoje = extensaoDe(digitado)
  if (hoje === null) return `Extensão das lesões: ${digitado}`
  const antes = anteriores.map((a) => ({ data: a.data, pct: a.extensaoPct ?? extensaoDe(a.exameFisico) })).find((a) => a.pct !== null)
  if (!antes || antes.pct === null) return `Extensão das lesões: ${numero(hoje)}%`
  const dif = hoje - antes.pct
  const [, mes, dia] = antes.data.split('-')
  const variacao = dif === 0 ? 'sem alteração' : `${dif < 0 ? 'redução' : 'aumento'} de ${numero(Math.abs(dif))} pontos percentuais`
  return `Extensão das lesões: ${numero(hoje)}% (consulta anterior, ${dia}/${mes}: ${numero(antes.pct)}%), ${variacao}`
}

/**
 * História da evolução (retorno, regra 14): só o que foi colhido hoje, sem identificação (já está no prontuário).
 * Evolução abre com "Paciente relata ..."; Exame compara com a consulta anterior; Exames = resultados novos.
 */
export function montarHistoriaEvolucao(
  anamnese: string,
  exame: { rotulo: string; valor: string }[],
  complementares: Complementar[],
  contexto: ContextoHistoria = { falas: [], sinais: [] },
): SecaoHistoria[] {
  const linhas = anamnese.split('\n').map((l) => l.trim()).filter(Boolean)
  const comoEscrever = new Map(contexto.falas.filter((f) => f.quem === 'Paciente' && f.clinico !== undefined).map((f) => [f.texto, f.clinico!]))
  const relato = linhas.some((l) => /^(Médico|Paciente):/.test(l))
    // gravado: fala conhecida → como a IA escreve; fala nova → entra como está
    ? linhas.filter((l) => l.startsWith('Paciente:')).map((l) => l.slice('Paciente:'.length).trim()).map((t) => comoEscrever.get(t) ?? t).filter(Boolean).map((t) => ponto(maiuscula(t))).join(' ')
    : linhas.join(' ')
  const semPonto = relato.replace(/[.]$/, '')
  const abertura = !relato ? '' : /^paciente\b/i.test(relato) ? relato : ponto(`Paciente relata ${/^[A-Z]{2}/.test(semPonto) ? semPonto : minuscula(semPonto)}`)
  // a resposta Sim/Não entra, mas não repete "melhora" ou "piora" que o relato já disse
  const repete = (texto: string) => (/^melhorou/i.test(texto) && /melhora/i.test(abertura)) || (/^piorou/i.test(texto) && /piora/i.test(abertura))
  // pergunta aberta: a frase leva o que o médico escreveu ({}); sem texto, não entra
  const frase = (x: RespostaPergunta) => (x.pergunta.aberta ? (x.texto?.trim() ? x.pergunta.sim.replace('{}', x.texto.trim()) : '') : x.resposta === 'sim' ? x.pergunta.sim : x.pergunta.nao)
  const respostas = (contexto.perguntas ?? []).filter((x) => !(x.resposta === 'sim' && repete(x.pergunta.texto))).map(frase).filter(Boolean)
  const evolucao = [abertura, ...respostas].filter(Boolean).join(' ') || 'Não registrada.'

  const v = (r: string) => exame.find((x) => x.rotulo === r)?.valor.trim().replace(/\.$/, '') ?? ''
  const [aspecto, extensao, comparado, obs] = ['Aspecto atual das lesões', 'Extensão', 'Comparado à consulta anterior', 'Observações'].map(v)
  const frases = [aspecto, frasePercentual(extensao, contexto.anteriores ?? []), comparado ? `Em relação à consulta anterior: ${minuscula(comparado)}` : '', obs].filter(Boolean)
  return [
    { rotulo: 'Evolução', texto: evolucao },
    { rotulo: 'Exame', texto: frases.length ? frases.map(ponto).join(' ') : 'Não registrado.' },
    // com resultados, eles ficam na tabela por data (abaixo da história): não se repetem aqui
    { rotulo: 'Exames', texto: complementares.length ? 'Resultados comparados na tabela abaixo.' : 'Nenhum exame novo.' },
  ]
}

/** A consulta anterior do prontuário como seções de história (o retorno parte dela; a IA lê o que não muda: alergias, comorbidades). */
export function secoesDaConsultaAnterior(d: { qp: string; hda: string; ap: string; exameFisico: string; examesTexto: string }): SecaoHistoria[] {
  return [
    { rotulo: 'Queixa principal', texto: d.qp },
    { rotulo: 'História da doença atual', texto: d.hda },
    { rotulo: 'Antecedentes e alertas', texto: d.ap },
    { rotulo: 'Exame físico', texto: d.exameFisico },
    { rotulo: 'Exames complementares', texto: d.examesTexto },
  ].filter((s) => s.texto.trim())
}

/** Retorno: a IA dos diagnósticos lê SÓ a evolução de hoje, como numa primeira consulta (a consulta anterior fica no prontuário, de referência). */
export function secoesDaEvolucaoParaDD(evolucao: SecaoHistoria[]): SecaoHistoria[] {
  const rotulos: Record<string, string> = { Evolução: 'História da doença atual', Exame: 'Exame físico', Exames: 'Exames complementares' }
  return evolucao.map((s) => ({ rotulo: rotulos[s.rotulo] ?? s.rotulo, texto: s.texto }))
}
