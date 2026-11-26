// Exame físico por roteiro: partes que abrem e fecham ("Pronto ›"), cada uma com linhas de opções para marcar.
// Pacote de dados da especialidade (o componente é o mesmo para todas). Textos do autor:
// Reumatologia 24/11/2026 (docs/especialidades/reumatologia-exame-fisico.md),
// Dermatologia 26/11/2026 (docs/especialidades/dermatologia-exame-fisico.md).

/** Caixinha de número de uma linha (ex.: PA, FC, dimensões); guardada em "parte.linha#id". */
export type CampoNumero = { id: string; antes?: string; depois?: string; largura?: number }
/**
 * Uma linha do roteiro: `multipla` = marca quantas quiser; senão, uma só (tocar de novo desmarca).
 * `outro`: a última opção ("Outro") abre uma linha para escrever (guardada em "parte.linha#outro").
 * `numeros`: caixinhas de número (só entram se preenchidas). `rotuloTexto`: o nome da linha no texto do exame.
 * `campoProprio`: a linha sai do texto da parte e vira um campo do exame com esse nome (ex.: "Extensão", que o
 * retorno compara em %).
 */
export type LinhaRoteiro = {
  id: string; rotulo: string; opcoes: string[]; multipla: boolean; grupo?: string
  outro?: boolean; numeros?: CampoNumero[]; rotuloTexto?: string; campoProprio?: string
}
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
/** "Outro" no fim da lista, abrindo uma linha para escrever */
const comOutro = (l: LinhaRoteiro, texto?: string): LinhaRoteiro => ({ ...l, opcoes: [...l.opcoes, 'Outro'], outro: true, rotuloTexto: texto ?? l.rotuloTexto })
const texto = (l: LinhaRoteiro, rotuloTexto: string): LinhaRoteiro => ({ ...l, rotuloTexto })

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

/** Dermatologia (autor, 26/11/2026). Combinado na tela: sem data/hora/examinador/assinatura (o app já sabe);
 * "Outro" abre linha; sinais vitais e dimensões em caixinhas; as "Descrição" viram as Observações do fim;
 * Lesões cutâneas em duas partes (3a e 3b) para caber na tela; 3b ganha Extensão (%) e Gravidade; uma resposta
 * só em estado geral, consciência, fototipo, temperatura, turgor e gravidade. */
