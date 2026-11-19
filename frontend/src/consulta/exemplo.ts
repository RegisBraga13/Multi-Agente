// Conteúdo de exemplo da consulta: transcrição, sinais de alerta e rascunhos da IA para o exame.
// Pacientes fictícios da agenda de exemplo (modulo/exemplo.ts); nada vem do banco nem de IA real.
import { agendaDoDia } from '../modulo/exemplo'
import type { Atendimento } from '../modulo/tipos'
import type { Extraido, Proveniencia } from './tipos'

/** `clinico`: como a IA escreve essa fala do paciente na história ('' = vai para antecedentes, não para a HDA) */
export type Fala = { quem: 'Médico' | 'Paciente'; texto: string; /** 'mm:ss' do início da gravação */ aos: string; clinico?: string }
/** `alergia` é o único aviso em vermelho; `sinal` = red flag, discreto */
export type Alerta = { id: string; tipo: 'alergia' | 'sinal'; texto: string }
export type CampoExame = { rotulo: string; valor: string; prov: Proveniencia }
export type Complementar = { exame: string; data: string; origem: string; itens: { nome: string; v: Extraido<string> }[] }

export type ConteudoConsulta = {
  falas: Fala[]
  /** perguntas que a IA lembra de fazer; o médico marca Sim/Não e a resposta vai para a história */
  perguntas: Pergunta[]
  alertas: Alerta[]
  /** fotos já anexadas ao exame físico */
  fotos: number
  /** lesões marcadas pela IA na foto 1 (posição em % da imagem inteira) */
  marcas: [number, number][]
  exame: CampoExame[]
  complementares: Complementar[]
}

export function buscarAtendimento(id: string, agora: Date): Atendimento | undefined {
  const data = id.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return undefined
  return agendaDoDia(data, agora).find((x) => x.id === id)
}

/** Campos do exame físico de Dermatologia (pacote da especialidade). */
const CAMPOS_DERMATO = ['Morfologia', 'Localização', 'Extensão', 'Gravidade estimada', 'Achados associados']

/** `relato`: o que o paciente conta além da queixa — [fala, como a IA escreve na história] */
type Rascunho = { exame: [string, string, string, string, string]; fotos: number; fala: string; alertas?: string[]; faltou?: string[]; marcas?: [number, number][]; relato?: [string, string][] }

/** Pergunta lembrada pela IA. `sim`/`nao`: como a resposta entra na história; `secao`: em que parte dela. */
export type Pergunta = { texto: string; sim: string; nao: string; secao: 'hda' | 'ant'; /** campo que o paciente não respondeu no formulário: só lembra (sem Sim/Não; a resposta vem da gravação) */ lembrete?: boolean }
export type RespostaPergunta = { pergunta: Pergunta; resposta: 'sim' | 'nao' }

