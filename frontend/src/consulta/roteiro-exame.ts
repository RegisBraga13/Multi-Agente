// Exame físico por roteiro: partes que abrem e fecham ("Pronto ›"), cada uma com linhas de opções para marcar.
// Pacote de dados da especialidade (o componente é o mesmo para todas). Hoje: Reumatologia, texto do autor de
// 24/11/2026 (docs/especialidades/reumatologia-exame-fisico.md). A Dermatologia segue com os campos de texto.

/** Uma linha do roteiro: `multipla` = marca quantas quiser; senão, uma só (tocar de novo desmarca). */
export type LinhaRoteiro = { id: string; rotulo: string; opcoes: string[]; multipla: boolean; grupo?: string }
/** `frase(marcadas)`: como a parte entra no texto do exame (só com o que foi marcado). */
export type ParteRoteiro = { id: string; titulo: string; rotuloTexto: string; linhas: LinhaRoteiro[]; ajuda?: string }
export type Roteiro = ParteRoteiro[]
/** O que o médico marcou: "parte.linha" → opções marcadas. */
export type MarcasExame = Record<string, string[]>

const DE = ['D', 'E']
const uma = (id: string, rotulo: string, opcoes: string[], grupo?: string): LinhaRoteiro => ({ id, rotulo, opcoes, multipla: false, grupo })
const varias = (id: string, rotulo: string, opcoes: string[], grupo?: string): LinhaRoteiro => ({ id, rotulo, opcoes, multipla: true, grupo })
const lado = (id: string, rotulo: string, grupo: string) => varias(id, rotulo, DE, grupo)
const sim = (id: string, rotulo: string, grupo: string) => varias(id, rotulo, ['Sim'], grupo)

const REUMATOLOGIA: Roteiro = [
  {
    id: 'gals', titulo: 'GALS', rotuloTexto: 'GALS',
    linhas: [
      uma('marcha', 'Marcha', ['Normal', 'Claudicante', 'Assimétrica']),
      uma('bracos', 'Braços', ['Normal', 'Alterado']),
      uma('pernas', 'Pernas', ['Normal', 'Alterado']),
      uma('coluna', 'Coluna', ['Normal', 'Alterada']),
    ],
  },
  {
    id: 'mapa', titulo: 'Mapa articular', rotuloTexto: 'Articulações acometidas', ajuda: 'D = direita · E = esquerda',
    linhas: [
      lado('ombro', 'Ombro', 'MMSS'), lado('cotovelo', 'Cotovelo', 'MMSS'), lado('punho', 'Punho', 'MMSS'),
      lado('mcf', 'MCFs', 'MMSS'), lado('ifp', 'IFPs', 'MMSS'), lado('ifd', 'IFDs', 'MMSS'),
      lado('quadril', 'Quadril', 'MMII'), lado('joelho', 'Joelho', 'MMII'), lado('tornozelo', 'Tornozelo', 'MMII'),
      lado('tarso', 'Mediopé/Tarso', 'MMII'), lado('mtf', 'MTFs', 'MMII'), lado('ifpe', 'IFs (pés)', 'MMII'),
      lado('atm', 'ATM', 'Axial e outras'), lado('ecac', 'EC/AC', 'Axial e outras'),
      sim('cervical', 'Coluna cervical', 'Axial e outras'), sim('toracica', 'Coluna torácica', 'Axial e outras'),
      sim('lombar', 'Coluna lombar', 'Axial e outras'), lado('si', 'Sacroilíacas', 'Axial e outras'),
    ],
  },
  {
    id: 'ipam', titulo: 'IPAM', rotuloTexto: 'IPAM',
    linhas: [
      varias('inspecao', 'Inspeção', ['Edema articular', 'Eritema/rubor', 'Deformidade', 'Atrofia muscular adjacente']),
      varias('palpacao', 'Palpação', ['Calor local', 'Dor à palpação da linha articular', 'Espessamento sinovial', 'Derrame articular', 'Dor em enteses/bursas']),
      uma('adm_ativa', 'ADM ativa', ['Preservada', 'Limitada por dor/fraqueza']),
      uma('adm_passiva', 'ADM passiva', ['Preservada', 'Limitada (bloqueio/contratura)']),
      varias('crepitacao', 'Crepitação', ['Palpável/audível']),
      varias('mao', 'Mão/Punho', ['Phalen', 'Tinel', 'Finkelstein', 'Squeeze MCF/MTF'], 'Manobras positivas'),
      varias('ombro', 'Ombro', ['Neer', 'Hawkins', 'Jobe', 'Patte'], 'Manobras positivas'),
      varias('joelho', 'Joelho', ['Tecla/Rechaço', 'Gaveta ant/post', 'Lachman', 'McMurray'], 'Manobras positivas'),
      varias('coluna', 'Coluna/SI', ['Schober', 'Patrick (FABERE)', 'Gaenslen', 'Lasègue'], 'Manobras positivas'),
    ],
  },
  {
    id: 'padrao', titulo: 'Padrão', rotuloTexto: 'Padrão',
    linhas: [
      uma('numero', 'Número', ['Mono (1)', 'Oligo (2–4)', 'Poli (≥ 5)']),
      uma('simetria', 'Simetria', ['Simétrico', 'Assimétrico']),
      uma('local', 'Localização', ['Periférico', 'Axial', 'Misto']),
      uma('natureza', 'Natureza', ['Inflamatório', 'Mecânico', 'Difuso/Nociplástico']),
    ],
  },
  {
    id: 'extra', titulo: 'Extra-articular', rotuloTexto: 'Extra-articular',
    linhas: [
      varias('achados', 'Achados', ['Psoríase/pitting ungueal', 'Eritema malar/fotossensibilidade', 'Raynaud/esclerodactilia',
        'Úlceras orais ou nasais', 'Olho seco/hiperemia ocular', 'Nódulos subcutâneos/tofos']),
    ],
  },
]