const DERMATOLOGIA: Roteiro = [
  {
    id: 'geral', titulo: 'Avaliação geral', rotuloTexto: 'Avaliação geral',
    linhas: [
      comOutro(uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido'])),
      comOutro(uma('consciencia', 'Consciência', ['Alerta', 'Sonolento', 'Confuso'])),
      { ...varias('vitais', 'Sinais vitais', []), numeros: [
        { id: 'pa', antes: 'PA', depois: 'mmHg', largura: 64 }, { id: 'fc', antes: 'FC', depois: 'bpm' },
        { id: 'fr', antes: 'FR', depois: 'irpm' }, { id: 'temp', antes: 'T', depois: '°C' }, { id: 'spo2', antes: 'SpO₂', depois: '%' },
      ] },
    ],
  },
  {
    id: 'pele', titulo: 'Pele', rotuloTexto: 'Pele',
    linhas: [
      uma('fototipo', 'Fototipo', ['I', 'II', 'III', 'IV', 'V', 'VI', 'Não avaliado']),
      varias('hidratacao', 'Hidratação', ['Adequada', 'Ressecada', 'Muito ressecada', 'Oleosa', 'Mista']),
      comOutro(varias('coloracao', 'Coloração', ['Habitual', 'Palidez', 'Eritema', 'Cianose', 'Icterícia', 'Hiperpigmentação', 'Hipopigmentação'])),
      uma('temperatura', 'Temperatura', ['Habitual', 'Aumentada', 'Diminuída', 'Não avaliada']),
      texto(uma('turgor', 'Turgor', ['Preservados', 'Reduzidos', 'Não avaliados']), 'Turgor e elasticidade'),
      comOutro(varias('textura', 'Textura', ['Habitual', 'Áspera', 'Lisa', 'Espessada', 'Atrófica', 'Descamação', 'Liquenificação']), 'Textura e superfície'),
      comOutro(varias('achados', 'Achados', ['Sem lesões evidentes', 'Lesões presentes', 'Cicatrizes', 'Estrias', 'Atrofia', 'Alterações vasculares'])),
    ],
  },
  {
    id: 'lesoes', titulo: 'Lesões', rotuloTexto: 'Lesões',
    linhas: [
      comOutro(varias('primaria', 'Primária', ['Mácula', 'Mancha', 'Pápula', 'Placa', 'Nódulo', 'Tumor', 'Vesícula', 'Bolha', 'Pústula', 'Cisto', 'Urtica', 'Púrpura', 'Petéquia', 'Equimose', 'Telangiectasia']), 'Lesão primária'),
      comOutro(varias('secundaria', 'Secundária', ['Escama', 'Crosta', 'Erosão', 'Escoriação', 'Fissura', 'Úlcera', 'Cicatriz', 'Atrofia', 'Liquenificação', 'Esclerose', 'Necrose']), 'Lesão secundária'),
      varias('numero', 'Número', ['Única', 'Poucas', 'Múltiplas', 'Disseminadas', 'Agrupadas', 'Simétricas', 'Assimétricas', 'Localizadas']),
      comOutro(varias('arranjo', 'Arranjo', ['Linear', 'Anular', 'Policíclico', 'Reticulado', 'Serpiginoso', 'Herpetiforme', 'Zosteriforme', 'Confluente'])),
      comOutro(varias('cor', 'Cor', ['Eritematosa', 'Castanha', 'Enegrecida', 'Violácea', 'Hipocrômica', 'Acrômica', 'Amarelada'])),
    ],
  },
  {
    id: 'local', titulo: 'Local e aspecto', rotuloTexto: 'Local e aspecto',
    linhas: [
      comOutro(varias('localizacao', 'Localização', ['Couro cabeludo', 'Face', 'Pálpebras', 'Lábios', 'Orelhas', 'Pescoço', 'Tronco anterior', 'Dorso', 'Axilas', 'Braços', 'Antebraços', 'Mãos', 'Palmas', 'Unhas', 'Coxas', 'Pernas', 'Pés', 'Plantas', 'Dobras', 'Genitais', 'Região perianal', 'Mucosas'])),
      comOutro(varias('distribuicao', 'Distribuição', ['Fotoexposta', 'Flexural', 'Extensora', 'Acral', 'Intertriginosa', 'Dermatomérica', 'Generalizada'])),
      { ...uma('dimensoes', 'Dimensões', ['mm', 'cm', 'Não medidas']), numeros: [{ id: 'a', largura: 44 }, { id: 'b', antes: '×', largura: 44 }] },
      { ...varias('extensao', 'Extensão', []), numeros: [{ id: 'pct', depois: '% do corpo', largura: 48 }], campoProprio: 'Extensão' },
      uma('gravidade', 'Gravidade', ['Leve', 'Moderada', 'Grave']),
      comOutro(varias('contornos', 'Contornos', ['Bem definidos', 'Mal definidos', 'Regulares', 'Irregulares', 'Elevados', 'Infiltrados']), 'Contornos e limites'),
      comOutro(varias('superficie', 'Superfície', ['Lisa', 'Brilhante', 'Áspera', 'Verrucosa', 'Ceratósica', 'Umbilicada', 'Erosada', 'Ulcerada', 'Com escamas', 'Com crostas'])),
      comOutro(varias('palpacao', 'Palpação', ['Plana', 'Elevada', 'Deprimida', 'Infiltrada', 'Endurecida', 'Flutuante', 'Móvel', 'Aderida', 'Dolorosa', 'Pruriginosa'])),
    ],
  },
  {
    id: 'anexos', titulo: 'Anexos', rotuloTexto: 'Anexos',
    linhas: [
      comOutro(varias('couro', 'Couro cab.', ['Sem alterações', 'Eritema', 'Descamação', 'Crostas', 'Pústulas', 'Cicatrizes'], 'Cabelos'), 'Couro cabeludo'),
      comOutro(varias('cabelos', 'Densidade', ['Preservadas', 'Rarefação difusa', 'Rarefação localizada', 'Alopecia cicatricial', 'Alopecia não cicatricial'], 'Cabelos'), 'Distribuição e densidade dos cabelos'),
      comOutro(varias('hastes', 'Hastes', ['Sem alterações aparentes', 'Fragilidade', 'Quebra', 'Alteração de calibre'], 'Cabelos'), 'Hastes capilares'),
      comOutro(varias('unhas', 'Unhas', ['Sem alterações', 'Alteração de cor', 'Espessamento', 'Onicólise', 'Descolamento', 'Estrias', 'Pitting', 'Fragilidade', 'Distrofia'], 'Unhas')),
      comOutro(varias('unhas_onde', 'Onde', ['Uma unha', 'Múltiplas unhas', 'Mãos', 'Pés'], 'Unhas'), 'Unhas acometidas'),
      comOutro(varias('pelos', 'Pelos', ['Distribuição preservada', 'Hipertricose', 'Hirsutismo', 'Hipotricose', 'Alopecia localizada'], 'Pelos')),
    ],
  },
  {
    id: 'mucosas', titulo: 'Mucosas', rotuloTexto: 'Mucosas',
    linhas: [
      comOutro(varias('examinadas', 'Examinadas', ['Oral', 'Ocular', 'Nasal', 'Genital', 'Não examinadas']), 'Mucosas examinadas'),
      comOutro(varias('achados', 'Achados', ['Sem alterações', 'Eritema', 'Máculas', 'Pápulas', 'Vesículas', 'Erosões', 'Úlceras', 'Placas', 'Pigmentação'])),
    ],
  },
  {
    id: 'linfonodos', titulo: 'Linfonodos', rotuloTexto: 'Linfonodos',
    linhas: [
      comOutro(varias('cadeias', 'Cadeias', ['Cervicais', 'Submandibulares', 'Axilares', 'Inguinais']), 'Cadeias avaliadas'),
      varias('achados', 'Achados', ['Não palpáveis', 'Palpáveis', 'Dolorosos', 'Indolores', 'Móveis', 'Aderidos']),
    ],
  },
  {
    id: 'registro', titulo: 'Registro fotográfico', rotuloTexto: 'Registro de imagem',
    linhas: [
      varias('imagem', 'Registro', ['Fotografias realizadas', 'Dermatoscopia realizada', 'Sem registro de imagem']),
    ],
  },
]

const ROTEIROS: Partial<Record<string, Roteiro>> = { reumatologia: REUMATOLOGIA, dermatologia: DERMATOLOGIA }

/** O roteiro do exame da especialidade; undefined = exame com campos de texto (especialidade sem roteiro). */
export const roteiroDoExame = (especialidade: string): Roteiro | undefined => ROTEIROS[especialidade]

export const chaveDaLinha = (parte: ParteRoteiro, linha: LinhaRoteiro) => `${parte.id}.${linha.id}`

/** Opção que exclui as outras da linha ("Sem alterações", "Não examinadas", "Não palpáveis"…), como o "Nenhum desses"
 * do formulário: marcá-la limpa as outras; marcar outra a desmarca. */
export const exclusiva = (opcao: string) => /^(Sem |Não )/.test(opcao)

/** Marca ou desmarca: em linha de uma resposta, a nova troca a anterior; tocar de novo desmarca. */
export function alternarMarca(marcas: MarcasExame, chave: string, opcao: string, multipla: boolean): MarcasExame {
  const atuais = marcas[chave] ?? []
  const novas = atuais.includes(opcao)
    ? atuais.filter((o) => o !== opcao)
    : !multipla || exclusiva(opcao) ? [opcao] : [...atuais.filter((o) => !exclusiva(o)), opcao]
  const resto = Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== chave && !(k === `${chave}#outro` && !novas.includes('Outro'))))
  return novas.length ? { ...resto, [chave]: novas } : resto
}