const hda = (sim: string, nao: string) => ({ sim, nao, secao: 'hda' as const })
const ant = (sim: string, nao: string) => ({ sim, nao, secao: 'ant' as const })
/** Como cada resposta é escrita na história (contextualizada, em linguagem de prontuário). */
const COMO_RESPONDER: Record<string, Omit<Pergunta, 'texto'>> = {
  'Planeja engravidar nos próximos meses?': hda('Relata planejar gravidez nos próximos meses.', 'Relata não planejar gravidez.'),
  'Já usou algum remédio para acne, como antibiótico ou isotretinoína?': hda('Relata uso prévio de antibiótico ou isotretinoína para acne.', 'Nega uso prévio de antibiótico ou isotretinoína.'),
  'Sua menstruação é irregular ou tem excesso de pelos?': hda('Refere irregularidade menstrual ou excesso de pelos.', 'Nega irregularidade menstrual e excesso de pelos.'),
  'Tem dor ou inchaço nas articulações?': hda('Refere dor ou inchaço articular.', 'Nega dor ou inchaço articular.'),
  'Usa algum produto no rosto ou no cabelo?': hda('Refere uso de produtos no rosto ou no cabelo.', 'Nega uso de produtos no rosto ou no cabelo.'),
  'Alguém na família teve câncer de pele?': ant('História familiar de câncer de pele.', 'Nega história familiar de câncer de pele.'),
  'Usa protetor solar todos os dias?': hda('Refere uso diário de protetor solar.', 'Nega uso diário de protetor solar.'),
  'Alguém na família tem calvície?': ant('História familiar de calvície.', 'Nega história familiar de calvície.'),
  'Sente ardor ou areia nos olhos?': hda('Refere ardor e sensação de areia nos olhos.', 'Nega sintomas oculares.'),
  'Toma anticoagulante além do AAS?': ant('Refere uso de anticoagulante além do AAS.', 'Nega uso de anticoagulante além do AAS.'),
  'Usa luvas para lavar louça?': hda('Refere uso de luvas ao lavar louça.', 'Não usa luvas ao lavar louça.'),
  'Tem diabetes ou problema de circulação?': ant('Refere diabetes ou problema circulatório.', 'Nega diabetes e problemas circulatórios.'),
  'Começou algum remédio ou creme novo?': hda('Refere início recente de medicamento ou creme.', 'Nega medicamento ou creme novo.'),
  'Alguém em casa tem verrugas?': hda('Refere contato domiciliar com verrugas.', 'Nega contatos com verrugas.'),
  'Piora em época de estresse?': hda('Refere piora em períodos de estresse.', 'Nega piora com estresse.'),
}