const ROTEIROS: Partial<Record<string, Roteiro>> = { reumatologia: REUMATOLOGIA }

/** O roteiro do exame da especialidade; undefined = exame com campos de texto (Dermatologia). */
export const roteiroDoExame = (especialidade: string): Roteiro | undefined => ROTEIROS[especialidade]

export const chaveDaLinha = (parte: ParteRoteiro, linha: LinhaRoteiro) => `${parte.id}.${linha.id}`

/** Marca ou desmarca: em linha de uma resposta, a nova troca a anterior; tocar de novo desmarca. */
export function alternarMarca(marcas: MarcasExame, chave: string, opcao: string, multipla: boolean): MarcasExame {
  const atuais = marcas[chave] ?? []
  const novas = atuais.includes(opcao) ? atuais.filter((o) => o !== opcao) : multipla ? [...atuais, opcao] : [opcao]
  const resto = Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== chave))
  return novas.length ? { ...resto, [chave]: novas } : resto
}

const minuscula = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const ponto = (t: string) => (t.endsWith('.') ? t : `${t}.`)
/** concordância do GALS: "braços normais", "pernas alteradas", "coluna alterada" */
const FEMININO_PLURAL = new Set(['pernas'])
const PLURAL = new Set(['bracos', 'pernas'])
function estadoGals(linha: LinhaRoteiro, valor: string): string {
  const v = valor.toLowerCase()
  if (linha.id === 'marcha') return `marcha ${v}`
  const plural = PLURAL.has(linha.id)
  const feminino = FEMININO_PLURAL.has(linha.id) || linha.id === 'coluna'
  const base = v === 'normal' ? (plural ? 'normais' : 'normal') : feminino ? (plural ? 'alteradas' : 'alterada') : plural ? 'alterados' : 'alterado'
  return `${linha.rotulo.toLowerCase()} ${base}`
}

/** O texto de uma parte, só com o que foi marcado; null = parte não examinada (nada marcado). */
export function textoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string | null {
  const de = (l: LinhaRoteiro) => marcas[chaveDaLinha(parte, l)] ?? []
  const marcadas = parte.linhas.filter((l) => de(l).length)
  if (!marcadas.length) return null
  switch (parte.id) {
    case 'gals':
      return ponto(minuscula(marcadas.map((l) => estadoGals(l, de(l)[0])).join('; ')).replace(/^./, (c) => c.toUpperCase()))
    case 'mapa':
      // "Ombro D; MCFs D e E; coluna lombar."
      return ponto(marcadas.map((l) => (l.opcoes.length === 1 ? l.rotulo : `${l.rotulo} ${lista(de(l))}`)).map((t, i) => (i ? minuscula(t) : t)).join('; '))
    case 'ipam': {
      const frases: string[] = []
      for (const l of marcadas.filter((x) => !x.grupo)) {
        if (l.id === 'inspecao' || l.id === 'palpacao') frases.push(`${l.rotulo}: ${lista(de(l).map(minuscula))}.`)
        else if (l.id === 'crepitacao') frases.push('Crepitação palpável/audível.')
        else frases.push(`${l.rotulo} ${minuscula(de(l)[0])}.`)
      }
      const manobras = marcadas.filter((x) => x.grupo === 'Manobras positivas')
      if (manobras.length) frases.push(`Manobras positivas: ${manobras.map((l) => `${de(l).join(', ')} (${l.rotulo.toLowerCase().replace('/si', '/SI')})`).join('; ')}.`)
      return frases.join(' ')
    }
    case 'padrao':
      return ponto(marcadas.map((l) => de(l)[0]).map((t, i) => (i ? minuscula(t) : t)).join(', '))
    default:
      return ponto(marcadas.flatMap(de).map((t, i) => (i ? minuscula(t) : t)).join('; '))
  }
}

/** Resumo de uma linha para a parte fechada ("Marcha claudicante · Pernas alteradas"). */
export function resumoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string {
  return (textoDaParte(parte, marcas) ?? '').replace(/\.$/, '').replace(/; /g, ' · ')
}

/** Retorno: no fim, antes das Observações, a comparação com a consulta anterior (autor, 24/11/2026). */
export const COMPARADO = { chave: 'retorno.comparado', rotulo: 'Comparado à consulta anterior', opcoes: ['Melhor', 'Igual', 'Pior'] }

/** O exame inteiro em campos de texto (parte → texto), como vai para o servidor e para a história. */
export function camposDoRoteiro(roteiro: Roteiro, marcas: MarcasExame, retorno = false): { rotulo: string; valor: string | null }[] {
  const campos = roteiro.map((p) => ({ rotulo: p.rotuloTexto, valor: textoDaParte(p, marcas) }))
  return retorno ? [...campos, { rotulo: COMPARADO.rotulo, valor: marcas[COMPARADO.chave]?.[0] ?? null }] : campos
}
