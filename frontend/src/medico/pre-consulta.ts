// Perguntas da pré-consulta: parte do "pacote" de cada especialidade.
// O formulário é o mesmo para todas; só as partes e as perguntas mudam.
// Especialidade sem pacote próprio usa as perguntas gerais.
// Quando o médico puder editar o próprio modelo (tela CF-04), isto passa para o banco.
import type { DadosPessoais } from './regras'

/** 'arquivos': vários arquivos (foto ou PDF), como receitas anteriores, exames e laudos */
export type TipoPergunta = 'texto' | 'texto-longo' | 'escolha' | 'varias' | 'foto' | 'arquivos'

export type Pergunta = {
  /** chave da resposta; estável, para o banco */
  id: string
  rotulo: string
  tipo: TipoPergunta
  placeholder?: string
  ajuda?: string
  /** 'escolha' (uma) e 'varias' (quantas quiser) */
  opcoes?: readonly string[]
  /** em 'varias': a opção que desmarca as outras ("Nenhum…") */
  exclusiva?: string
  /** só aparece para quem marcou esse sexo nos dados pessoais */
  soParaSexo?: 'F' | 'M'
  /** sem resposta, o formulário não avança (e a consulta não começa) */
  obrigatoria?: boolean
  /** botão que responde "não tenho" com um toque; a resposta vira este texto */
  semResposta?: string
  /** no formulário do paciente, ocupa a linha toda (mantém a ordem das perguntas) */
  linhaToda?: boolean
  /** escolha única num campo que abre, escolhe e fecha (economiza espaço; autor, 25/11) */
  lista?: boolean
  /** opções em duas colunas (no PC), lidas de cima para baixo (autor, 24/11) */
  duasColunas?: boolean
  /** a opção que, marcada, abre uma linha para escrever (ex.: "Outro"); o texto vai em `${id}_qual` */
  abreLinha?: string
  /** dica que aparece quando a opção é marcada */
  dica?: { opcao: string; texto: string }
  /** fileira de notas 0 a 10, com "sem dor" e "pior dor" nas pontas */
  escala?: boolean
  /** 'arquivos' só de fotos (sem PDF) */
  soFotos?: boolean
  /** sem rótulo próprio: o título da parte já é a pergunta */
  semRotulo?: boolean
  /** só aparece quando outra pergunta tem esta opção marcada (ex.: nota da dor só se marcou "Dói") */
  soSe?: { pergunta: string; opcao: string }
  /** texto curto do lembrete em Perguntas, na consulta (quando o rótulo é longo) */
  lembrete?: string
}

/** Chave do texto escrito na linha que a opção `abreLinha` abre. */
export const chaveDaLinha = (id: string) => `${id}_qual`

/** `colunas`: no PC, a parte em duas colunas com estas perguntas (ids) em cada uma, para caber numa tela */
/** `semPular`: só Voltar e Próximo (a parte já é opcional; autor, 24/11) */
/** `compacta`: opções mais baixas, para a parte caber numa tela */
export type Parte = { titulo: string; perguntas: Pergunta[]; nota?: string; colunas?: [string[], string[]]; semPular?: boolean; compacta?: boolean }

/** Respostas da pré-consulta, pela chave de cada pergunta (as fotos vão à parte). */
export type RespostasPreConsulta = Record<string, string | string[]>