// Rascunho da IA a partir das fotos, por paciente de exemplo.
const RASCUNHOS: Record<string, Rascunho> = {
  'Mariana Costa': {
    relato: [['Fico mexendo nelas. Minha pele é muito oleosa.', 'Manipulação frequente das lesões; refere pele oleosa.'], ['Nunca tratei. Não tenho febre.', 'Sem tratamento prévio. Nega febre.']],
    exame: ['Pápulas, pústulas e comedões', 'Região mandibular e malar; dorso', '7 lesões na face; dorso esparso', 'Moderada, a confirmar', 'Sem cicatrizes nas fotos'],
    fotos: 4, fala: 'Vou olhar o rosto e as costas com a luz.',
    faltou: ['Planeja engravidar nos próximos meses?', 'Já usou algum remédio para acne, como antibiótico ou isotretinoína?', 'Sua menstruação é irregular ou tem excesso de pelos?'],
    alertas: ['Nódulos dolorosos ou cicatrizes (acne grave)', 'Início súbito com sinais de virilização'],
    // as mesmas 7 lesões marcadas na foto da landing
    marcas: [[30.6, 16], [35.8, 32.1], [35.4, 44.2], [27.5, 50], [47.8, 60.3], [55.4, 63.5], [33.6, 64.7]],
  },
  'João Pedro Lima': {
    relato: [['Começou há uns dois anos e melhora no verão. Coça um pouco.', 'Início há cerca de dois anos, com melhora no verão e prurido leve.'], ['Já passei pomada de cortisona, melhora e volta.', 'Uso prévio de corticoide tópico, com melhora parcial e recidiva.']],
    exame: ['Placas eritematosas bem delimitadas com escamas prateadas', 'Cotovelos e joelhos, simétricas', 'Cerca de 4% da superfície corporal', 'Leve a moderada', 'Unhas sem depressões nas fotos'],
    fotos: 3, fala: 'Deixa eu ver os cotovelos e os joelhos.', faltou: ['Tem dor ou inchaço nas articulações?'],
  },
  'Beatriz Almeida': {
    relato: [['Aparece mais na época de prova. Às vezes espremo.', 'Piora em períodos de estresse, com manipulação ocasional.'], ['Uso protetor e base todo dia.', 'Uso diário de protetor solar e base.']],
    exame: ['Comedões abertos e fechados; poucas pápulas', 'Fronte', 'Restrita à testa', 'Leve', 'Sem cicatrizes'],
    fotos: 2, fala: 'Vou olhar a testa de perto.', faltou: ['Usa algum produto no rosto ou no cabelo?'],
  },
  'Carlos Henrique Rocha': {
    relato: [['Notei há uns seis meses. Às vezes coça, nunca sangrou.', 'Percebeu a mudança há cerca de seis meses, com prurido ocasional. Nega sangramento.'], ['Tomei muito sol na roça quando era jovem.', 'Exposição solar intensa na juventude.']],
    exame: ['Lesão pigmentada assimétrica, bordas irregulares, duas tonalidades', 'Dorso, região escapular direita', 'Lesão única, cerca de 8 mm', 'A definir na dermatoscopia', 'Outros nevos sem atipia nas fotos'],
    fotos: 3, fala: 'Vou examinar a pinta com o dermatoscópio.',
    alertas: ['Pinta mudou cor e tamanho (ABCDE)'], faltou: ['Alguém na família teve câncer de pele?'],
  },
  'Fernanda Oliveira': {
    relato: [['Apareceu depois que minha filha nasceu, há dois anos. Piora no sol.', 'Surgiram após a gestação, há cerca de dois anos, com piora à exposição solar.'], ['Uso protetor só às vezes.', 'Uso irregular de protetor solar.']],
    exame: ['Máculas acastanhadas de bordas irregulares', 'Região malar e lábio superior, simétricas', 'Face, cerca de 3% da superfície', 'Moderada', 'Sem eritema ou descamação'],
    fotos: 2, fala: 'Vou olhar as manchas com a lâmpada.', faltou: ['Usa protetor solar todos os dias?'],
  },
  'Rafael Monteiro': {
    relato: [['Meu pai também é calvo. Cai mais no banho.', 'Pai com calvície. Queda mais notada durante o banho.'], ['Não tive doença nem fiz dieta nos últimos meses.', 'Nega doença ou dieta restritiva recentes.']],
    exame: ['Rarefação de fios com miniaturização', 'Regiões frontotemporais e vértice', 'Padrão masculino, grau III', 'Moderada', 'Couro cabeludo sem descamação'],
    fotos: 3, fala: 'Vou olhar o couro cabeludo com o aparelho.', faltou: ['Alguém na família tem calvície?'],
  },
  'Luíza Fernandes': {
    relato: [['Fico vermelha com bebida quente e com o sol. Arde.', 'Rubor desencadeado por bebidas quentes e sol, com ardor.'], ['Isso já tem uns três anos.', 'Quadro há cerca de três anos.']],
    exame: ['Eritema persistente com telangiectasias', 'Região centrofacial (bochechas e nariz)', 'Face, sem pápulas', 'Leve a moderada', 'Sem alterações oculares relatadas'],
    fotos: 2, fala: 'Vou olhar o rosto sem maquiagem.', faltou: ['Sente ardor ou areia nos olhos?'],
  },
  'Antônio Barbosa': {
    relato: [['Sangra quando enxugo o rosto e faz casca.', 'Sangramento ao trauma leve, com formação de crosta.'], ['Trabalhei a vida toda no sol, na lavoura.', 'Exposição solar ocupacional crônica.']],
    exame: ['Pápula perolada com ulceração central e telangiectasias', 'Asa nasal esquerda', 'Lesão única, cerca de 6 mm', 'A definir na biópsia', 'Pele com dano solar crônico'],
    fotos: 2, fala: 'Vou examinar a ferida do nariz de perto.',
    alertas: ['Ferida não cicatriza há >4 sem'], faltou: ['Toma anticoagulante além do AAS?'],
  },
  'Camila Sampaio': {
    relato: [['Começou quando fui trabalhar de cozinheira, há quatro meses.', 'Início há cerca de quatro meses, ao começar a trabalhar como cozinheira.'], ['Melhora nas férias.', 'Melhora quando se afasta do trabalho.']],
    exame: ['Vesículas e descamação com fissuras', 'Dorso e palmas das mãos', 'Ambas as mãos', 'Moderada', 'Pele ressecada, sem sinais de infecção'],
    fotos: 2, fala: 'Me mostra as duas mãos, por favor.', faltou: ['Usa luvas para lavar louça?'],
  },
  'Gustavo Nogueira': {
    relato: [['Jogo bola toda semana e uso o vestiário.', 'Pratica futebol semanalmente e usa vestiário coletivo.'], ['Não dói, só incomoda o aspecto.', 'Sem dor; incômodo estético.']],
    exame: ['Espessamento e amarelamento da lâmina ungueal', 'Hálux direito', 'Uma unha acometida', 'Leve', 'Descamação entre os dedos'],
    fotos: 2, fala: 'Vou olhar as unhas dos pés.', faltou: ['Tem diabetes ou problema de circulação?'],
  },
  'Helena Martins': {
    relato: [['Começou depois que troquei o sabão em pó.', 'Início após troca do sabão em pó.'], ['Coça mais à noite.', 'Prurido com piora noturna.']],
    exame: ['Placas eritematosas com escoriações', 'Face anterior do antebraço direito', 'Uma área de cerca de 5 cm', 'Leve', 'Sem vesículas; escoriações de coçar'],
    fotos: 2, fala: 'Vou olhar o braço com a luz.', faltou: ['Começou algum remédio ou creme novo?'],
  },
  'Pedro Cavalcante': {
    relato: [['Apareceram há uns três meses e estão aumentando.', 'Lesões há cerca de três meses, em aumento.'], ['Ele rói a unha.', 'Hábito de roer as unhas.']],
    exame: ['Pápulas hiperceratósicas de superfície rugosa', 'Dedos das mãos', '5 lesões', 'Leve', 'Pontos escuros na superfície'],
    fotos: 2, fala: 'Vou olhar os dedos de perto.', faltou: ['Alguém em casa tem verrugas?'],
  },
  'Juliana Teixeira': {
    relato: [['Piora quando estou estressada e no frio.', 'Piora com estresse e no frio.'], ['Uso xampu anticaspa, melhora pouco.', 'Uso de xampu anticaspa, com melhora parcial.']],
    exame: ['Descamação fina e eritema leve', 'Couro cabeludo e sulcos nasogenianos', 'Difusa no couro cabeludo', 'Leve', 'Sem queda de cabelo'],
    fotos: 1, fala: 'Vou olhar o couro cabeludo.', faltou: ['Piora em época de estresse?'],
  },
}

