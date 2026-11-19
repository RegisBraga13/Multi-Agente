// O formulário do paciente escrito em linguagem de prontuário, cada resposta na seção certa da história.
// O que não foi respondido não entra (não respondido ≠ negado: vira lembrete em Perguntas).
// Exemplo aprovado pelo autor em 19/11/2026 (testes em historia-formulario.test.ts).
import type { Respostas } from '../servidor/agenda'
import type { FormularioConsulta } from './formulario-consulta'

type Entrada = { dados: Pick<FormularioConsulta['dados'], 'sexo' | 'trabalhoExposto'>; respostas: Respostas }
export type FrasesFormulario = {
  /** abre a HDA depois da identificação: "refere manchas no rosto há 2 anos, ..." ('' = sem queixa) */
  queixa: string
  /** exposição e hábitos, numa frase ("Trabalha exposta ao sol; usa protetor ...") */
  habitos: string
  antecedentes: string[]
}

const txt = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => x.trim()).filter(Boolean)
const um = (v: string | string[] | undefined) => txt(v).join(', ')
const min = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const sem = (t: string) => t.replace(/[.]+$/, '')
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const SINTOMA: Record<string, string> = { Coça: 'prurido', Dói: 'dor', Sangra: 'sangramento' }

export function frasesDoFormulario({ dados, respostas: r }: Entrada): FrasesFormulario {
  // ---- queixa: o que, onde, desde quando, evolução e sintomas ----
  let queixa = ''
  const q = sem(um(r.queixa))
  if (q) {
    const local = sem(um(r.local))
    const desde = sem(um(r.desde_quando))
    const mudou = um(r.mudou)
    const sintomas = txt(r.sintomas)
    const partes = [
      `refere ${min(q)}${local && !q.toLowerCase().includes(local.toLowerCase()) ? ` em ${min(local)}` : ''}${desde ? ` ${/^há\s/i.test(desde) ? min(desde) : `há ${desde}`}` : ''}`,
      mudou === 'Sim' ? 'com mudança de cor, tamanho ou formato' : mudou === 'Não' ? 'sem mudança de cor, tamanho ou formato' : mudou === 'Não sei' ? 'não sabe se mudou de cor, tamanho ou formato' : '',
      sintomas.includes('Nenhum dos três') ? 'sem prurido, dor ou sangramento'
        : sintomas.length ? `com ${lista(sintomas.map((s) => SINTOMA[s] ?? min(s)))}` : '',
    ]
    queixa = partes.filter(Boolean).join(', ')
  }

  // ---- exposição e hábitos ----
  const a = dados.sexo === 'F' ? 'a' : dados.sexo === 'M' ? 'o' : 'o(a)'
  const protetor: Record<string, string> = { 'Todo dia': 'usa protetor solar diariamente', 'Às vezes': 'usa protetor solar às vezes', Raramente: 'raramente usa protetor solar', Nunca: 'não usa protetor solar' }
  const habitos = [
    dados.trabalhoExposto === 'sim' ? `trabalha expost${a} ao sol` : dados.trabalhoExposto === 'nao' ? `não trabalha expost${a} ao sol nem a produtos químicos` : '',
    protetor[um(r.protetor)] ?? '',
    um(r.bronzeamento) === 'Sim' ? 'refere bronzeamento artificial' : um(r.bronzeamento) === 'Não' ? 'nega bronzeamento artificial' : '',
    um(r.produtos) && `usa ${min(sem(um(r.produtos)))}`,
    um(r.acidos) && `iniciou ácido ou cosmético novo: ${min(sem(um(r.acidos)))}`,
    um(r.procedimentos) && `procedimentos estéticos prévios: ${min(sem(um(r.procedimentos)))}`,
    um(r.reacoes) && `reação prévia a produto: ${min(sem(um(r.reacoes)))}`,
  ].filter(Boolean)
  const frase = habitos.join('; ')

  // ---- antecedentes e alertas ----
  const ant: string[] = []
  const alergia = sem(um(r.alergias))
  if (alergia) ant.push(alergia === 'Não tenho alergia' ? 'Nega alergias.' : `Alergia a ${min(alergia)}.`)
  const pele = sem(um(r.cor_pele))
  const sol = sem(um(r.reacao_sol)).replace(/queimar/g, 'queima').replace(/bronzear/g, 'bronzeia')
  if (pele || sol) ant.push(`${pele ? `Pele ${min(pele)}` : 'Pele'}${sol ? `, ${min(sol)}` : ''}.`)
  if (um(r.doencas)) ant.push(`${sem(um(r.doencas))}.`)
  if (um(r.medicamentos)) ant.push(`Em uso de ${min(sem(um(r.medicamentos)))}.`)
  const gest = um(r.gestacao)
  if (gest) ant.push(gest === 'Não' ? 'Nega gestação e amamentação.' : gest === 'Grávida' ? 'Gestante.' : 'Amamentando.')
  const familia = txt(r.familia)
  if (familia.length) ant.push(familia.includes('Nenhum desses') ? 'Nega história familiar de doenças de pele.' : `História familiar de ${lista(familia.map(min))}.`)

  return { queixa, habitos: frase ? `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.` : '', antecedentes: ant }
}