const QUEIXA: Pergunta = { id: 'queixa', rotulo: 'Qual o motivo da sua consulta?', tipo: 'texto-longo' }
const DESDE: Pergunta = { id: 'desde_quando', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: uns três meses' }
/** Alergias: em Saúde geral, opcional (pedido do autor, 19/11/2026); na consulta, sempre aparece em Perguntas. */
export const ALERGIAS: Pergunta = {
  id: 'alergias', rotulo: 'Alergias', tipo: 'texto', semResposta: 'Não tenho alergia',
  placeholder: 'Ex.: dipirona, níquel',
}
const SIM_NAO = ['Sim', 'Não'] as const
const OUTRO = 'Outro'

/** Nota da dor: em todos os módulos, sempre que houver dor (autor, 24/11/2026). */
export const NOTA_DOR: Pergunta = {
  id: 'nota_dor', rotulo: 'Em uma escala de 0 a 10, qual nota você dá para a sua dor na última semana?', tipo: 'escolha',
  opcoes: Array.from({ length: 11 }, (_, i) => String(i)), escala: true, lembrete: 'Nota da dor (0 a 10)',
}

/** Última parte de todos os formulários: o que o formulário não perguntou (autor, 24/11/2026). */
export const ALGO_MAIS: Parte = {
  titulo: 'Algo mais que seu médico deva saber?',
  semPular: true,
  perguntas: [{ id: 'algo_mais', rotulo: 'Algo mais que seu médico deva saber?', tipo: 'texto-longo', semRotulo: true, placeholder: 'Escreva com suas palavras.' }],
}

/** Aviso na parte de fotos: enviar e também trazer no dia (todos os módulos; autor, 24/11/2026). */
export const AVISO_TRAZER = 'Traga também no dia da consulta os exames (mesmo os antigos) e as fotos no celular.'

const GERAIS: Parte[] = [
  { titulo: 'Queixa principal', perguntas: [QUEIXA, DESDE] },
  {
    titulo: 'Saúde geral',
    perguntas: [{ id: 'medicamentos', rotulo: 'Medicamentos que usa ou já usou', tipo: 'texto-longo' }, ALERGIAS],
  },
  ALGO_MAIS,
]

// Modelo de anamnese dermatológica trazido pelo autor (15/11/2026).
const DERMATOLOGIA: Parte[] = [
  {
    titulo: 'Queixa principal',
    perguntas: [
      QUEIXA,
      { id: 'local', rotulo: 'Onde fica a lesão ou o incômodo?', tipo: 'texto', placeholder: 'Ex.: rosto, costas, couro cabeludo' },
      { id: 'desde_quando', rotulo: 'Há quanto tempo apareceu?', tipo: 'texto', placeholder: 'Ex.: uns três meses' },
      { id: 'mudou', rotulo: 'Mudou de cor, tamanho ou formato?', tipo: 'escolha', opcoes: ['Sim', 'Não', 'Não sei'] },
      {
        id: 'sintomas', rotulo: 'Coça, dói ou sangra?', tipo: 'varias', ajuda: 'Marque quantas quiser.',
        opcoes: ['Coça', 'Dói', 'Sangra', 'Nenhum dos três'], exclusiva: 'Nenhum dos três',
      },
      { ...NOTA_DOR, soSe: { pergunta: 'sintomas', opcao: 'Dói' } },
    ],
  },
  {
    titulo: 'Fototipo e exposição ao sol',
    colunas: [['cor_pele', 'cor_olhos', 'cor_cabelo'], ['reacao_sol', 'protetor', 'bronzeamento']],
    perguntas: [
      { id: 'cor_pele', rotulo: 'Cor da pele', tipo: 'escolha', lista: true, opcoes: ['Clara', 'Morena clara', 'Morena', 'Negra'] },
      { id: 'cor_olhos', rotulo: 'Cor dos olhos', tipo: 'escolha', lista: true, opcoes: ['Azuis ou verdes', 'Castanho-claros', 'Castanho-escuros ou pretos'] },
      { id: 'cor_cabelo', rotulo: 'Cor natural do cabelo', tipo: 'escolha', lista: true, opcoes: ['Ruivo', 'Loiro', 'Castanho', 'Preto'] },
      {
        id: 'reacao_sol', rotulo: 'No sol, sua pele costuma:', tipo: 'escolha', lista: true,
        // sem "nunca" e sem as que quase se repetem: o prontuário não precisa de tanta precisão (autor, 25/11)
        opcoes: ['Queimar fácil e bronzear pouco', 'Queimar às vezes e bronzear aos poucos', 'Raramente queimar e bronzear fácil'],
      },
      { id: 'protetor', rotulo: 'Usa protetor solar?', tipo: 'escolha', lista: true, opcoes: ['Todo dia', 'Às vezes', 'Raramente'] },
      { id: 'bronzeamento', rotulo: 'Já fez bronzeamento artificial?', tipo: 'escolha', opcoes: SIM_NAO },
    ],
  },
  {
    titulo: 'Rotina de cuidados',
    perguntas: [
      { id: 'produtos', rotulo: 'Produtos que usa no rosto e no corpo', tipo: 'texto-longo', placeholder: 'Ex.: sabonete, hidratante, maquiagem' },
      { id: 'acidos', rotulo: 'Começou a usar algum ácido ou cosmético novo?', tipo: 'texto', placeholder: 'Qual e quando' },
      { id: 'procedimentos', rotulo: 'Procedimentos estéticos já feitos', tipo: 'texto', placeholder: 'Ex.: peeling, laser, botox' },
      { id: 'reacoes', rotulo: 'Já teve reação a algum produto?', tipo: 'texto', placeholder: 'Qual produto e o que aconteceu' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'doencas', rotulo: 'Doenças crônicas', tipo: 'texto', placeholder: 'Ex.: diabetes, pressão alta, tireoide', linhaToda: true },
      { id: 'medicamentos', rotulo: 'Medicamentos em uso, incluindo hormônios e corticoides', tipo: 'texto-longo', placeholder: 'Inclua pomadas e cremes' },
      ALERGIAS,
      // duas perguntas Sim/Não (pedido do autor, 19/11/2026); o médico sabe quando e a quem perguntar
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Histórico familiar',
    perguntas: [
      {
        id: 'familia', rotulo: 'Alguém da família tem ou teve:', tipo: 'varias', ajuda: 'Marque quantas quiser.',
        opcoes: ['Câncer de pele', 'Psoríase', 'Dermatite atópica', 'Vitiligo', 'Queda de cabelo', 'Nenhum desses'], exclusiva: 'Nenhum desses',
      },
    ],
  },
  {
    titulo: 'Fotos e documentos',
    // no PC, as duas fotos lado a lado (com o aviso de trazer no dia, a parte não cabia numa tela)
    colunas: [['foto_perto', 'documentos'], ['foto_longe']],
    nota: `A foto ajuda a acompanhar a evolução, e o exame presencial continua necessário. ${AVISO_TRAZER}`,
    perguntas: [
      { id: 'foto_perto', rotulo: 'Foto de perto', tipo: 'foto', ajuda: 'Com boa luz. Até 10 MB.' },
      { id: 'foto_longe', rotulo: 'Foto de longe', tipo: 'foto', ajuda: 'Mostrando onde fica a lesão no corpo. Até 10 MB.' },
      { id: 'documentos', rotulo: 'Receitas anteriores, exames e laudos', tipo: 'arquivos', ajuda: 'Foto, print ou PDF. Até 10 arquivos de 10 MB.' },
    ],
  },
  ALGO_MAIS,
]


// Pré-consulta de reumatologia trazida pelo autor (24/11/2026), com os ajustes que ele aprovou.
const REUMATOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      { id: 'queixa', rotulo: 'Qual é o principal problema ou sintoma que trouxe você à consulta hoje?', tipo: 'texto-longo' },
      { id: 'desde_quando', rotulo: 'Há quanto tempo esses sintomas começaram?', tipo: 'texto', placeholder: 'Ex.: há 2 semanas, 6 meses, 3 anos', linhaToda: true },
      {
        id: 'inicio', rotulo: 'Como os sintomas começaram?', tipo: 'escolha',
        opcoes: ['De repente, de um dia para o outro', 'Aos poucos, foram piorando com o tempo', 'Após algum evento específico'],
        abreLinha: 'Após algum evento específico', placeholder: 'Qual? Ex.: queda, infecção, estresse, parto',
      },
    ],
  },
  {
    titulo: 'Onde dói',
    // no PC, as regiões à esquerda e as outras duas à direita (cabe numa tela)
    colunas: [['regioes'], ['lados', 'inchaco']],
    compacta: true,
    perguntas: [
      {
        id: 'regioes', rotulo: 'Quais regiões do corpo doem ou incomodam no momento?', tipo: 'varias', ajuda: 'Marque todas que se aplicam.', duasColunas: true,
        opcoes: ['Dedos das mãos', 'Punhos', 'Cotovelos', 'Ombros', 'Pescoço', 'Meio das costas', 'Lombar',
          'Nádegas', 'Quadris', 'Joelhos', 'Tornozelos', 'Dedos dos pés', 'Calcanhar', 'Corpo todo (músculos)', OUTRO],
        abreLinha: OUTRO, placeholder: 'Onde?',
      },
      {
        id: 'lados', rotulo: 'A dor acontece nos dois lados do corpo ou apenas de um lado?', tipo: 'escolha',
        opcoes: ['Dos dois lados (ex.: as duas mãos ou os dois joelhos)', 'Apenas de um lado', 'Muda de lugar (hora dói um lado, hora dói outro)'],
      },
      {
        id: 'inchaco', rotulo: 'Você nota alguma articulação (junta) inchada, quente ou avermelhada?', tipo: 'escolha',
        opcoes: ['Sim, agora mesmo', 'Já ficou inchada no passado, mas hoje não está', 'Não'],
        dica: { opcao: 'Já ficou inchada no passado, mas hoje não está', texto: 'Se tiver foto, envie na parte Exames e fotos e traga no dia.' },
      },
    ],
  },
  {
    titulo: 'Rigidez e dor',
    perguntas: [
      {
        id: 'rigidez', rotulo: 'Ao acordar pela manhã, você sente o corpo ou as juntas “travadas” (rigidez)?', tipo: 'escolha', duasColunas: true,
        opcoes: ['Não sinto rigidez ao acordar', 'Sim, mas destrava rápido (em menos de 30 minutos)', 'Sim, demora entre 30 minutos e 1 hora para destravar', 'Sim, demora mais de 1 hora para destravar'],
      },
      {
        id: 'piora', rotulo: 'O que costuma piorar a sua dor?', tipo: 'varias', ajuda: 'Marque quantas quiser.', duasColunas: true,
        opcoes: ['Repouso (ex.: madrugada)', 'Esforço ou repetição', 'Frio ou mudança de clima', 'Estresse ou sono ruim', 'Carne vermelha ou álcool', 'Não percebi relação', OUTRO],
        exclusiva: 'Não percebi relação', abreLinha: OUTRO, placeholder: 'O quê?',
      },
      NOTA_DOR,
    ],
  },
  {
    titulo: 'Outros sintomas',
    perguntas: [
      {
        id: 'outros_sintomas', rotulo: 'Nos últimos meses, você teve algum destes sintomas?', tipo: 'varias', ajuda: 'Marque todos que se aplicam.', duasColunas: true,
        opcoes: ['Cansaço que não passa com descanso', 'Febre baixa sem motivo', 'Perda de peso sem dieta', 'Manchas no rosto ou que pioram no sol',
          'Queda de cabelo', 'Aftas na boca ou feridas no nariz', 'Dedos pálidos ou roxos no frio', 'Olhos com areia ou boca seca',
          'Descamação na pele, couro cabeludo ou unhas', 'Lombar que dói de madrugada e melhora ao levantar', 'Diarreia ou dor na barriga frequentes', 'Nenhum desses', OUTRO],
        exclusiva: 'Nenhum desses', abreLinha: OUTRO, placeholder: 'Qual?',
      },
    ],
  },
  {
    titulo: 'Saúde geral',
    // no PC, duas colunas lidas linha a linha: Doenças · Remédios de todo dia / Remédios para essa dor · Alergias / Grávida · Amamentando
    colunas: [['doencas', 'remedios_dor', 'gravida'], ['medicamentos', 'alergias', 'amamentando']],
    perguntas: [
      { id: 'doencas', rotulo: 'Doenças já diagnosticadas', tipo: 'texto-longo', placeholder: 'Ex.: pressão alta, diabetes, hipotireoidismo, osteoporose, depressão' },
      { id: 'medicamentos', rotulo: 'Remédios que toma todos os dias', tipo: 'texto-longo', placeholder: 'Nome e dose, se souber' },
      { id: 'remedios_dor', rotulo: 'Remédios que já tomou para essa dor', tipo: 'texto-longo', placeholder: 'Anti-inflamatório, relaxante, corticoide, pomada… e se melhorou' },
      ALERGIAS,
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Histórico familiar',
    perguntas: [
      {
        id: 'familia', rotulo: 'Alguém da família (pais, irmãos, avós, tios) tem ou teve:', tipo: 'varias', ajuda: 'Marque quantas quiser.', duasColunas: true,
        opcoes: ['Artrite reumatoide', 'Lúpus', 'Psoríase', 'Gota', 'Espondilite', 'Fibromialgia', 'Reumatismo', 'Nenhum desses', OUTRO],
        exclusiva: 'Nenhum desses', abreLinha: OUTRO, placeholder: 'Qual?',
      },
    ],
  },
  {
    titulo: 'Exames e fotos',
    nota: AVISO_TRAZER,
    perguntas: [
      { id: 'fotos', rotulo: 'Fotos de juntas inchadas ou manchas na pele', tipo: 'arquivos', soFotos: true, ajuda: 'Mesmo de dias em que estava pior. Até 10 fotos de 10 MB.' },
      { id: 'documentos', rotulo: 'Exames, receitas e laudos', tipo: 'arquivos', ajuda: 'Sangue, raios-X, ultrassom, ressonância, mesmo os antigos. Foto, print ou PDF. Até 10 arquivos de 10 MB.' },
    ],
  },
  ALGO_MAIS,
]