const SEM_RASCUNHO: Rascunho = { exame: ['', '', '', '', ''], fotos: 0, fala: 'Vou examinar agora.' }

// Exames trazidos por alguns pacientes, com os valores extraídos pela IA dos laudos.
const COMPLEMENTARES: Record<string, Complementar[]> = {
  'Carlos Henrique Rocha': [{
    exame: 'Exames laboratoriais', data: '02/10/2026', origem: 'laudo-lab.pdf',
    itens: [
      { nome: 'Glicemia de jejum', v: { status: 'PRESENT', valor: '132 mg/dL', origem: 'pág. 1' } },
      { nome: 'Hemoglobina glicada', v: { status: 'INFERRED', valor: '7,1 %', origem: 'pág. 2, imagem borrada', aviso: 'Valor lido de imagem borrada. Confira no laudo.' } },
      { nome: 'Creatinina', v: { status: 'PRESENT', valor: '0,9 mg/dL', origem: 'pág. 1' } },
    ],
  }],
  'Antônio Barbosa': [{
    exame: 'Biópsia anterior (2024)', data: '15/03/2024', origem: 'anatomopatologico.pdf',
    itens: [
      { nome: 'Diagnóstico', v: { status: 'PRESENT', valor: 'Carcinoma basocelular nodular', origem: 'pág. 1, conclusão' } },
      { nome: 'Local', v: { status: 'PRESENT', valor: 'Região malar esquerda', origem: 'pág. 1' } },
      { nome: 'Margens', v: { status: 'MISSING', valor: null } },
    ],
  }],
  'João Pedro Lima': [{
    exame: 'Exames laboratoriais', data: '20/09/2026', origem: 'exames-set.pdf',
    itens: [
      { nome: 'TGO / TGP', v: { status: 'PRESENT', valor: '28 / 31 U/L', origem: 'pág. 2' } },
      { nome: 'Colesterol total', v: { status: 'PRESENT', valor: '214 mg/dL', origem: 'pág. 1' } },
    ],
  }],
}