/** Escreve numa caixinha (número ou "Outro"): vazio apaga. */
export function escreverCampo(marcas: MarcasExame, chave: string, valor: string): MarcasExame {
  const resto = Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== chave))
  return valor.trim() ? { ...resto, [chave]: [valor] } : resto
}

// siglas ("ADM", "MCFs") e números romanos (fototipo "I", "V") ficam como estão
const minuscula = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) || /^[IVX]+$/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
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

const valorCampo = (marcas: MarcasExame, chave: string) => marcas[chave]?.[0]?.trim() ?? ''

/** As opções marcadas da linha, com o "Outro" trocado pelo que o médico escreveu (sem texto, fica de fora). */
function marcadasDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string[] {
  const chave = chaveDaLinha(parte, l)
  const outro = valorCampo(marcas, `${chave}#outro`)
  return (marcas[chave] ?? []).flatMap((o) => (l.outro && o === 'Outro' ? (outro ? [outro] : []) : [o]))
}

/** Caixinhas de número em texto: "PA 120/80 mmHg, FC 80 bpm"; dimensões "12 × 8 mm"; vazio = "". */
function numerosDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string {
  if (!l.numeros) return ''
  const chave = chaveDaLinha(parte, l)
  const cheios = l.numeros.map((n) => ({ n, v: valorCampo(marcas, `${chave}#${n.id}`) })).filter((x) => x.v)
  if (l.id === 'dimensoes') {
    if (!cheios.length) return ''
    const unidade = (marcas[chave] ?? []).find((o) => o === 'mm' || o === 'cm') ?? ''
    return [cheios.map((x) => x.v).join(' × '), unidade].filter(Boolean).join(' ')
  }
  return cheios.map(({ n, v }) => [n.antes, `${v}${n.depois?.startsWith('%') ? '' : n.depois ? ' ' : ''}${n.depois ?? ''}`].filter(Boolean).join(' ')).join(', ')
}