const PACOTES: Partial<Record<string, Parte[]>> = { dermatologia: DERMATOLOGIA, reumatologia: REUMATOLOGIA }

export function partesPreConsulta(especialidade: string): Parte[] {
  return PACOTES[especialidade] ?? GERAIS
}

/** A pergunta aparece para este paciente: sexo certo e, se depende de outra resposta, essa opção marcada
 *  (ou ela mesma já respondida: o que foi dito nunca some). */
export function perguntaVisivel(q: Pergunta, sexo: DadosPessoais['sexo'], respostas: RespostasPreConsulta): boolean {
  if (q.soParaSexo && q.soParaSexo !== sexo) return false
  if (!q.soSe) return true
  const v = respostas[q.soSe.pergunta]
  const marcou = Array.isArray(v) ? v.includes(q.soSe.opcao) : v === q.soSe.opcao
  const r = respostas[q.id]
  return marcou || (Array.isArray(r) ? r.length > 0 : !!r?.trim())
}

/** Marca ou desmarca uma opção de 'varias'; a opção exclusiva não convive com as outras. */
export function alternarOpcao(marcadas: readonly string[], opcao: string, exclusiva?: string): string[] {
  if (marcadas.includes(opcao)) return marcadas.filter((o) => o !== opcao)
  if (opcao === exclusiva) return [opcao]
  return [...marcadas.filter((o) => o !== exclusiva), opcao]
}