/** "Pinta nas costas..." → "pinta nas costas..." (sem o ponto final), para continuar uma frase */
export function minuscula(t: string): string {
  const x = t.trim().replace(/\.$/, '')
  // sigla (AAS, FAN) fica como está
  return /^[A-ZÀ-Ú]{2}/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1)
}

function tempo(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function conteudoDaConsulta(at: Atendimento, slug: string): ConteudoConsulta {
  const nome = at.paciente.nome
  const r = slug === 'dermatologia' ? (RASCUNHOS[nome] ?? SEM_RASCUNHO) : SEM_RASCUNHO
  const f = at.ficha
  const falas: Omit<Fala, 'aos'>[] = [{ quem: 'Médico', texto: 'Bom dia! Me conta o que trouxe você aqui hoje.' }]
  const alertas: Alerta[] = []

  if (f.situacao === 'pronta') {
    falas.push({ quem: 'Paciente', texto: f.queixa, clinico: `refere ${minuscula(f.queixa)}` })
    ;(r.relato ?? []).forEach(([texto, clinico], i) => {
      falas.push({ quem: 'Médico', texto: i === 0 ? 'Desde quando? Piora com alguma coisa?' : 'Mais alguma coisa que eu deva saber?' })
      falas.push({ quem: 'Paciente', texto, clinico })
    })
    // remédios, doenças e alergias vão para "Antecedentes e alertas" (da ficha), não para a HDA
    falas.push({ quem: 'Médico', texto: 'Está usando algum remédio?' })
    falas.push({ quem: 'Paciente', texto: f.emUso.length ? `Uso ${f.emUso.join(' e ').toLowerCase()}.` : 'Não, nenhum.', clinico: '' })
    if (f.antecedentes.length) falas.push({ quem: 'Paciente', texto: `Tenho ${f.antecedentes.join(' e ').toLowerCase()}.`, clinico: '' })
    if (f.alergias.length) {
      falas.push({ quem: 'Médico', texto: 'E alergia a algum medicamento?' })
      falas.push({ quem: 'Paciente', texto: f.alergias.map((a) => (a.reacao ? `${a.substancia}, me deu ${a.reacao}` : a.substancia)).join('; ') + '.', clinico: '' })
      f.alergias.forEach((a, i) => alertas.push({ id: `alergia-${i}`, tipo: 'alergia', texto: `Alergia: ${a.substancia.toLowerCase()}${a.reacao ? ` (${a.reacao})` : ''}` }))
    }
  } else {
    falas.push({ quem: 'Paciente', texto: 'Vim por causa de um problema na pele.', clinico: 'procura atendimento por queixa de pele' })
    falas.push({ quem: 'Médico', texto: 'Desde quando? Está usando algum remédio?' })
  }
  falas.push({ quem: 'Médico', texto: r.fala })
  ;(r.alertas ?? []).forEach((t, i) => alertas.push({ id: `sinal-${i}`, tipo: 'sinal', texto: t }))

  return {
    falas: falas.map((x, i) => ({ ...x, aos: tempo(8 + i * 26) })),
    perguntas: (r.faltou ?? []).map((texto) => ({ texto, ...(COMO_RESPONDER[texto] ?? hda(`${texto} Sim.`, `${texto} Não.`)) })),
    alertas,
    fotos: r.fotos,
    marcas: r.marcas ?? [],
    exame: CAMPOS_DERMATO.map((rotulo, i) => ({ rotulo, valor: r.exame[i], prov: 'inferido_ia' })),
    complementares: COMPLEMENTARES[nome] ?? [],
  }
}