/** O que a linha diz, em texto: números e opções ("12 × 8 mm"; "ressecada, oleosa"); "" = nada. */
function valorDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string {
  const numeros = numerosDaLinha(parte, l, marcas)
  const opcoes = marcadasDaLinha(parte, l, marcas).filter((o) => !(l.id === 'dimensoes' && numeros && (o === 'mm' || o === 'cm')))
  return [numeros, lista(opcoes.map(minuscula))].filter(Boolean).join(', ')
}

/** O texto de uma parte, só com o que foi marcado; null = parte não examinada (nada marcado). */
export function textoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string | null {
  const de = (l: LinhaRoteiro) => marcadasDaLinha(parte, l, marcas)
  const linhasDoTexto = parte.linhas.filter((l) => !l.campoProprio)
  const marcadas = linhasDoTexto.filter((l) => valorDaLinha(parte, l, marcas))
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
      // uma linha só (ex.: Extra-articular): as opções; várias (ex.: Dermatologia): "Hidratação: ressecada; cor: …"
      if (linhasDoTexto.length === 1) return ponto(marcadas.flatMap(de).map((t, i) => (i ? minuscula(t) : t)).join('; '))
      return ponto(marcadas.map((l, i) => `${i ? minuscula(l.rotuloTexto ?? l.rotulo) : (l.rotuloTexto ?? l.rotulo)}: ${valorDaLinha(parte, l, marcas)}`).join('; '))
  }
}

/** As linhas com campo próprio (ex.: Extensão), em texto; vazio = não preenchida. */
function camposProprios(roteiro: Roteiro, marcas: MarcasExame): { rotulo: string; valor: string | null }[] {
  return roteiro.flatMap((p) => p.linhas.filter((l) => l.campoProprio).map((l) => ({ rotulo: l.campoProprio!, valor: valorDaLinha(p, l, marcas) || null })))
}

/** Resumo de uma linha para a parte fechada ("Marcha claudicante · Pernas alteradas"). */
export function resumoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string {
  const proprios = parte.linhas.filter((l) => l.campoProprio).map((l) => valorDaLinha(parte, l, marcas)).filter(Boolean).map((v) => `extensão ${v}`)
  return [(textoDaParte(parte, marcas) ?? '').replace(/\.$/, ''), ...proprios].filter(Boolean).join('; ').replace(/; /g, ' · ')
}

/** A parte tem algo preenchido (marca, número ou campo próprio)? */
export const parteFeita = (parte: ParteRoteiro, marcas: MarcasExame) => parte.linhas.some((l) => valorDaLinha(parte, l, marcas))

/** Retorno: no fim, antes das Observações, a comparação com a consulta anterior (autor, 24/11/2026). */
export const COMPARADO = { chave: 'retorno.comparado', rotulo: 'Comparado à consulta anterior', opcoes: ['Melhor', 'Igual', 'Pior'] }

/** O exame inteiro em campos de texto (parte → texto), como vai para o servidor e para a história. */
export function camposDoRoteiro(roteiro: Roteiro, marcas: MarcasExame, retorno = false): { rotulo: string; valor: string | null }[] {
  const campos = [...roteiro.map((p) => ({ rotulo: p.rotuloTexto, valor: textoDaParte(p, marcas) })), ...camposProprios(roteiro, marcas)]
  return retorno ? [...campos, { rotulo: COMPARADO.rotulo, valor: marcas[COMPARADO.chave]?.[0] ?? null }] : campos
}
