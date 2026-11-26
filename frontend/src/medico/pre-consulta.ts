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
  /** listas muito longas (mais de 16 opções): três colunas no PC, para caber numa tela */
  tresColunas?: boolean
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
  /** só aparece quando outra pergunta tem esta opção (ou uma destas) marcada (ex.: nota da dor só se marcou "Dói") */
  soSe?: { pergunta: string; opcao: string | readonly string[] }
  /** texto curto do lembrete em Perguntas, na consulta (quando o rótulo é longo) */
  lembrete?: string
  /** em branco, não vira lembrete em Perguntas (espaço livre do paciente, não pergunta clínica; autor, 25/11/2026) */
  semLembrete?: boolean
}

/** Chave do texto escrito na linha que a opção `abreLinha` abre. */
export const chaveDaLinha = (id: string) => `${id}_qual`

/** `colunas`: no PC, a parte em duas colunas com estas perguntas (ids) em cada uma, para caber numa tela */
/** `semPular`: só Voltar e Próximo (a parte já é opcional; autor, 24/11) */
/** `compacta`: opções mais baixas, para a parte caber numa tela.
 *  `telasDoMedico`: na anamnese (modo Formulário do médico, caixa menor), a parte em várias telas, cada uma com estas perguntas (ids). */
export type Parte = {
  titulo: string; perguntas: Pergunta[]; nota?: string; colunas?: [string[], string[]]; semPular?: boolean; compacta?: boolean
  telasDoMedico?: string[][]
}

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
  perguntas: [{ id: 'algo_mais', rotulo: 'Algo mais que seu médico deva saber?', tipo: 'texto-longo', semRotulo: true, semLembrete: true, placeholder: 'Escreva com suas palavras.' }],
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
    // na tela do médico não cabe numa caixa só (autor, 24/11/2026)
    telasDoMedico: [['regioes'], ['lados', 'inchaco']],
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
    telasDoMedico: [['rigidez', 'piora'], ['nota_dor']],
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

/** Hábitos (tabagismo, álcool, atividade física): iguais na Cardiologia e na Gastroenterologia. */
const TABAGISMO: Pergunta = { id: 'tabagismo', rotulo: 'Tabagismo', tipo: 'escolha', lista: true, opcoes: ['Nunca fumou', 'Ex-fumante', 'Fuma atualmente'] }
const ALCOOL: Pergunta = { id: 'alcool', rotulo: 'Álcool', tipo: 'escolha', lista: true, opcoes: ['Não consome', 'Ocasionalmente', 'Semanalmente', 'Diariamente'] }
const ATIVIDADE: Pergunta = { id: 'atividade', rotulo: 'Atividade física', tipo: 'escolha', lista: true, opcoes: ['Nenhuma', 'Leve', 'Moderada', 'Intensa'] }
const PARENTESCO: Pergunta = { id: 'familia_quem', rotulo: 'Parentesco e idade aproximada ao diagnóstico', tipo: 'texto', placeholder: 'Ex.: pai, aos 50 anos', linhaToda: true }
const PRIORIDADES: Parte = {
  titulo: 'O que espera da consulta',
  perguntas: [{ id: 'prioridades', rotulo: 'O que gostaria de esclarecer ou resolver na consulta?', tipo: 'texto-longo', semRotulo: true, semLembrete: true, placeholder: 'Escreva com suas palavras.' }],
}
const DOCUMENTOS: Pergunta = { id: 'documentos', rotulo: 'Envie os exames, laudos e receitas', tipo: 'arquivos', ajuda: 'Mesmo os antigos. Foto, print ou PDF. Até 10 arquivos de 10 MB.' }

// Pré-consulta de cardiologia trazida pelo autor (26/11/2026), no esqueleto da Reumatologia
// (docs/especialidades/cardiologia-pre-consulta.md).
const SINTOMAS_CARDIO = ['Dor, pressão ou aperto no peito', 'Falta de ar ao esforço', 'Falta de ar em repouso', 'Falta de ar ao deitar',
  'Acordar à noite com falta de ar', 'Palpitações ou batimentos acelerados', 'Batimentos irregulares', 'Tontura',
  'Desmaio ou sensação de desmaio', 'Cansaço ou menos fôlego nos esforços', 'Inchaço nos pés ou pernas', 'Tosse noturna',
  'Dor ou cansaço nas pernas ao caminhar', 'Nenhum desses sintomas', OUTRO]
const CARDIOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', ajuda: 'Marque todos que se aplicam.', duasColunas: true,
        opcoes: ['Dor ou desconforto no peito', 'Falta de ar', 'Palpitações', 'Tontura ou desmaio', 'Inchaço nas pernas', 'Pressão alta',
          'Colesterol ou triglicerídeos alterados', 'Check-up / prevenção', 'Acompanhamento de doença do coração', 'Avaliação de exames', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Descreva, com suas palavras, o principal problema', tipo: 'texto-longo' },
    ],
  },
  {
    titulo: 'Sintomas',
    perguntas: [
      {
        id: 'sintomas', rotulo: 'Marque os sintomas que tem ou teve recentemente', tipo: 'varias', ajuda: 'Marque todos que se aplicam.', duasColunas: true,
        opcoes: SINTOMAS_CARDIO, exclusiva: 'Nenhum desses sintomas', abreLinha: OUTRO, placeholder: 'Qual?',
      },
    ],
  },
  {
    titulo: 'Como são os sintomas',
    colunas: [['desde_quando', 'frequencia', 'duracao'], ['piora', 'alivia']],
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando os sintomas começaram?', tipo: 'texto', placeholder: 'Ex.: há 2 semanas, 6 meses' },
      { id: 'frequencia', rotulo: 'Com que frequência ocorrem?', tipo: 'escolha', opcoes: ['Todos os dias', 'Algumas vezes por semana', 'Algumas vezes por mês', 'Raramente'] },
      { id: 'duracao', rotulo: 'Quanto tempo duram?', tipo: 'texto', placeholder: 'Ex.: segundos, minutos, horas' },
      { id: 'piora', rotulo: 'O que desencadeia ou piora?', tipo: 'texto', placeholder: 'Ex.: esforço, subir escada, deitar, estresse' },
      { id: 'alivia', rotulo: 'O que alivia?', tipo: 'texto', placeholder: 'Ex.: repouso, sentar, remédio' },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: { pergunta: 'sintomas', opcao: ['Dor, pressão ou aperto no peito', 'Dor ou cansaço nas pernas ao caminhar'] } },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    colunas: [['doencas'], ['outras_doencas', 'procedimentos', 'procedimentos_quando']],
    compacta: true,
    telasDoMedico: [['doencas'], ['outras_doencas', 'procedimentos', 'procedimentos_quando']],
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve diagnóstico de:', tipo: 'varias', ajuda: 'Marque todos que se aplicam.', duasColunas: true,
        opcoes: ['Pressão alta', 'Colesterol elevado', 'Diabetes', 'Arritmia', 'Insuficiência cardíaca', 'Infarto', 'Angina', 'AVC ou AIT',
          'Doença valvar', 'Doença arterial periférica', 'Doença renal', 'Apneia do sono', 'Febre reumática', 'Nenhuma dessas', OUTRO],
        exclusiva: 'Nenhuma dessas', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'outras_doencas', rotulo: 'Outras doenças, cirurgias ou internações importantes', tipo: 'texto-longo' },
      {
        id: 'procedimentos', rotulo: 'Já fez algum procedimento no coração?', tipo: 'varias',
        opcoes: ['Não', 'Cateterismo', 'Angioplastia / stent', 'Cirurgia cardíaca', 'Marca-passo / cardiodesfibrilador', 'Ablação', OUTRO],
        exclusiva: 'Não', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'procedimentos_quando', rotulo: 'Quando e qual foi o motivo?', tipo: 'texto', soSe: { pergunta: 'procedimentos', opcao: ['Cateterismo', 'Angioplastia / stent', 'Cirurgia cardíaca', 'Marca-passo / cardiodesfibrilador', 'Ablação', OUTRO] } },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios em uso — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: losartana 50 mg, 1 vez ao dia' },
      {
        id: 'remedios_tipo', rotulo: 'Usa algum destes?', tipo: 'varias', duasColunas: true,
        opcoes: ['Anticoagulante', 'Antiagregante plaquetário', 'Remédio para pressão', 'Não uso remédio todo dia'], exclusiva: 'Não uso remédio todo dia',
      },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Histórico familiar',
    perguntas: [
      {
        id: 'familia', rotulo: 'Algum familiar próximo teve:', tipo: 'varias', ajuda: 'Marque quantas quiser.', duasColunas: true,
        opcoes: ['Infarto ou doença coronariana precoce', 'Morte súbita', 'Arritmia ou cardiomiopatia', 'AVC', 'Pressão alta',
          'Colesterol elevado', 'Diabetes', 'Não sei / nenhum', OUTRO],
        exclusiva: 'Não sei / nenhum', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      PARENTESCO,
    ],
  },
  {
    titulo: 'Hábitos',
    colunas: [['tabagismo', 'tabagismo_quanto', 'alcool', 'alimentacao'], ['atividade', 'atividade_freq', 'peso', 'altura']],
    perguntas: [
      TABAGISMO,
      { id: 'tabagismo_quanto', rotulo: 'Quanto e por quanto tempo?', tipo: 'texto', placeholder: 'Ex.: 1 maço por dia, 20 anos', soSe: { pergunta: 'tabagismo', opcao: ['Ex-fumante', 'Fuma atualmente'] } },
      ALCOOL,
      { id: 'alimentacao', rotulo: 'Alimentação ou restrições relevantes', tipo: 'texto', placeholder: 'Ex.: muito sal, vegetariano' },
      ATIVIDADE,
      { id: 'atividade_freq', rotulo: 'Com que frequência?', tipo: 'texto', placeholder: 'Ex.: 3 vezes por semana', soSe: { pergunta: 'atividade', opcao: ['Leve', 'Moderada', 'Intensa'] } },
      { id: 'peso', rotulo: 'Peso (kg)', tipo: 'texto', semResposta: 'Não sei', placeholder: 'Ex.: 78' },
      { id: 'altura', rotulo: 'Altura (cm)', tipo: 'texto', semResposta: 'Não sei', placeholder: 'Ex.: 170' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias', ajuda: 'Marque todos que se aplicam.',
        opcoes: ['Eletrocardiograma', 'Ecocardiograma', 'Teste ergométrico', 'Holter / monitor de ritmo', 'MAPA / MRPA', 'Cateterismo / angiografia',
          'Exames de sangue', 'Relatórios de internações ou procedimentos', 'Lista ou embalagens dos remédios', 'Não tenho exames recentes', OUTRO],
        exclusiva: 'Não tenho exames recentes', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  PRIORIDADES,
  ALGO_MAIS,
]

// Pré-consulta de gastroenterologia trazida pelo autor (26/11/2026), no mesmo esqueleto
// (docs/especialidades/gastroenterologia-pre-consulta.md).
const GASTROENTEROLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['motivo'], ['queixa']],
    perguntas: [
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', ajuda: 'Marque todos que se aplicam.', tresColunas: true,
        opcoes: ['Dor ou incômodo na barriga', 'Azia / queimação', 'Refluxo', 'Dificuldade para engolir', 'Náuseas', 'Vômitos',
          'Barriga estufada', 'Gases', 'Diarreia', 'Intestino preso', 'Mudança no intestino', 'Sangue nas fezes', 'Fezes escuras',
          'Hemorroidas / dor anal', 'Pele ou olhos amarelados', 'Exames do fígado alterados', 'Avaliação de exames',
          'Acompanhar doença digestiva', 'Check-up / prevenção', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Descreva o principal problema', tipo: 'texto-longo' },
    ],
  },
  {
    titulo: 'Sintomas que tem ou teve recentemente',
    compacta: true,
    perguntas: [
      {
        id: 'sintomas', rotulo: 'Sintomas que tem ou teve recentemente', tipo: 'varias', semRotulo: true, tresColunas: true,
        opcoes: ['Dor na barriga', 'Queimação', 'Volta de comida ou azedo', 'Sensação de comida parada', 'Náuseas', 'Vômitos',
          'Fica cheio rápido', 'Perda de apetite', 'Barriga estufada', 'Excesso de gases', 'Diarreia', 'Intestino preso',
          'Urgência para evacuar', 'Muco nas fezes', 'Sangue vivo nas fezes', 'Fezes muito escuras', 'Fezes claras',
          'Dor ao evacuar', 'Coceira no ânus', 'Pele ou olhos amarelados', 'Urina escura', 'Perda de peso sem dieta',
          'Nenhum desses sintomas', OUTRO],
        exclusiva: 'Nenhum desses sintomas', abreLinha: OUTRO, placeholder: 'Qual?',
      },
    ],
  },
  {
    titulo: 'Como são os sintomas',
    colunas: [['desde_quando', 'frequencia', 'duracao'], ['piora', 'alivia']],
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começaram?', tipo: 'texto', placeholder: 'Ex.: há 2 semanas, 6 meses' },
      { id: 'frequencia', rotulo: 'Com que frequência?', tipo: 'escolha', opcoes: ['Todo dia', 'Toda semana', 'Todo mês', 'De vez em quando', 'Outra'], abreLinha: 'Outra', placeholder: 'Qual?' },
      { id: 'duracao', rotulo: 'Quanto tempo duram ou como evoluíram?', tipo: 'texto', placeholder: 'Ex.: piorando, vai e volta' },
      { id: 'piora', rotulo: 'O que desencadeia ou piora?', tipo: 'texto', placeholder: 'Ex.: comida gordurosa, café, estresse' },
      { id: 'alivia', rotulo: 'O que alivia?', tipo: 'texto', placeholder: 'Ex.: evacuar, antiácido, jejum' },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: { pergunta: 'sintomas', opcao: ['Dor na barriga', 'Queimação', 'Dor ao evacuar'] } },
    ],
  },
  {
    // "Se houver dor abdominal" e "Se houver alteração intestinal" do modelo: as perguntas só aparecem para quem marcou
    titulo: 'Dor e intestino',
    colunas: [['dor_local', 'dor_relacao'], ['evacuacoes', 'consistencia', 'mudanca']],
    perguntas: [
      {
        id: 'dor_local', rotulo: 'Se tem dor na barriga, onde dói?', tipo: 'varias',
        opcoes: ['Boca do estômago', 'Em cima, à direita', 'Em cima, à esquerda', 'Em volta do umbigo', 'Embaixo, à direita', 'Embaixo, à esquerda', 'Barriga toda', OUTRO],
        abreLinha: OUTRO, placeholder: 'Onde?',
      },
      {
        id: 'dor_relacao', rotulo: 'A dor tem relação com:', tipo: 'varias',
        opcoes: ['Alimentação', 'Evacuação', 'Menstruação', 'Esforço', 'Não percebi relação', OUTRO],
        exclusiva: 'Não percebi relação', abreLinha: OUTRO, placeholder: 'O quê?',
      },
      { id: 'evacuacoes', rotulo: 'Se o intestino mudou: quantas vezes costuma evacuar?', tipo: 'texto', placeholder: 'Ex.: 1 vez ao dia, 2 vezes por semana' },
      { id: 'consistencia', rotulo: 'Como costumam ser as fezes?', tipo: 'escolha', opcoes: ['Formadas', 'Amolecidas', 'Líquidas', 'Ressecadas'] },
      { id: 'mudanca', rotulo: 'Mudou recentemente?', tipo: 'escolha', opcoes: ['Não', 'Sim'], abreLinha: 'Sim', placeholder: 'Como?' },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    compacta: true,
    telasDoMedico: [['doencas'], ['cirurgias', 'outras_doencas']],
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve diagnóstico de:', tipo: 'varias', tresColunas: true,
        opcoes: ['Refluxo / esofagite', 'Gastrite', 'Úlcera', 'H. pylori', 'Doença celíaca', 'Intolerância alimentar',
          'Intestino irritável', 'Doença inflamatória intestinal', 'Divertículos / diverticulite', 'Hemorroidas', 'Gordura no fígado',
          'Hepatite', 'Cirrose', 'Pedra na vesícula', 'Pancreatite', 'Pólipos no intestino', 'Câncer digestivo', 'Nenhuma dessas', OUTRO],
        exclusiva: 'Nenhuma dessas', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'cirurgias', rotulo: 'Cirurgias ou internações digestivas anteriores', tipo: 'escolha', opcoes: ['Não', 'Sim'], abreLinha: 'Sim', placeholder: 'Quais e quando?' },
      { id: 'outras_doencas', rotulo: 'Outras doenças ou condições relevantes', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Saúde geral',
    compacta: true,
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios em uso — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: omeprazol 20 mg, 1 vez ao dia' },
      {
        id: 'remedios_tipo', rotulo: 'Usa ou usou há pouco algum destes?', tipo: 'varias',
        opcoes: ['Antiácido / protetor do estômago', 'Laxante', 'Remédio para diarreia', 'Anti-inflamatório', 'Anticoagulante', 'Antibiótico recente', 'Suplementos / produtos naturais'],
        abreLinha: 'Suplementos / produtos naturais', placeholder: 'Quais?',
      },
      { ...ALERGIAS, rotulo: 'Alergias ou intolerâncias a remédios ou alimentos', placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Alimentação e hábitos',
    colunas: [['alimentos_pioram', 'restricoes'], ['tabagismo', 'alcool', 'atividade']],
    perguntas: [
      { id: 'alimentos_pioram', rotulo: 'Alimentos ou bebidas que pioram os sintomas', tipo: 'texto', placeholder: 'Ex.: leite, fritura, café' },
      {
        id: 'restricoes', rotulo: 'Restrições alimentares', tipo: 'varias',
        opcoes: ['Nenhuma', 'Lactose', 'Glúten', OUTRO], exclusiva: 'Nenhuma', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      TABAGISMO,
      ALCOOL,
      ATIVIDADE,
    ],
  },
  {
    titulo: 'Histórico familiar',
    perguntas: [
      {
        id: 'familia', rotulo: 'Na família, alguém teve:', tipo: 'varias', ajuda: 'Marque quantas quiser.', duasColunas: true,
        opcoes: ['Câncer de intestino', 'Câncer de estômago', 'Câncer de esôfago', 'Câncer de fígado ou pâncreas',
          'Doença inflamatória intestinal', 'Doença celíaca', 'Doença do fígado', 'Pólipos no intestino', 'Não sei / nenhum', OUTRO],
        exclusiva: 'Não sei / nenhum', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      PARENTESCO,
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    compacta: true,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames ou procedimentos já fez?', tipo: 'varias',
        opcoes: ['Endoscopia', 'Colonoscopia', 'Ultrassom da barriga', 'Tomografia', 'Ressonância', 'Exames de sangue',
          'Exames de fezes', 'Biópsia', 'Não tenho exames anteriores', OUTRO],
        exclusiva: 'Não tenho exames anteriores', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'exames_resultado', rotulo: 'Data e resultado, se souber', tipo: 'texto', placeholder: 'Ex.: endoscopia em 2024, gastrite leve' },
      DOCUMENTOS,
    ],
  },
  PRIORIDADES,
  ALGO_MAIS,
]

/** Quem preenche (Neurologia, Endocrinologia: o modelo do autor pede; 26/11/2026). */
const PREENCHIDO_POR: Pergunta = {
  id: 'preenchido_por', rotulo: 'Quem está preenchendo?', tipo: 'escolha', opcoes: ['Paciente', 'Acompanhante'],
  abreLinha: 'Acompanhante', placeholder: 'Nome e vínculo (ex.: Maria, filha)',
}
const CURSO: Pergunta = { id: 'curso', rotulo: 'Desde então:', tipo: 'escolha', opcoes: ['Melhorou', 'Igual', 'Piorou', 'Oscila'] }

// Pré-consulta de neurologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/neurologia-modelo.md).
// "Perguntas conforme a queixa": cada queixa é uma parte que só aparece para quem a marcou no motivo.
const se = (...opcoes: string[]) => ({ pergunta: 'motivo', opcao: opcoes })
const NEUROLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor de cabeça', 'Tontura ou sensação de giro', 'Desequilíbrio ou quedas', 'Fraqueza', 'Dormência ou formigamento',
          'Tremor ou movimentos involuntários', 'Convulsão ou ficar desligado', 'Desmaio ou perda de consciência',
          'Memória ou atenção', 'Alteração da fala ou da visão', 'Dor em queimação ou choque', 'Dificuldade para andar',
          'Problemas de sono', 'Acompanhar doença neurológica', 'Avaliação de exames', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      // no PC fica ao lado de "Quem está preenchendo?" (cabe numa tela)
      { id: 'queixa', rotulo: 'Qual é a sua principal preocupação?', tipo: 'texto' },
    ],
  },
  {
    // o "sintoma principal" do modelo em duas telas (cabe em 690 px): como começou · onde e o que piora
    titulo: 'Como começou',
    colunas: [['desde_quando', 'ultimo', 'duracao'], ['inicio', 'evolucao', 'curso']],
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou?', tipo: 'texto', placeholder: 'Ex.: há 3 meses' },
      { id: 'ultimo', rotulo: 'Último episódio', tipo: 'texto', placeholder: 'Ex.: ontem à noite' },
      { id: 'duracao', rotulo: 'Quanto tempo dura?', tipo: 'texto', placeholder: 'Ex.: minutos, horas, o dia todo' },
      { id: 'inicio', rotulo: 'Como começou?', tipo: 'escolha', opcoes: ['De repente', 'Aos poucos', 'Não sei'] },
      { id: 'evolucao', rotulo: 'Como acontece?', tipo: 'escolha', opcoes: ['Só uma vez', 'Vai e volta', 'Contínuo'] },
      { ...CURSO, rotulo: 'Desde o início:', opcoes: ['Melhorou', 'Igual', 'Piorou', 'Oscila'] },
    ],
  },
  {
    titulo: 'Onde sente e o que piora',
    colunas: [['onde', 'gatilhos'], ['lado', 'impacto']],
    perguntas: [
      { id: 'onde', rotulo: 'Onde sente?', tipo: 'texto', placeholder: 'Ex.: cabeça, mão, perna' },
      { id: 'lado', rotulo: 'Lado', tipo: 'escolha', opcoes: ['Direito', 'Esquerdo', 'Os dois'] },
      { id: 'gatilhos', rotulo: 'O que desencadeia, piora ou alivia?', tipo: 'texto', placeholder: 'Ex.: estresse, levantar rápido, repouso' },
      {
        id: 'impacto', rotulo: 'Atrapalha em:', tipo: 'varias',
        opcoes: ['Trabalho ou estudo', 'Sono', 'Caminhada', 'Cuidar de si', OUTRO], abreLinha: OUTRO, placeholder: 'O quê?',
      },
    ],
  },
  {
    // "Dor de cabeça" do modelo + a nota da dor (regra 5.8), que também vale para a dor em queimação ou choque
    titulo: 'Dor',
    perguntas: [
      { ...NOTA_DOR, linhaToda: true, soSe: se('Dor de cabeça', 'Dor em queimação ou choque') },
      { id: 'dias_dor', rotulo: 'Quantos dias teve dor no último mês?', tipo: 'texto', placeholder: 'Ex.: 8', soSe: se('Dor de cabeça') },
      { id: 'dias_remedio', rotulo: 'Em quantos dias tomou remédio para dor?', tipo: 'texto', placeholder: 'Ex.: 6', soSe: se('Dor de cabeça') },
      { id: 'cefaleia_junto', rotulo: 'Junto com a dor:', tipo: 'varias', opcoes: ['Náusea', 'Incômodo com luz ou som', 'Alteração na visão'], soSe: se('Dor de cabeça') },
      { id: 'cefaleia_local', rotulo: 'Onde dói e quanto tempo dura?', tipo: 'texto', placeholder: 'Ex.: lado direito, umas 4 horas', linhaToda: true, soSe: se('Dor de cabeça') },
    ],
  },
  {
    titulo: 'Tontura ou desequilíbrio',
    perguntas: [
      { id: 'tontura_tipo', rotulo: 'Como é?', tipo: 'varias', opcoes: ['Tudo gira', 'Sensação de desmaio', 'Instabilidade ao andar'], soSe: se('Tontura ou sensação de giro', 'Desequilíbrio ou quedas') },
      {
        id: 'tontura_gatilho', rotulo: 'Quando aparece?', tipo: 'varias', opcoes: ['Ao levantar', 'Ao virar a cabeça', 'Sem motivo que eu perceba'],
        exclusiva: 'Sem motivo que eu perceba', soSe: se('Tontura ou sensação de giro', 'Desequilíbrio ou quedas'),
      },
      { id: 'tontura_ouvido', rotulo: 'No ouvido:', tipo: 'varias', opcoes: ['Zumbido', 'Perda de audição'], soSe: se('Tontura ou sensação de giro', 'Desequilíbrio ou quedas') },
      { id: 'tontura_duracao', rotulo: 'Quanto tempo dura?', tipo: 'texto', placeholder: 'Ex.: segundos, horas', soSe: se('Tontura ou sensação de giro', 'Desequilíbrio ou quedas') },
    ],
  },
  {
    titulo: 'Crise, desmaio ou desligamento',
    perguntas: [
      {
        id: 'crise_sinais', rotulo: 'O que aconteceu?', tipo: 'varias', duasColunas: true,
        opcoes: ['Perdeu a consciência', 'Olhar parado', 'Movimentos involuntários', 'Mordeu a língua', 'Ficou confuso depois'],
        soSe: se('Convulsão ou ficar desligado', 'Desmaio ou perda de consciência'),
      },
      { id: 'crise_relato', rotulo: 'O que aconteceu antes, durante e depois?', tipo: 'texto-longo', soSe: se('Convulsão ou ficar desligado', 'Desmaio ou perda de consciência') },
      { id: 'testemunha', rotulo: 'O que contou quem viu?', tipo: 'texto-longo', soSe: se('Convulsão ou ficar desligado', 'Desmaio ou perda de consciência') },
    ],
  },
  {
    titulo: 'Fraqueza ou formigamento',
    perguntas: [
      { id: 'fraqueza_local', rotulo: 'Onde e de que lado?', tipo: 'texto', placeholder: 'Ex.: mão e braço esquerdos', soSe: se('Fraqueza', 'Dormência ou formigamento', 'Dificuldade para andar') },
      {
        id: 'fraqueza_dificuldade', rotulo: 'Tem dificuldade para:', tipo: 'varias', opcoes: ['Segurar objetos', 'Subir escadas', 'Levantar da cadeira', 'Caminhar'],
        soSe: se('Fraqueza', 'Dormência ou formigamento', 'Dificuldade para andar'),
      },
      { id: 'fraqueza_piora', rotulo: 'Está se espalhando ou piorando?', tipo: 'texto', placeholder: 'Ex.: começou na mão, agora no braço', linhaToda: true, soSe: se('Fraqueza', 'Dormência ou formigamento', 'Dificuldade para andar') },
    ],
  },
  {
    titulo: 'Memória ou comportamento',
    perguntas: [
      {
        id: 'memoria', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Esquece compromissos', 'Repete perguntas', 'Perde-se em lugares conhecidos', 'Dificuldade com remédios ou contas', 'Mudou o comportamento'],
        soSe: se('Memória ou atenção'),
      },
      { id: 'memoria_quem', rotulo: 'Quando começou e quem percebeu?', tipo: 'texto', placeholder: 'Ex.: há 1 ano, a filha', linhaToda: true, soSe: se('Memória ou atenção') },
    ],
  },
  {
    titulo: 'Tremor ou movimentos',
    perguntas: [
      { id: 'tremor_quando', rotulo: 'O tremor aparece:', tipo: 'varias', opcoes: ['Em repouso', 'Ao manter uma posição', 'Ao usar as mãos'], soSe: se('Tremor ou movimentos involuntários') },
      { id: 'tremor_local', rotulo: 'Parte do corpo e lado', tipo: 'texto', placeholder: 'Ex.: mão direita', soSe: se('Tremor ou movimentos involuntários') },
      { id: 'tremor_atividade', rotulo: 'O que mais atrapalha?', tipo: 'texto', placeholder: 'Ex.: escrever, comer', soSe: se('Tremor ou movimentos involuntários') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve diagnóstico de:', tipo: 'varias', duasColunas: true,
        opcoes: ['AVC ou AIT', 'Epilepsia', 'Enxaqueca', 'Parkinson', 'Neuropatia', 'Demência', 'Pancada forte na cabeça', 'Pressão alta', 'Diabetes', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'cirurgias', rotulo: 'Cirurgias, internações ou acidentes', tipo: 'texto' },
      { id: 'familia', rotulo: 'Doenças na família (qual, parentesco e idade de início)', tipo: 'texto', placeholder: 'Ex.: mãe, Parkinson aos 70' },
      { id: 'habitos', rotulo: 'Sono, álcool, cigarro ou outras substâncias', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: dorme 5 horas, cerveja nos fins de semana' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: topiramato 50 mg, 2 vezes ao dia' },
      { id: 'mudancas', rotulo: 'Mudou algum remédio há pouco tempo?', tipo: 'texto', linhaToda: true, placeholder: 'Qual e quando' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Tomografia', 'Ressonância', 'Eletroencefalograma', 'Eletroneuromiografia', 'Exames de sangue', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'exames_resultado', rotulo: 'Data e resultado, se souber', tipo: 'texto', placeholder: 'Ex.: ressonância em 2025, normal' },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de endocrinologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/endocrinologia-modelo.md).
const ENDOCRINOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Diabetes ou pré-diabetes', 'Glicose baixa ou alta', 'Alteração da tireoide', 'Nódulo ou aumento no pescoço',
          'Ganho ou perda de peso', 'Colesterol ou triglicerídeos altos', 'Osteoporose ou fratura', 'Menstruação irregular',
          'Libido ou função sexual', 'Avaliação de exames hormonais', 'Acompanhar doença hormonal', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'O que gostaria de esclarecer ou resolver?', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Os sintomas',
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou?', tipo: 'texto', placeholder: 'Ex.: há 6 meses' },
      CURSO,
      { id: 'sintomas_rotina', rotulo: 'Descreva os sintomas e como afetam sua rotina', tipo: 'texto-longo' },
    ],
  },
  {
    titulo: 'Diabetes ou glicose',
    perguntas: [
      { id: 'dm_tipo', rotulo: 'Tipo e ano do diagnóstico, se souber', tipo: 'texto', placeholder: 'Ex.: tipo 2, em 2018', soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta') },
      { id: 'insulina', rotulo: 'Usa insulina?', tipo: 'escolha', opcoes: SIM_NAO, soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta') },
      { id: 'dm_medida', rotulo: 'Como mede a glicose?', tipo: 'varias', opcoes: ['Ponta do dedo', 'Sensor'], soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta') },
      { id: 'dm_sintomas', rotulo: 'Tem tido:', tipo: 'varias', opcoes: ['Muita sede', 'Urina muito', 'Glicose baixa'], soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta') },
      {
        id: 'dm_ajuda', rotulo: 'Alguma glicose baixa precisou de ajuda de outra pessoa?', tipo: 'escolha', opcoes: SIM_NAO, abreLinha: 'Sim', placeholder: 'Quando?',
        soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta'),
      },
      { id: 'hba1c', rotulo: 'Última hemoglobina glicada (HbA1c), se souber', tipo: 'texto', placeholder: 'Ex.: 7,8% em outubro', soSe: se('Diabetes ou pré-diabetes', 'Glicose baixa ou alta') },
    ],
  },
  {
    titulo: 'Tireoide',
    perguntas: [
      {
        id: 'tireoide', rotulo: 'Tem sentido:', tipo: 'varias', duasColunas: true,
        opcoes: ['Palpitações', 'Tremor', 'Muito calor ou suor', 'Muito frio', 'Intestino preso', 'Queda de cabelo', 'Caroço no pescoço', 'Rouquidão', 'Dificuldade para engolir'],
        soSe: se('Alteração da tireoide', 'Nódulo ou aumento no pescoço'),
      },
      { id: 'tireoide_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 3 meses', soSe: se('Alteração da tireoide', 'Nódulo ou aumento no pescoço') },
    ],
  },
  {
    titulo: 'Peso',
    perguntas: [
      { id: 'peso', rotulo: 'Peso atual (kg)', tipo: 'texto', placeholder: 'Ex.: 92', soSe: se('Ganho ou perda de peso') },
      { id: 'peso_habitual', rotulo: 'Peso de costume (kg)', tipo: 'texto', placeholder: 'Ex.: 80', soSe: se('Ganho ou perda de peso') },
      { id: 'peso_mudanca', rotulo: 'Quanto mudou e em quanto tempo?', tipo: 'texto', placeholder: 'Ex.: 12 kg em 8 meses', soSe: se('Ganho ou perda de peso') },
      { id: 'peso_intencional', rotulo: 'Foi de propósito?', tipo: 'escolha', opcoes: SIM_NAO, soSe: se('Ganho ou perda de peso') },
      { id: 'peso_tentativas', rotulo: 'O que já tentou e como foi?', tipo: 'texto-longo', placeholder: 'Ex.: dieta, remédio, academia', soSe: se('Ganho ou perda de peso') },
    ],
  },
  {
    titulo: 'Ossos ou fraturas',
    perguntas: [
      {
        id: 'ossos', rotulo: 'Marque o que aconteceu:', tipo: 'varias',
        opcoes: ['Fratura em queda da própria altura ou esforço leve', 'Perdeu altura', 'Quedas recentes'], soSe: se('Osteoporose ou fratura'),
      },
      { id: 'fratura_local', rotulo: 'Local e data da fratura', tipo: 'texto', placeholder: 'Ex.: punho, em 2024', soSe: se('Osteoporose ou fratura') },
      { id: 'densitometria', rotulo: 'Já fez densitometria?', tipo: 'escolha', opcoes: SIM_NAO, abreLinha: 'Sim', placeholder: 'Quando e resultado', soSe: se('Osteoporose ou fratura') },
    ],
  },
  {
    titulo: 'Menstruação, fertilidade ou função sexual',
    perguntas: [
      {
        id: 'reproducao', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Ciclos irregulares', 'Sem menstruação', 'Secreção pelas mamas', 'Aumento de pelos', 'Acne', 'Dificuldade para engravidar', 'Menos libido', 'Dificuldade de ereção'],
        soSe: se('Menstruação irregular', 'Libido ou função sexual'),
      },
      { id: 'menstruacao', rotulo: 'Última menstruação ou idade da menopausa', tipo: 'texto', placeholder: 'Ex.: 10/11, ou menopausa aos 50', soSe: se('Menstruação irregular', 'Libido ou função sexual') },
    ],
  },
  {
    // sem opção no motivo (o modelo não tem): aparece para todos, opcional (corticoide importa para qualquer um)
    titulo: 'Hipófise ou suprarrenais',
    perguntas: [
      {
        id: 'hipofise', rotulo: 'Marque se tiver algum destes:', tipo: 'varias', duasColunas: true,
        opcoes: ['Diagnóstico hormonal conhecido', 'Cirurgia ou radioterapia na hipófise', 'Usa ou usou corticoide há pouco', 'Dor de cabeça', 'Alteração na visão', 'Nenhum desses'],
        exclusiva: 'Nenhum desses',
      },
      { id: 'hipofise_detalhes', rotulo: 'Detalhes', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: prednisona 20 mg até setembro', soSe: { pergunta: 'hipofise', opcao: ['Diagnóstico hormonal conhecido', 'Cirurgia ou radioterapia na hipófise', 'Usa ou usou corticoide há pouco', 'Dor de cabeça', 'Alteração na visão'] } },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve diagnóstico de:', tipo: 'varias', tresColunas: true,
        opcoes: ['Pressão alta', 'Doença do coração', 'Doença nos rins', 'Gordura no fígado', 'Apneia do sono', 'Cirurgia bariátrica', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      {
        id: 'familia', rotulo: 'Na família, alguém teve:', tipo: 'varias', tresColunas: true,
        opcoes: ['Diabetes', 'Doença da tireoide', 'Fratura de quadril', 'Doença do coração cedo', 'Tumor de glândula', 'Não sei', OUTRO],
        exclusiva: 'Não sei', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { ...PARENTESCO, linhaToda: false },
      { id: 'habitos', rotulo: 'Sono, alimentação, atividade física, álcool e cigarro', tipo: 'texto', placeholder: 'Ex.: dorme mal, caminha 2 vezes por semana, não fuma' },
    ],
  },
  {
    titulo: 'Saúde geral',
    colunas: [['medicamentos', 'remedios_tipo', 'mudancas'], ['alergias', 'gravida', 'amamentando', 'engravidar']],
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos', tipo: 'texto-longo', placeholder: 'Nome, dose e frequência' },
      {
        id: 'remedios_tipo', rotulo: 'Usa algum destes?', tipo: 'varias', duasColunas: true,
        opcoes: ['Insulina', 'Levotiroxina', 'Remédio p/ tireoide acelerada', 'Corticoide', 'Hormônios ou anabolizantes', 'Biotina', 'Remédio para emagrecer'],
      },
      { id: 'mudancas', rotulo: 'Mudou remédio ou esqueceu doses?', tipo: 'texto', placeholder: 'Qual e quando' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'engravidar', rotulo: 'Teve bebê há pouco ou quer engravidar?', tipo: 'texto', soParaSexo: 'F', placeholder: 'Ex.: parto em agosto' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Exames de sangue', 'Registros de glicose ou sensor', 'Ultrassom', 'Densitometria', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'exames_resultado', rotulo: 'Data e resultados importantes', tipo: 'texto', placeholder: 'Ex.: TSH 8,2 em outubro' },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de hematologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/hematologia-modelo.md).
const HEMATOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Hemograma alterado', 'Anemia ou ferro baixo', 'Plaquetas alteradas', 'Glóbulos brancos alterados', 'Cansaço ou palidez',
          'Manchas roxas ou sangramento', 'Ínguas ou caroços', 'Trombose', 'Acompanhar doença do sangue', 'Avaliação de exames', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é a sua principal preocupação?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Como começou',
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou, ou quando saiu o primeiro exame alterado?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: exame de março de 2025' },
      { ...CURSO, rotulo: 'Desde então:', opcoes: ['Melhorou', 'Igual', 'Piorou', 'Vai e volta'] },
    ],
  },
  {
    titulo: 'Anemia ou cansaço',
    perguntas: [
      { id: 'anemia_sintomas', rotulo: 'Tem sentido:', tipo: 'varias', opcoes: ['Falta de ar no esforço', 'Tontura', 'Palpitações'], soSe: se('Anemia ou ferro baixo', 'Cansaço ou palidez') },
      { id: 'anemia_tratamento', rotulo: 'Já usou ferro, vitaminas ou recebeu transfusão?', tipo: 'texto', linhaToda: true, placeholder: 'Qual, quando e se melhorou', soSe: se('Anemia ou ferro baixo', 'Cansaço ou palidez') },
    ],
  },
  {
    titulo: 'Sangramento ou manchas roxas',
    perguntas: [
      {
        id: 'sangramento_onde', rotulo: 'Onde sangra?', tipo: 'varias', duasColunas: true,
        opcoes: ['Nariz', 'Gengiva', 'Menstruação muito forte', 'Urina', 'Fezes', 'Depois de cirurgia ou de tirar dente'], soSe: se('Manchas roxas ou sangramento'),
      },
      { id: 'sangramento_freq', rotulo: 'Com que frequência e quanto tempo dura?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: nariz 2 vezes por semana, 10 minutos', soSe: se('Manchas roxas ou sangramento') },
    ],
  },
  {
    titulo: 'Trombose',
    perguntas: [
      { id: 'trombose_local', rotulo: 'Onde foi e quando?', tipo: 'texto', placeholder: 'Ex.: perna esquerda, em 2024', soSe: se('Trombose') },
      {
        id: 'trombose_epoca', rotulo: 'Na época, houve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Cirurgia', 'Internação', 'Imobilização ou viagem longa', 'Gravidez ou pós-parto', 'Uso de hormônios'], soSe: se('Trombose'),
      },
      { id: 'anticoagulante', rotulo: 'Usa anticoagulante?', tipo: 'escolha', opcoes: SIM_NAO, abreLinha: 'Sim', placeholder: 'Qual?', soSe: se('Trombose') },
    ],
  },
  {
    titulo: 'Ínguas ou caroços',
    perguntas: [
      { id: 'ingua_local', rotulo: 'Onde?', tipo: 'texto', placeholder: 'Ex.: pescoço, lado direito', soSe: se('Ínguas ou caroços') },
      { id: 'ingua_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 2 meses', soSe: se('Ínguas ou caroços') },
      { id: 'ingua_evolucao', rotulo: 'Desde então:', tipo: 'escolha', opcoes: ['Aumentaram', 'Diminuíram', 'Iguais'], soSe: se('Ínguas ou caroços') },
    ],
  },
  {
    titulo: 'Hemograma alterado',
    perguntas: [
      { id: 'hemograma_alteracao', rotulo: 'O que estava alterado e quando?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: plaquetas 90 mil, em outubro', soSe: se('Hemograma alterado', 'Plaquetas alteradas', 'Glóbulos brancos alterados') },
      { id: 'hemograma_anteriores', rotulo: 'Tem hemogramas anteriores para comparar?', tipo: 'escolha', opcoes: SIM_NAO, soSe: se('Hemograma alterado', 'Plaquetas alteradas', 'Glóbulos brancos alterados') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Doença do sangue', 'Câncer ou tratamento de câncer', 'Cirurgia bariátrica', 'Doença nos rins ou no fígado', 'Transfusão de sangue'],
        abreLinha: 'Transfusão de sangue', placeholder: 'Quando e por quê?',
      },
      {
        id: 'familia', rotulo: 'Na família, alguém teve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Anemia hereditária', 'Doença falciforme ou talassemia', 'Sangramento fora do normal', 'Trombose', 'Não sei', OUTRO],
        exclusiva: 'Não sei', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { ...PARENTESCO, linhaToda: false },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: sulfato ferroso 40 mg, 1 vez ao dia' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Hemogramas atuais e anteriores', 'Ferritina ou exames de ferro', 'Coagulação', 'Laudos de biópsia', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de infectologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/infectologia-modelo.md).
const INFECTOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Febre ou calafrios', 'Tosse ou falta de ar', 'Diarreia ou vômitos', 'Ardor ao urinar', 'Ferida ou alteração na pele',
          'Infecções repetidas', 'Exame positivo ou alterado', 'Acompanhar HIV, hepatite ou tuberculose', 'Avaliação após exposição', 'Vacinas ou viagem', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é a sua principal preocupação?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Febre e sintomas',
    colunas: [['desde_quando', 'temp_max', 'febre_ultima'], ['curso', 'sintomas_local']],
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou?', tipo: 'texto', placeholder: 'Ex.: 20/11' },
      { id: 'temp_max', rotulo: 'Temperatura mais alta medida (°C)', tipo: 'texto', placeholder: 'Ex.: 38,7' },
      { id: 'febre_ultima', rotulo: 'Última febre', tipo: 'texto', placeholder: 'Ex.: ontem à noite' },
      { ...CURSO, rotulo: 'Desde então:', opcoes: ['Melhorou', 'Igual', 'Piorou', 'Vai e volta'] },
      { id: 'sintomas_local', rotulo: 'Outros sintomas, ou onde fica a ferida ou a dor', tipo: 'texto-longo', placeholder: 'Ex.: dor de cabeça, manchas no corpo' },
    ],
  },
  {
    titulo: 'Exposições',
    compacta: true,
    perguntas: [
      {
        id: 'exposicoes', rotulo: 'Nas últimas semanas, teve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Contato com pessoa doente', 'Contato com alguém com tuberculose', 'Área rural, mata ou garimpo', 'Contato com enchente ou lama',
          'Picada de carrapato', 'Mordida, arranhão ou contato com morcego', 'Água ou comida suspeita', 'Internação, cirurgia ou procedimento',
          'Exposição sexual ou a sangue'],
        dica: { opcao: 'Exposição sexual ou a sangue', texto: 'Se preferir, conte direto ao seu médico.' },
      },
      { id: 'exposicao_detalhe', rotulo: 'Onde, quando e o que aconteceu?', tipo: 'texto' },
      { id: 'contatos', rotulo: 'Pessoas próximas com sintomas parecidos', tipo: 'texto', placeholder: 'Ex.: o filho, com febre' },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Tem ou faz:', tipo: 'varias', duasColunas: true,
        opcoes: ['Diabetes', 'HIV', 'Transplante', 'Quimioterapia', 'Corticoide ou outro imunossupressor', 'Cateter, prótese ou outro dispositivo', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'tratamentos', rotulo: 'Antibióticos, antivirais ou outros tratamentos recentes', tipo: 'texto-longo', placeholder: 'Nome, datas e se melhorou' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Outros remédios que usa', tipo: 'texto-longo', placeholder: 'Nome, dose e frequência' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'pos_parto', rotulo: 'Teve bebê há pouco?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Vacinas e exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'O que você tem?', tipo: 'varias',
        opcoes: ['Carteira de vacinação', 'Culturas e antibiograma', 'Sorologias', 'PCR ou teste molecular', 'Imagens', 'Relatório de internação', 'Não tenho', OUTRO],
        exclusiva: 'Não tenho', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de oncologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/oncologia-modelo.md).
const ONCOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Investigar exame alterado', 'Diagnóstico recente', 'Segunda opinião', 'Tratamento em andamento',
          'Acompanhamento depois do tratamento', 'Controle de sintomas', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'O que gostaria de esclarecer ou resolver nesta consulta?', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Diagnóstico',
    perguntas: [
      { id: 'tipo_cancer', rotulo: 'Tipo de câncer e local, se souber', tipo: 'texto', placeholder: 'Ex.: mama esquerda' },
      { id: 'data_diagnostico', rotulo: 'Data do diagnóstico', tipo: 'texto', placeholder: 'Ex.: março de 2025' },
      { id: 'laudo_biopsia', rotulo: 'Tem o laudo da biópsia?', tipo: 'escolha', opcoes: SIM_NAO },
    ],
  },
  {
    titulo: 'Tratamentos',
    perguntas: [
      {
        id: 'tratamentos', rotulo: 'Já fez ou faz:', tipo: 'varias', duasColunas: true,
        opcoes: ['Cirurgia', 'Quimioterapia', 'Radioterapia', 'Imunoterapia', 'Terapia-alvo', 'Hormonioterapia', 'Nenhum ainda'],
        exclusiva: 'Nenhum ainda',
      },
      { id: 'tratamento_detalhe', rotulo: 'Nome do tratamento, data da última sessão ou dose e efeitos que sentiu', tipo: 'texto-longo', placeholder: 'Ex.: quimioterapia, último ciclo em 10/11, náusea e cansaço' },
    ],
  },
  {
    titulo: 'Sintomas',
    perguntas: [
      {
        id: 'sintomas', rotulo: 'Tem sentido:', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor', 'Cansaço', 'Falta de apetite', 'Perda de peso', 'Náuseas', 'Mudança no intestino', 'Tosse ou falta de ar', 'Dormência ou formigamento', 'Nenhum desses'],
        exclusiva: 'Nenhum desses',
      },
      { id: 'sintoma_principal', rotulo: 'Principal sintoma, quando começou e como evoluiu', tipo: 'texto', linhaToda: true },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, soSe: { pergunta: 'sintomas', opcao: 'Dor' } },
    ],
  },
  {
    titulo: 'Rotina e peso',
    colunas: [['autonomia', 'atividades_afetadas'], ['peso', 'peso_habitual', 'peso_mudanca']],
    perguntas: [
      { id: 'autonomia', rotulo: 'No dia a dia:', tipo: 'escolha', opcoes: ['Faço minhas atividades de sempre', 'Reduzi minhas atividades', 'Preciso de ajuda'] },
      { id: 'atividades_afetadas', rotulo: 'O que mais ficou difícil?', tipo: 'texto', placeholder: 'Ex.: trabalhar, fazer compras' },
      { id: 'peso', rotulo: 'Peso atual (kg)', tipo: 'texto', placeholder: 'Ex.: 64' },
      { id: 'peso_habitual', rotulo: 'Peso de costume (kg)', tipo: 'texto', placeholder: 'Ex.: 70' },
      { id: 'peso_mudanca', rotulo: 'Quanto mudou nos últimos meses?', tipo: 'texto', placeholder: 'Ex.: perdi 6 kg em 3 meses' },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'outras_doencas', rotulo: 'Outras doenças, cirurgias e internações', tipo: 'texto-longo' },
      { id: 'familia', rotulo: 'Câncer na família (tipo, parentesco e idade ao diagnóstico)', tipo: 'texto-longo', placeholder: 'Ex.: mãe, mama, aos 45 anos' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: tamoxifeno 20 mg, 1 vez ao dia' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Documentos',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais documentos você tem?', tipo: 'varias',
        opcoes: ['Laudo da biópsia (anatomopatológico)', 'Imuno-histoquímica ou teste molecular', 'Laudos e imagens', 'Exames de sangue', 'Relatório de tratamento', 'Não tenho', OUTRO],
        exclusiva: 'Não tenho', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de nefrologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/nefrologia-modelo.md).
const NEFROLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Creatinina alterada', 'Proteína ou sangue na urina', 'Urina com espuma', 'Inchaço', 'Pressão alta', 'Pedra no rim',
          'Infecções urinárias repetidas', 'Acompanhar doença renal', 'Diálise', 'Transplante de rim', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'O que gostaria de esclarecer ou resolver?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Quando começou e a urina',
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou, ou quando saiu o primeiro exame alterado?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: exame de junho de 2025' },
      {
        id: 'urina', rotulo: 'Na urina, notou:', tipo: 'varias', duasColunas: true,
        opcoes: ['Diminuiu a quantidade', 'Espuma frequente', 'Sangue visível', 'Ardor ao urinar', 'Acordo à noite para urinar', 'Nenhuma mudança'],
        exclusiva: 'Nenhuma mudança',
      },
      { id: 'urina_desde', rotulo: 'O que mudou e desde quando?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: espuma há 2 meses' },
    ],
  },
  {
    titulo: 'Inchaço, peso e pressão',
    colunas: [['inchaco', 'inchaco_desde', 'peso_habitual', 'peso'], ['has_dm', 'ano_diagnostico', 'medidas_pressao']],
    perguntas: [
      { id: 'inchaco', rotulo: 'Inchaço em:', tipo: 'varias', opcoes: ['Pálpebras', 'Pernas ou pés', 'Barriga', 'Não tenho inchaço'], exclusiva: 'Não tenho inchaço' },
      { id: 'inchaco_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 1 mês' },
      { id: 'peso_habitual', rotulo: 'Peso de costume (kg)', tipo: 'texto', placeholder: 'Ex.: 70' },
      { id: 'peso', rotulo: 'Peso atual (kg)', tipo: 'texto', placeholder: 'Ex.: 74' },
      { id: 'has_dm', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Pressão alta', 'Diabetes', 'Nenhum dos dois'], exclusiva: 'Nenhum dos dois' },
      { id: 'ano_diagnostico', rotulo: 'Ano do diagnóstico', tipo: 'texto', placeholder: 'Ex.: 2015', soSe: { pergunta: 'has_dm', opcao: ['Pressão alta', 'Diabetes'] } },
      { id: 'medidas_pressao', rotulo: 'Medidas recentes da pressão, se tiver', tipo: 'texto', placeholder: 'Ex.: 15 por 9' },
    ],
  },
  {
    titulo: 'Pedra no rim ou infecção urinária',
    perguntas: [
      { id: 'episodios', rotulo: 'Quantas vezes já teve?', tipo: 'texto', placeholder: 'Ex.: 3', soSe: se('Pedra no rim', 'Infecções urinárias repetidas') },
      { id: 'ultimo_episodio', rotulo: 'Quando foi a última?', tipo: 'texto', placeholder: 'Ex.: em setembro', soSe: se('Pedra no rim', 'Infecções urinárias repetidas') },
      { id: 'calculo_proc', rotulo: 'Precisou de:', tipo: 'varias', opcoes: ['Cirurgia', 'Cateter ou sonda', 'Internação'], soSe: se('Pedra no rim', 'Infecções urinárias repetidas') },
      { id: 'calculo_detalhes', rotulo: 'Detalhes', tipo: 'texto', soSe: se('Pedra no rim', 'Infecções urinárias repetidas') },
    ],
  },
  {
    titulo: 'Diálise ou transplante',
    perguntas: [
      { id: 'dialise_tipo', rotulo: 'Faz ou fez:', tipo: 'varias', opcoes: ['Hemodiálise', 'Diálise peritoneal', 'Transplante de rim'], soSe: se('Diálise', 'Transplante de rim') },
      { id: 'dialise_inicio', rotulo: 'Data de início ou do transplante', tipo: 'texto', placeholder: 'Ex.: 2022', soSe: se('Diálise', 'Transplante de rim') },
      { id: 'centro', rotulo: 'Centro onde é acompanhado', tipo: 'texto', soSe: se('Diálise', 'Transplante de rim') },
      { id: 'ultima_sessao', rotulo: 'Última sessão ou troca', tipo: 'texto', placeholder: 'Ex.: ontem', soSe: se('Diálise', 'Transplante de rim') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Lesão renal aguda', 'Doença autoimune', 'Rim único', 'Doença renal na família', OUTRO], abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'nefrotoxicos', rotulo: 'Usou há pouco anti-inflamatório, contraste de exame ou produto natural?', tipo: 'texto', linhaToda: true, placeholder: 'Qual e quando' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e frequência', tipo: 'texto-longo', placeholder: 'Ex.: losartana 50 mg, 2 vezes ao dia' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Creatinina atual e anteriores', 'Potássio', 'Exame de urina', 'Proteína ou albumina na urina', 'Ultrassom', 'Biópsia renal', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de ginecologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/ginecologia-modelo.md).
// "Pode estar grávida?" (Contracepção e gestação) ocupa o lugar do "Está grávida?" da Saúde geral.
const GINECOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      { id: 'queixa', rotulo: 'Qual é o principal motivo da consulta?', tipo: 'texto', linhaToda: true },
      {
        id: 'motivo', rotulo: 'Marque tudo o que se aplica:', tipo: 'varias', duasColunas: true,
        opcoes: ['Consulta de rotina', 'Sangramento fora do normal', 'Dor pélvica ou cólica', 'Corrimento, odor ou coceira', 'Dor na relação sexual',
          'Contracepção', 'Planejar gravidez', 'Menopausa', 'Queixa nas mamas', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
    ],
  },
  {
    titulo: 'Menstruação',
    perguntas: [
      { id: 'dum', rotulo: 'Data da última menstruação', tipo: 'texto', placeholder: 'Ex.: 10/11' },
      { id: 'ciclos', rotulo: 'Os ciclos são:', tipo: 'escolha', opcoes: ['Regulares', 'Irregulares', 'Não menstruo'] },
      { id: 'duracao_menstruacao', rotulo: 'Quantos dias dura?', tipo: 'texto', placeholder: 'Ex.: 5' },
      { id: 'mudanca_fluxo', rotulo: 'Mudou o fluxo ou o intervalo há pouco tempo?', tipo: 'texto', placeholder: 'Ex.: está vindo de 15 em 15 dias' },
    ],
  },
  {
    titulo: 'Sangramento fora do normal',
    perguntas: [
      {
        id: 'sangramento', rotulo: 'O sangramento é:', tipo: 'varias', duasColunas: true,
        opcoes: ['Entre as menstruações', 'Depois da relação', 'Depois da menopausa', 'Fluxo maior ou mais longo'], soSe: se('Sangramento fora do normal'),
      },
      { id: 'sangramento_inicio', rotulo: 'Quando começou e com que frequência?', tipo: 'texto', linhaToda: true, soSe: se('Sangramento fora do normal') },
    ],
  },
  {
    titulo: 'Dor pélvica',
    perguntas: [
      { id: 'dor_local', rotulo: 'Onde dói?', tipo: 'texto', placeholder: 'Ex.: pé da barriga, lado direito', soSe: se('Dor pélvica ou cólica', 'Dor na relação sexual') },
      {
        id: 'dor_quando', rotulo: 'Dói:', tipo: 'varias', duasColunas: true,
        opcoes: ['Na menstruação', 'Fora da menstruação', 'Na relação sexual', 'Ao urinar', 'Ao evacuar'], soSe: se('Dor pélvica ou cólica', 'Dor na relação sexual'),
      },
      { id: 'dor_piora', rotulo: 'O que melhora ou piora?', tipo: 'texto', soSe: se('Dor pélvica ou cólica', 'Dor na relação sexual') },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: se('Dor pélvica ou cólica', 'Dor na relação sexual') },
    ],
  },
  {
    titulo: 'Corrimento ou desconforto íntimo',
    perguntas: [
      { id: 'intimo', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Corrimento', 'Odor', 'Coceira', 'Ardor', 'Ferida ou caroço'], soSe: se('Corrimento, odor ou coceira') },
      { id: 'intimo_detalhe', rotulo: 'Quando começou, como é e o que já usou?', tipo: 'texto-longo', placeholder: 'Ex.: há 2 semanas, branco, usei pomada', soSe: se('Corrimento, odor ou coceira') },
    ],
  },
  {
    titulo: 'Contracepção e gestações',
    perguntas: [
      { id: 'metodo', rotulo: 'Método para evitar gravidez que usa hoje', tipo: 'texto', placeholder: 'Ex.: pílula, DIU, nenhum' },
      { id: 'pode_gravidez', rotulo: 'Pode estar grávida?', tipo: 'escolha', opcoes: ['Sim', 'Não', 'Não sei'] },
      { id: 'gestacoes', rotulo: 'Gestações, partos e perdas anteriores', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: 2 gestações, 1 parto normal, 1 perda' },
    ],
  },
  {
    titulo: 'Menopausa',
    perguntas: [
      { id: 'menopausa_idade', rotulo: 'Idade ou data aproximada da última menstruação', tipo: 'texto', placeholder: 'Ex.: aos 50 anos', soSe: se('Menopausa') },
      { id: 'menopausa_sintomas', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Ondas de calor', 'Secura vaginal', 'Sono alterado'], soSe: se('Menopausa') },
      { id: 'hormonios', rotulo: 'Usa hormônios?', tipo: 'escolha', opcoes: SIM_NAO, abreLinha: 'Sim', placeholder: 'Qual?', soSe: se('Menopausa') },
    ],
  },
  {
    titulo: 'Mamas',
    perguntas: [
      { id: 'mamas', rotulo: 'Nas mamas, notou:', tipo: 'varias', opcoes: ['Dor', 'Nódulo', 'Secreção pelo mamilo', 'Mudança na pele ou no mamilo'], soSe: se('Queixa nas mamas') },
      { id: 'mamas_lado', rotulo: 'Qual lado e desde quando?', tipo: 'texto', placeholder: 'Ex.: esquerda, há 1 mês', soSe: se('Queixa nas mamas') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'doencas', rotulo: 'Doenças, cirurgias ginecológicas e tratamentos anteriores', tipo: 'texto-longo' },
      { id: 'familia', rotulo: 'Câncer de mama, ovário, útero ou intestino na família (parentesco e idade)', tipo: 'texto-longo', placeholder: 'Ex.: mãe, mama, aos 48 anos' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e hormônios — nome, dose e frequência', tipo: 'texto-longo' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Preventivo ou teste de HPV', 'Ultrassom', 'Mamografia', 'Biópsia', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de urologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/urologia-modelo.md).
const UROLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    perguntas: [
      { id: 'queixa', rotulo: 'Qual é o principal motivo da consulta?', tipo: 'texto', linhaToda: true },
      {
        id: 'motivo', rotulo: 'Marque tudo o que se aplica:', tipo: 'varias', duasColunas: true,
        opcoes: ['Ardor ao urinar', 'Sangue na urina', 'Jato fraco ou dificuldade para urinar', 'Urgência, muitas vezes ou perda de urina',
          'Dor lombar ou pedra no rim', 'Infecção urinária de repetição', 'Dor, inchaço ou caroço no testículo', 'Próstata ou PSA',
          'Função sexual ou fertilidade', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: se('Ardor ao urinar', 'Dor lombar ou pedra no rim', 'Dor, inchaço ou caroço no testículo') },
    ],
  },
  {
    titulo: 'Jato urinário',
    perguntas: [
      {
        id: 'jato', rotulo: 'Ao urinar:', tipo: 'varias', duasColunas: true,
        opcoes: ['Demora para começar', 'Jato fraco ou interrompido', 'Preciso fazer força', 'Sensação de não esvaziar'], soSe: se('Jato fraco ou dificuldade para urinar'),
      },
      { id: 'jato_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 1 ano', soSe: se('Jato fraco ou dificuldade para urinar') },
    ],
  },
  {
    titulo: 'Frequência e perdas de urina',
    perguntas: [
      { id: 'vezes_dia', rotulo: 'Quantas vezes urina durante o dia?', tipo: 'texto', placeholder: 'Ex.: 10', soSe: se('Urgência, muitas vezes ou perda de urina') },
      { id: 'vezes_noite', rotulo: 'Quantas vezes acorda à noite para urinar?', tipo: 'texto', placeholder: 'Ex.: 3', soSe: se('Urgência, muitas vezes ou perda de urina') },
      {
        id: 'perdas', rotulo: 'Perde urina:', tipo: 'varias', opcoes: ['Ao tossir ou fazer força', 'Com vontade súbita', 'Sem perceber'],
        soSe: se('Urgência, muitas vezes ou perda de urina'),
      },
      { id: 'absorventes', rotulo: 'Quantos absorventes por dia?', tipo: 'texto', placeholder: 'Ex.: 2', soSe: se('Urgência, muitas vezes ou perda de urina') },
    ],
  },
  {
    titulo: 'Sangue na urina',
    perguntas: [
      { id: 'hematuria_tipo', rotulo: 'O sangue foi:', tipo: 'varias', opcoes: ['Visível', 'Visto só em exame'], soSe: se('Sangue na urina') },
      { id: 'hematuria_como', rotulo: 'Veio:', tipo: 'varias', opcoes: ['Com dor', 'Sem dor', 'Com coágulos'], soSe: se('Sangue na urina') },
      { id: 'hematuria_quando', rotulo: 'Primeira e última vez', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: em agosto e ontem', soSe: se('Sangue na urina') },
    ],
  },
  {
    titulo: 'Pedra no rim ou infecção',
    perguntas: [
      { id: 'episodios', rotulo: 'Quantas vezes já teve?', tipo: 'texto', placeholder: 'Ex.: 3', soSe: se('Dor lombar ou pedra no rim', 'Infecção urinária de repetição') },
      { id: 'ultimo_episodio', rotulo: 'Quando foi a última?', tipo: 'texto', placeholder: 'Ex.: em setembro', soSe: se('Dor lombar ou pedra no rim', 'Infecção urinária de repetição') },
      {
        id: 'calculo_proc', rotulo: 'Teve ou precisou de:', tipo: 'varias', duasColunas: true,
        opcoes: ['Febre junto', 'Internação', 'Cirurgia', 'Duplo J, sonda ou nefrostomia'], soSe: se('Dor lombar ou pedra no rim', 'Infecção urinária de repetição'),
      },
      { id: 'calculo_detalhes', rotulo: 'Detalhes', tipo: 'texto', linhaToda: true, soSe: se('Dor lombar ou pedra no rim', 'Infecção urinária de repetição') },
    ],
  },
  {
    titulo: 'Testículo ou genital',
    perguntas: [
      { id: 'genital', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Dor', 'Inchaço', 'Nódulo', 'Ferida', 'Secreção'], soSe: se('Dor, inchaço ou caroço no testículo') },
      { id: 'genital_detalhe', rotulo: 'Qual lado, quando começou e como evoluiu?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: direito, há 3 dias, piorando', soSe: se('Dor, inchaço ou caroço no testículo') },
    ],
  },
  {
    titulo: 'Próstata, função sexual ou fertilidade',
    perguntas: [
      { id: 'psa', rotulo: 'PSA anterior, se souber (valor e data)', tipo: 'texto', placeholder: 'Ex.: 3,2 em 2024', soSe: se('Próstata ou PSA', 'Função sexual ou fertilidade') },
      { id: 'objetivo', rotulo: 'O que gostaria de resolver?', tipo: 'texto-longo', soSe: se('Próstata ou PSA', 'Função sexual ou fertilidade') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'cirurgias', rotulo: 'Cirurgias, procedimentos, radioterapia ou acidentes', tipo: 'texto-longo' },
      TABAGISMO,
      { id: 'familia', rotulo: 'Doenças urológicas na família', tipo: 'texto', placeholder: 'Ex.: pai, câncer de próstata aos 65' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e frequência', tipo: 'texto-longo' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Urina ou urocultura', 'Creatinina', 'PSA', 'Ultrassom', 'Tomografia', 'Urofluxometria', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de geriatria trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/geriatria-modelo.md).
// Os blocos do modelo são a avaliação geriátrica ampla: aparecem para todos (cada um pode ser pulado).
// Saúde geral sem gravidez e amamentação (pessoa idosa).
const GERIATRIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Esquecimento', 'Quedas ou desequilíbrio', 'Fraqueza ou dificuldade para andar', 'Perda de peso ou de apetite',
          'Alteração do sono ou do humor', 'Perda de urina', 'Revisão dos remédios', 'Dificuldade nas tarefas do dia a dia', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é a principal preocupação?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Memória e comportamento',
    perguntas: [
      {
        id: 'memoria', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Repete perguntas', 'Esquece compromissos', 'Confunde remédios ou contas', 'Mudou o comportamento', 'Nada disso'],
        exclusiva: 'Nada disso',
      },
      { id: 'memoria_quem', rotulo: 'Quem percebeu e desde quando?', tipo: 'texto', placeholder: 'Ex.: a filha, há 1 ano', linhaToda: true },
    ],
  },
  {
    titulo: 'Mobilidade e quedas',
    perguntas: [
      { id: 'quedas', rotulo: 'Quantas quedas nos últimos 12 meses?', tipo: 'texto', placeholder: 'Ex.: 2' },
      { id: 'apoio', rotulo: 'Usa para andar:', tipo: 'varias', opcoes: ['Bengala', 'Andador', 'Cadeira de rodas', 'Nada'], exclusiva: 'Nada' },
      { id: 'ultima_queda', rotulo: 'Última queda: quando, como foi e se machucou', tipo: 'texto', placeholder: 'Ex.: em outubro, no banheiro, machucou o braço', linhaToda: true },
    ],
  },
  {
    titulo: 'Autonomia',
    perguntas: [
      {
        id: 'ajuda', rotulo: 'Precisa de ajuda para:', tipo: 'varias', duasColunas: true,
        opcoes: ['Tomar banho', 'Vestir-se', 'Ir ao banheiro', 'Comer', 'Preparar as refeições', 'Fazer compras',
          'Cuidar do dinheiro ou dos remédios', 'Não preciso de ajuda'],
        exclusiva: 'Não preciso de ajuda',
      },
      { id: 'autonomia_mudou', rotulo: 'O que mudou há pouco tempo?', tipo: 'texto', placeholder: 'Ex.: parou de cozinhar há 2 meses', linhaToda: true },
    ],
  },
  {
    titulo: 'Alimentação e deglutição',
    perguntas: [
      { id: 'peso_habitual', rotulo: 'Peso de costume (kg)', tipo: 'texto', placeholder: 'Ex.: 70' },
      { id: 'peso', rotulo: 'Peso atual (kg)', tipo: 'texto', placeholder: 'Ex.: 64' },
      {
        id: 'alimentacao', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Menos apetite', 'Dificuldade para mastigar', 'Engasgos', 'Dificuldade para engolir', 'Nada disso'], exclusiva: 'Nada disso',
      },
    ],
  },
  {
    titulo: 'Humor, sono e sentidos',
    perguntas: [
      {
        id: 'humor', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Tristeza', 'Perda de interesse', 'Ansiedade', 'Sono ruim', 'Dificuldade para enxergar', 'Dificuldade para ouvir', 'Nada disso'],
        exclusiva: 'Nada disso',
      },
      { id: 'oculos', rotulo: 'Usa:', tipo: 'varias', opcoes: ['Óculos', 'Aparelho auditivo', 'Nenhum'], exclusiva: 'Nenhum' },
    ],
  },
  {
    titulo: 'Moradia e apoio',
    perguntas: [
      { id: 'moradia', rotulo: 'Marque o que se aplica:', tipo: 'varias', opcoes: ['Mora só', 'Mora com familiares', 'Tem cuidador', 'Mora em instituição'] },
      { id: 'quem_ajuda', rotulo: 'Quem ajuda e com que frequência?', tipo: 'texto', placeholder: 'Ex.: a filha, todos os dias à tarde', linhaToda: true },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [{ id: 'doencas', rotulo: 'Doenças, cirurgias ou internações recentes', tipo: 'texto-longo' }],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios e suplementos — nome, dose e horário', tipo: 'texto-longo', placeholder: 'Ex.: losartana 50 mg, às 8h e às 20h' },
      { id: 'mudancas', rotulo: 'Algum remédio começou, mudou ou parou há pouco tempo?', tipo: 'texto', linhaToda: true, placeholder: 'Qual e quando' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
    ],
  },
  {
    titulo: 'O que é importante para você',
    semPular: true,
    perguntas: [{ id: 'preservar', rotulo: 'O que mais gostaria de preservar ou recuperar na sua rotina?', tipo: 'texto-longo', placeholder: 'Ex.: voltar a caminhar até a padaria' }],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias',
        opcoes: ['Exames de sangue', 'Raio X, tomografia ou ressonância', 'Eletrocardiograma', 'Densitometria', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de pediatria trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/pediatria-modelo.md).
// Quem preenche é o responsável ou o adolescente; sem "Estado civil e trabalho" e sem gravidez e amamentação (criança).
const PEDIATRIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      {
        id: 'preenchido_por', rotulo: 'Quem está preenchendo?', tipo: 'escolha', opcoes: ['Responsável', 'O próprio adolescente'],
        abreLinha: 'Responsável', placeholder: 'Nome e vínculo (ex.: Ana, mãe)',
      },
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Consulta de rotina', 'Febre', 'Tosse ou dificuldade para respirar', 'Vômitos ou diarreia', 'Dor', 'Manchas ou lesões na pele',
          'Alimentação ou crescimento', 'Desenvolvimento, fala ou comportamento', 'Sono', 'Escola', 'Vacinas', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é a principal preocupação?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Queixa atual',
    perguntas: [
      { id: 'evolucao', rotulo: 'Quando começou e como evoluiu?', tipo: 'texto', placeholder: 'Ex.: há 3 dias, piorando à noite', linhaToda: true },
      { id: 'febre_max', rotulo: 'Temperatura mais alta medida (°C)', tipo: 'texto', placeholder: 'Ex.: 38,7', soSe: se('Febre') },
      { id: 'remedios_dados', rotulo: 'Remédios já dados — nome, dose e horário', tipo: 'texto', placeholder: 'Ex.: dipirona 10 gotas às 14h', linhaToda: true },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: se('Dor') },
    ],
  },
  {
    titulo: 'Gestação e nascimento',
    perguntas: [
      { id: 'semanas', rotulo: 'Nasceu com quantas semanas?', tipo: 'texto', placeholder: 'Ex.: 39' },
      { id: 'peso_nascer', rotulo: 'Peso ao nascer (gramas)', tipo: 'texto', placeholder: 'Ex.: 3.200' },
      {
        id: 'nascimento', rotulo: 'Marque o que aconteceu:', tipo: 'varias', duasColunas: true,
        opcoes: ['Nasceu prematuro', 'Ficou internado ao nascer', 'Problema no parto', 'Nada disso'], exclusiva: 'Nada disso',
      },
      { id: 'nascimento_detalhes', rotulo: 'Detalhes', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Alimentação, urina e fezes',
    perguntas: [
      {
        id: 'alimentacao', rotulo: 'Hoje se alimenta de:', tipo: 'varias', duasColunas: true,
        opcoes: ['Leite materno', 'Fórmula (leite em pó)', 'Papinhas e outros alimentos', 'Comida da família'],
      },
      { id: 'alimentacao_mudou', rotulo: 'O que mudou na alimentação, nas mamadas, no xixi ou no cocô?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: mama menos, fez xixi só 2 vezes hoje' },
    ],
  },
  {
    titulo: 'Crescimento e desenvolvimento',
    perguntas: [
      {
        id: 'desenvolvimento', rotulo: 'Há preocupação com:', tipo: 'varias', duasColunas: true,
        opcoes: ['Ganho de peso ou altura', 'Fala', 'Movimentos', 'Convivência com outras pessoas', 'Aprendizagem', 'Nenhuma preocupação'],
        exclusiva: 'Nenhuma preocupação',
      },
      { id: 'desenvolvimento_obs', rotulo: 'Conte o que observou', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: ainda não fala palavras aos 2 anos' },
    ],
  },
  {
    titulo: 'Sono, rotina e escola',
    perguntas: [
      { id: 'sono', rotulo: 'Como dorme?', tipo: 'texto', placeholder: 'Ex.: acorda 3 vezes à noite' },
      { id: 'escola', rotulo: 'Creche ou escola', tipo: 'texto', placeholder: 'Ex.: 2º ano, vai bem' },
      { id: 'tela', rotulo: 'Atividade física e tempo de tela', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: futebol 2 vezes por semana, 3 horas de celular por dia' },
    ],
  },
  {
    titulo: 'Adolescência',
    perguntas: [
      {
        id: 'adolescencia', rotulo: 'Se for adolescente, quer falar sobre:', tipo: 'varias', duasColunas: true,
        opcoes: ['Puberdade', 'Menstruação', 'Sono ou humor', 'Escola ou amizades', 'Quero conversar a sós com meu médico'],
      },
      { id: 'adolescencia_obs', rotulo: 'Observações', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'doencas', rotulo: 'Doenças, internações ou cirurgias anteriores', tipo: 'texto-longo' },
      { id: 'familia', rotulo: 'Doenças na família e contato recente com pessoas doentes', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: avó com asma; irmão com gripe esta semana' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios de uso contínuo — nome e dose', tipo: 'texto-longo', placeholder: 'Ex.: sulfato ferroso 15 gotas, 1 vez ao dia' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
    ],
  },
  {
    titulo: 'Documentos',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'documentos_tem', rotulo: 'Quais documentos você tem?', tipo: 'varias', duasColunas: true,
        opcoes: ['Caderneta da Criança', 'Carteira de vacinação', 'Testes do pezinho, orelhinha e olhinho', 'Exames',
          'Relatório da escola ou de terapia', 'Não tenho'],
        exclusiva: 'Não tenho',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de psiquiatria trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/psiquiatria-modelo.md).
// Os blocos do modelo valem para todas as queixas; o risco (suicídio, agressão) fica só no checklist do médico.
const PSIQUIATRIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Tristeza ou perda de interesse', 'Ansiedade', 'Crises de pânico', 'Alteração do sono', 'Irritabilidade',
          'Oscilações de humor ou energia', 'Dificuldade de atenção ou memória', 'Pensamentos repetitivos ou rituais',
          'Alteração do apetite', 'Uso de álcool ou outras substâncias', 'Revisão de tratamento', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'O que gostaria de conversar ou resolver?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Como começou',
    perguntas: [
      { id: 'desde_quando', rotulo: 'Quando começou?', tipo: 'texto', placeholder: 'Ex.: há 6 meses' },
      { id: 'curso', rotulo: 'Como é?', tipo: 'escolha', opcoes: ['Contínuo', 'Vai e volta'] },
      { id: 'mudou', rotulo: 'O que mudou há pouco tempo?', tipo: 'texto', placeholder: 'Ex.: perdi o emprego em agosto', linhaToda: true },
    ],
  },
  {
    titulo: 'Impacto na rotina',
    perguntas: [
      { id: 'impacto', rotulo: 'Atrapalha em:', tipo: 'varias', opcoes: ['Trabalho ou estudo', 'Relacionamentos', 'Sono', 'Cuidar de si'] },
      { id: 'impacto_dificil', rotulo: 'O que ficou mais difícil?', tipo: 'texto', placeholder: 'Ex.: sair de casa, concentrar no trabalho', linhaToda: true },
    ],
  },
  {
    titulo: 'Sono e energia',
    perguntas: [
      { id: 'horas_sono', rotulo: 'Quantas horas dorme por noite?', tipo: 'texto', placeholder: 'Ex.: 5' },
      {
        id: 'sono', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Dificuldade para dormir', 'Acorda durante a noite', 'Dorme mais que o normal', 'Dorme pouco e continua com energia', 'Nada disso'],
        exclusiva: 'Nada disso',
      },
    ],
  },
  {
    titulo: 'Tratamentos anteriores',
    perguntas: [
      {
        id: 'tratamentos', rotulo: 'Já fez:', tipo: 'varias', duasColunas: true,
        opcoes: ['Psicoterapia', 'Tratamento com remédios', 'Atendimento de urgência', 'Internação psiquiátrica', 'Nenhum'], exclusiva: 'Nenhum',
      },
      { id: 'tratamentos_detalhe', rotulo: 'Quando, por quê e como foi a resposta?', tipo: 'texto-longo', placeholder: 'Ex.: sertralina em 2022, melhorou, parei sozinho' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios em uso — nome, dose e horário', tipo: 'texto-longo', placeholder: 'Ex.: escitalopram 10 mg, de manhã' },
      { id: 'mudancas', rotulo: 'Parou ou mudou algum remédio há pouco tempo?', tipo: 'texto', placeholder: 'Qual e quando' },
      { id: 'efeitos', rotulo: 'Efeitos indesejados dos remédios', tipo: 'texto', placeholder: 'Ex.: sonolência, ganho de peso' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'pos_parto', rotulo: 'Teve bebê há menos de 1 ano?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Álcool e outras substâncias',
    perguntas: [
      {
        id: 'substancias', rotulo: 'Usa ou usou:', tipo: 'varias', duasColunas: true,
        opcoes: ['Álcool', 'Cigarro', 'Maconha', 'Estimulantes (ex.: cocaína)', 'Calmantes ou remédios para dormir', 'Nenhuma', OUTRO],
        exclusiva: 'Nenhuma', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'substancias_freq', rotulo: 'Com que frequência e quando foi a última vez?', tipo: 'texto', placeholder: 'Ex.: cerveja nos fins de semana, último sábado', linhaToda: true },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'doencas', rotulo: 'Outras doenças', tipo: 'texto', placeholder: 'Ex.: hipotireoidismo' },
      { id: 'familia', rotulo: 'Doenças na família (qual e parentesco)', tipo: 'texto', placeholder: 'Ex.: mãe com depressão' },
      { id: 'particular', rotulo: 'Há algum assunto que prefere conversar a sós com seu médico?', tipo: 'escolha', opcoes: SIM_NAO, linhaToda: true },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames ou relatórios você tem?', tipo: 'varias',
        opcoes: ['Exames de sangue', 'Eletrocardiograma', 'Relatório de outro profissional', 'Não tenho', OUTRO],
        exclusiva: 'Não tenho', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de otorrinolaringologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/otorrinolaringologia-modelo.md).
// Cada bloco só aparece para quem marcou a queixa dele no motivo.
const OUVIDO = se('Dor de ouvido', 'Perda auditiva', 'Zumbido')
const NARIZ = se('Nariz entupido', 'Coriza ou espirros', 'Sangramento nasal', 'Alteração do olfato')
const GARGANTA = se('Dor de garganta', 'Rouquidão', 'Dificuldade para engolir')
const OTORRINOLARINGOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa', 'nota_dor']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', tresColunas: true,
        opcoes: ['Dor de ouvido', 'Perda auditiva', 'Zumbido', 'Tontura ou sensação de giro', 'Nariz entupido', 'Coriza ou espirros',
          'Sangramento nasal', 'Alteração do olfato', 'Dor de garganta', 'Rouquidão', 'Dificuldade para engolir',
          'Ronco ou pausas no sono', 'Caroço no pescoço', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é o principal motivo?', tipo: 'texto' },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: se('Dor de ouvido', 'Dor de garganta') },
    ],
  },
  {
    titulo: 'Ouvido e audição',
    perguntas: [
      { id: 'ouvido_lado', rotulo: 'Qual ouvido?', tipo: 'escolha', opcoes: ['Direito', 'Esquerdo', 'Os dois'], soSe: OUVIDO },
      { id: 'ouvido_inicio', rotulo: 'Começou:', tipo: 'escolha', opcoes: ['De repente', 'Aos poucos'], soSe: OUVIDO },
      { id: 'ouvido', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Dor', 'Secreção', 'Ouvido tampado', 'Zumbido', 'Perda auditiva'], soSe: OUVIDO },
    ],
  },
  {
    titulo: 'Tontura',
    perguntas: [
      { id: 'tontura_tipo', rotulo: 'Como é?', tipo: 'varias', opcoes: ['Tudo gira', 'Desequilíbrio', 'Sensação de desmaio'], soSe: se('Tontura ou sensação de giro') },
      { id: 'tontura_duracao', rotulo: 'Quanto tempo dura?', tipo: 'texto', placeholder: 'Ex.: segundos, horas', soSe: se('Tontura ou sensação de giro') },
      { id: 'tontura_posicao', rotulo: 'Aparece ao virar a cabeça ou mudar de posição?', tipo: 'escolha', opcoes: SIM_NAO, soSe: se('Tontura ou sensação de giro') },
      { id: 'tontura_audicao', rotulo: 'A audição mudou junto?', tipo: 'escolha', opcoes: SIM_NAO, soSe: se('Tontura ou sensação de giro') },
    ],
  },
  {
    titulo: 'Nariz e rosto',
    perguntas: [
      {
        id: 'nariz', rotulo: 'Tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Nariz entupido de um lado', 'Nariz entupido dos dois lados', 'Secreção', 'Pressão no rosto', 'Alteração do olfato', 'Sangramento'],
        soSe: NARIZ,
      },
      { id: 'nariz_detalhe', rotulo: 'Quando começou, de que lado, quantas vezes e quanto dura', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: há 2 anos, lado direito, todo dia', soSe: NARIZ },
    ],
  },
  {
    titulo: 'Garganta, voz e engolir',
    perguntas: [
      {
        id: 'garganta', rotulo: 'Tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor de garganta', 'Rouquidão', 'Dor ao engolir', 'Dificuldade para engolir', 'Engasgos'], soSe: GARGANTA,
      },
      { id: 'engolir_com', rotulo: 'Dificuldade com:', tipo: 'escolha', opcoes: ['Sólidos', 'Líquidos', 'Os dois'], soSe: GARGANTA },
      { id: 'garganta_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 2 meses', soSe: GARGANTA },
    ],
  },
  {
    titulo: 'Sono',
    perguntas: [
      {
        id: 'sono', rotulo: 'Marque o que acontece:', tipo: 'varias', duasColunas: true,
        opcoes: ['Ronco', 'Alguém viu pausas na respiração', 'Acordo cansado', 'Sono durante o dia'], soSe: se('Ronco ou pausas no sono'),
      },
      { id: 'sono_quem', rotulo: 'Quem percebeu e quantas vezes por semana?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: a esposa, todas as noites', soSe: se('Ronco ou pausas no sono') },
    ],
  },
  {
    titulo: 'Pescoço',
    perguntas: [
      { id: 'pescoco', rotulo: 'Tem:', tipo: 'varias', opcoes: ['Caroço', 'Dor', 'Inchaço'], soSe: se('Caroço no pescoço') },
      { id: 'pescoco_detalhe', rotulo: 'Onde, quando começou e se mudou de tamanho', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: lado esquerdo, há 1 mês, crescendo', soSe: se('Caroço no pescoço') },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      { id: 'cirurgias', rotulo: 'Cirurgias, pancadas ou infecções anteriores (ouvido, nariz, garganta)', tipo: 'texto-longo' },
      TABAGISMO,
      { id: 'exposicao', rotulo: 'Barulho forte ou uso da voz no trabalho', tipo: 'texto', placeholder: 'Ex.: professora; fábrica barulhenta' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios, sprays de nariz e gotas de ouvido — nome e dose', tipo: 'texto-longo' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias', duasColunas: true,
        opcoes: ['Audiometria', 'Imitanciometria', 'Nasofibrolaringoscopia', 'Polissonografia', 'Tomografia ou outras imagens', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de pneumologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/pneumologia-modelo.md).
// Os blocos de cada queixa só aparecem para quem a marcou; tabagismo e exposições valem para todos.
const RESPIRATORIO = se('Falta de ar', 'Chiado no peito', 'Infecções respiratórias repetidas', 'Acompanhamento de doença pulmonar')
const FUMA = { pergunta: 'tabagismo', opcao: ['Fuma atualmente', 'Ex-fumante'] }
const PNEUMOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa', 'nota_dor']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Tosse', 'Catarro', 'Falta de ar', 'Chiado no peito', 'Dor no peito', 'Infecções respiratórias repetidas', 'Ronco ou pausas no sono',
          'Avaliar exame ou nódulo no pulmão', 'Acompanhamento de doença pulmonar', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é o principal motivo?', tipo: 'texto' },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: se('Dor no peito') },
    ],
  },
  {
    titulo: 'Tosse e catarro',
    perguntas: [
      { id: 'tosse_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 2 meses', soSe: se('Tosse', 'Catarro') },
      { id: 'tosse_tipo', rotulo: 'A tosse é:', tipo: 'escolha', opcoes: ['Seca', 'Com catarro'], soSe: se('Tosse', 'Catarro') },
      { id: 'tosse_piora', rotulo: 'Piora à noite, ao acordar ou em alguma situação?', tipo: 'texto', linhaToda: true, soSe: se('Tosse', 'Catarro') },
      { id: 'catarro', rotulo: 'Cor e quantidade do catarro', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: amarelo, meio copo por dia', soSe: se('Tosse', 'Catarro') },
    ],
  },
  {
    titulo: 'Falta de ar',
    perguntas: [
      { id: 'dispneia_inicio', rotulo: 'Quando começou e como evoluiu?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: há 1 ano, piorando aos poucos', soSe: se('Falta de ar') },
      {
        id: 'dispneia_quando', rotulo: 'Sente falta de ar:', tipo: 'varias', duasColunas: true,
        opcoes: ['Ao subir escadas', 'Ao caminhar no plano', 'Ao se vestir ou tomar banho', 'Em repouso', 'Ao deitar'], soSe: se('Falta de ar'),
      },
      { id: 'caminhar', rotulo: 'Quanto consegue caminhar hoje?', tipo: 'texto', placeholder: 'Ex.: 2 quarteirões', soSe: se('Falta de ar') },
    ],
  },
  {
    titulo: 'Chiado ou aperto no peito',
    perguntas: [
      { id: 'chiado_freq', rotulo: 'Quantas vezes acontece?', tipo: 'texto', placeholder: 'Ex.: 3 vezes por semana', soSe: se('Chiado no peito') },
      { id: 'chiado_quando', rotulo: 'Aparece:', tipo: 'varias', opcoes: ['Com exercício', 'Com poeira, fumaça ou cheiros fortes', 'À noite'], soSe: se('Chiado no peito') },
      { id: 'bombinha', rotulo: 'Bombinha de alívio: qual e quantas vezes usou na última semana?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: salbutamol, 4 vezes', soSe: se('Chiado no peito') },
    ],
  },
  {
    titulo: 'Crises nos últimos 12 meses',
    perguntas: [
      { id: 'urgencia', rotulo: 'Quantas idas à urgência?', tipo: 'texto', placeholder: 'Ex.: 2', soSe: RESPIRATORIO },
      { id: 'internacoes', rotulo: 'Quantas internações?', tipo: 'texto', placeholder: 'Ex.: 1', soSe: RESPIRATORIO },
      { id: 'corticoide', rotulo: 'Quantas vezes usou corticoide em comprimido ou injeção?', tipo: 'texto', placeholder: 'Ex.: 3', soSe: RESPIRATORIO },
      { id: 'uti', rotulo: 'Já precisou de UTI ou de tubo para respirar?', tipo: 'escolha', opcoes: SIM_NAO, soSe: RESPIRATORIO },
    ],
  },
  {
    titulo: 'Sono',
    perguntas: [
      { id: 'sono', rotulo: 'Marque o que acontece:', tipo: 'varias', opcoes: ['Ronco', 'Alguém viu pausas na respiração', 'Sono durante o dia'], soSe: se('Ronco ou pausas no sono') },
      { id: 'cpap', rotulo: 'Usa CPAP ou outro aparelho?', tipo: 'texto', placeholder: 'Ex.: CPAP todas as noites', soSe: se('Ronco ou pausas no sono') },
    ],
  },
  {
    titulo: 'Cigarro e exposições',
    perguntas: [
      { ...TABAGISMO, lista: undefined },
      { id: 'cigarros_dia', rotulo: 'Cigarros por dia', tipo: 'texto', placeholder: 'Ex.: 20', soSe: FUMA },
      { id: 'anos_fumo', rotulo: 'Fumou por quantos anos?', tipo: 'texto', placeholder: 'Ex.: 30', soSe: FUMA },
      { id: 'parou', rotulo: 'Quando parou?', tipo: 'texto', placeholder: 'Ex.: em 2020', soSe: { pergunta: 'tabagismo', opcao: 'Ex-fumante' } },
      {
        id: 'exposicoes', rotulo: 'Tem ou teve contato com:', tipo: 'varias', duasColunas: true,
        opcoes: ['Cigarro eletrônico', 'Fumaça de lenha', 'Poeira no trabalho', 'Mofo', 'Aves', 'Nenhum desses'], exclusiva: 'Nenhum desses',
      },
      { id: 'exposicao_detalhe', rotulo: 'Detalhes', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: fogão a lenha na infância; trabalhou em pedreira' },
    ],
  },
  {
    titulo: 'Histórico de saúde',
    perguntas: [
      {
        id: 'doencas', rotulo: 'Já teve diagnóstico de:', tipo: 'varias', duasColunas: true,
        opcoes: ['Asma', 'DPOC ou enfisema', 'Tuberculose', 'Bronquiectasias', 'Fibrose pulmonar', 'Apneia do sono', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'contato_tb', rotulo: 'Contato com pessoa com tuberculose: quando e por quanto tempo', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: o irmão, em 2025, moramos juntos 6 meses' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Bombinhas e outros remédios — nome e dose', tipo: 'texto-longo', placeholder: 'Ex.: formoterol + budesonida, 2 jatos de 12 em 12 horas' },
      { id: 'oxigenio', rotulo: 'Usa oxigênio em casa? Fluxo e horários', tipo: 'texto', placeholder: 'Ex.: 2 litros, à noite' },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias', duasColunas: true,
        opcoes: ['Espirometria', 'Raio X', 'Tomografia', 'Exame de escarro', 'Polissonografia', 'Não tenho exames', OUTRO],
        exclusiva: 'Não tenho exames', abreLinha: OUTRO, placeholder: 'Qual?',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de hepatologia trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/hepatologia-modelo.md).
// Os blocos do modelo valem para todas as queixas (cada um pode ser pulado).
const HEPATOLOGIA: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Exame do fígado alterado', 'Gordura no fígado', 'Hepatite viral', 'Cirrose', 'Olhos ou pele amarelados', 'Coceira',
          'Inchaço na barriga ou nas pernas', 'Nódulo no fígado', 'Acompanhamento após tratamento ou transplante', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'Qual é o principal motivo?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Diagnóstico ou exame alterado',
    perguntas: [
      { id: 'alteracao', rotulo: 'Qual foi a alteração e quando apareceu?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: TGP alta em março' },
      { id: 'causa', rotulo: 'Já disseram qual é a causa?', tipo: 'texto', placeholder: 'Ex.: gordura no fígado' },
      { id: 'exames_anteriores', rotulo: 'Tem exames anteriores para comparar?', tipo: 'escolha', opcoes: SIM_NAO },
    ],
  },
  {
    titulo: 'Sintomas',
    perguntas: [
      {
        id: 'sintomas', rotulo: 'Tem ou teve há pouco tempo:', tipo: 'varias', duasColunas: true,
        opcoes: ['Cansaço', 'Coceira', 'Olhos ou pele amarelados', 'Urina escura', 'Fezes claras', 'Barriga aumentada', 'Inchaço nas pernas', 'Nenhum desses'],
        exclusiva: 'Nenhum desses',
      },
      { id: 'sintomas_evolucao', rotulo: 'Quando começou e como evoluiu?', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Complicações e procedimentos',
    perguntas: [
      {
        id: 'complicacoes', rotulo: 'Já teve:', tipo: 'varias', duasColunas: true,
        opcoes: ['Líquido na barriga', 'Retirada de líquido da barriga', 'Varizes no esôfago', 'Sangramento digestivo', 'Internação por confusão ou sonolência', 'Nada disso'],
        exclusiva: 'Nada disso',
      },
      { id: 'complicacoes_quando', rotulo: 'Quando e qual tratamento recebeu?', tipo: 'texto', linhaToda: true },
    ],
  },
  {
    titulo: 'Bebida alcoólica',
    perguntas: [
      { id: 'bebida', rotulo: 'Tipo de bebida', tipo: 'texto', placeholder: 'Ex.: cerveja', semResposta: 'Não bebo' },
      { id: 'bebida_quantidade', rotulo: 'Quantidade por vez', tipo: 'texto', placeholder: 'Ex.: 4 latas' },
      { id: 'bebida_dias', rotulo: 'Dias por semana', tipo: 'texto', placeholder: 'Ex.: 2' },
      { id: 'bebida_ultima', rotulo: 'Última vez que bebeu', tipo: 'texto', placeholder: 'Ex.: sábado' },
    ],
  },
  {
    titulo: 'Hepatites e tratamentos',
    perguntas: [
      { id: 'hepatites', rotulo: 'Teve ou tem:', tipo: 'varias', opcoes: ['Hepatite B', 'Hepatite C', 'Outra ou não sei'] },
      { id: 'vacina_b', rotulo: 'Vacina contra hepatite B', tipo: 'escolha', opcoes: ['Tomei', 'Não tomei', 'Não sei'] },
      { id: 'tratou', rotulo: 'Já tratou? Nome do remédio e período', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: sofosbuvir em 2021' },
    ],
  },
  {
    titulo: 'Outras doenças e família',
    perguntas: [
      {
        id: 'condicoes', rotulo: 'Marque o que tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Diabetes', 'Pressão alta', 'Colesterol alto', 'Cirurgia bariátrica', 'Doença do fígado na família'],
      },
      { id: 'familia', rotulo: 'Na família: qual doença, parentesco e idade ao diagnóstico', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: pai, cirrose aos 60' },
    ],
  },
  {
    titulo: 'Remédios e peso',
    colunas: [['medicamentos'], ['peso', 'peso_habitual', 'peso_mudanca']],
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios, vitaminas, chás, suplementos e anabolizantes — nome, dose e desde quando', tipo: 'texto-longo', placeholder: 'Ex.: chá de boldo todo dia, desde janeiro' },
      { id: 'peso', rotulo: 'Peso atual (kg)', tipo: 'texto', placeholder: 'Ex.: 82' },
      { id: 'peso_habitual', rotulo: 'Peso de costume (kg)', tipo: 'texto', placeholder: 'Ex.: 78' },
      { id: 'peso_mudanca', rotulo: 'Mudou há pouco tempo?', tipo: 'texto', placeholder: 'Ex.: ganhei 4 kg em 6 meses' },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias', duasColunas: true,
        opcoes: ['Exames de sangue', 'Sorologias', 'Ultrassom', 'Elastografia', 'Tomografia ou ressonância', 'Endoscopia', 'Biópsia', 'Não tenho exames'],
        exclusiva: 'Não tenho exames',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

// Pré-consulta de cirurgia geral trazida pelo autor (26/11/2026), no mesmo esqueleto (docs/especialidades/cirurgia-geral-modelo.md).
// Cada queixa é uma parte que só aparece para quem a marcou; cirurgias, anestesia e remédios valem para todos.
const DOR_ABDOMINAL = se('Dor na barriga')
const HERNIA = se('Hérnia ou abaulamento')
const VESICULA = se('Pedra na vesícula')
const PELE = se('Caroço ou lesão na pele')
const ANUS = se('Problema no ânus')
const POS_OPERATORIO = se('Retorno após cirurgia')
const CIRURGIA_GERAL: Parte[] = [
  {
    titulo: 'Motivo da consulta',
    compacta: true,
    telasDoMedico: [['preenchido_por', 'motivo'], ['queixa']],
    perguntas: [
      PREENCHIDO_POR,
      {
        id: 'motivo', rotulo: 'O que motivou a consulta?', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor na barriga', 'Hérnia ou abaulamento', 'Pedra na vesícula', 'Caroço ou lesão na pele', 'Problema no ânus',
          'Avaliação antes de cirurgia', 'Retorno após cirurgia', 'Revisão de exames', OUTRO],
        abreLinha: OUTRO, placeholder: 'Qual?',
      },
      { id: 'queixa', rotulo: 'O que gostaria de esclarecer ou resolver nesta consulta?', tipo: 'texto' },
    ],
  },
  {
    titulo: 'Dor na barriga',
    perguntas: [
      { id: 'dor_onde', rotulo: 'Onde dói?', tipo: 'texto', placeholder: 'Ex.: lado direito, embaixo', soSe: DOR_ABDOMINAL },
      { id: 'dor_inicio', rotulo: 'Quando começou?', tipo: 'texto', placeholder: 'Ex.: há 3 dias', soSe: DOR_ABDOMINAL },
      { id: 'dor_tipo', rotulo: 'A dor é:', tipo: 'escolha', opcoes: ['Contínua', 'Em crises'], soSe: DOR_ABDOMINAL },
      { id: 'dor_relacao', rotulo: 'Muda com comida, esforço ou ao evacuar?', tipo: 'texto', placeholder: 'Ex.: piora depois de comer gordura', soSe: DOR_ABDOMINAL },
      // nota da dor sempre que houver dor (regra 5.8)
      { ...NOTA_DOR, linhaToda: true, soSe: DOR_ABDOMINAL },
    ],
  },
  {
    titulo: 'Hérnia ou abaulamento',
    perguntas: [
      { id: 'hernia_local', rotulo: 'Onde fica?', tipo: 'texto', placeholder: 'Ex.: virilha direita, umbigo', soSe: HERNIA },
      {
        id: 'hernia', rotulo: 'Marque o que acontece:', tipo: 'varias', linhaToda: true,
        opcoes: ['Aparece ao tossir ou fazer força', 'Diminui ao deitar', 'Fica aparente o tempo todo'], soSe: HERNIA,
      },
      { id: 'hernia_dor', rotulo: 'Dói?', tipo: 'escolha', opcoes: SIM_NAO, soSe: HERNIA },
      { id: 'hernia_operou', rotulo: 'Já operou nesse local?', tipo: 'escolha', opcoes: SIM_NAO, soSe: HERNIA },
    ],
  },
  {
    titulo: 'Pedra na vesícula',
    perguntas: [
      { id: 'vesicula', rotulo: 'Marque o que acontece:', tipo: 'varias', opcoes: ['Foi vista em exame', 'Dor depois de comer', 'Dor que vai para as costas'], soSe: VESICULA },
      { id: 'vesicula_crises', rotulo: 'Onde dói, quanto dura e quantas vezes acontece', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: embaixo das costelas à direita, 2 horas, 1 vez por mês', soSe: VESICULA },
    ],
  },
  {
    titulo: 'Caroço ou lesão na pele',
    perguntas: [
      { id: 'pele_local', rotulo: 'Onde fica?', tipo: 'texto', placeholder: 'Ex.: costas', soSe: PELE },
      { id: 'pele_desde', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: há 1 ano', soSe: PELE },
      { id: 'pele', rotulo: 'Marque o que acontece:', tipo: 'varias', opcoes: ['Cresceu', 'Dói', 'Sai secreção', 'Sangra'], soSe: PELE },
      { id: 'pele_antes', rotulo: 'Já inflamou ou foi retirado no mesmo lugar?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: inflamou em 2023', soSe: PELE },
    ],
  },
  {
    titulo: 'Problema no ânus',
    perguntas: [
      {
        id: 'anus', rotulo: 'Tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor ao evacuar', 'Sangue nas fezes ou no papel', 'Caroço', 'Secreção', 'Coceira'], soSe: ANUS,
      },
      { id: 'anus_inicio', rotulo: 'Quando começou e como evoluiu?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: há 2 meses, piorando', soSe: ANUS },
    ],
  },
  {
    titulo: 'Retorno após cirurgia',
    perguntas: [
      { id: 'pos_cirurgia', rotulo: 'Qual cirurgia e quando?', tipo: 'texto', linhaToda: true, placeholder: 'Ex.: vesícula, 10/11', soSe: POS_OPERATORIO },
      {
        id: 'pos', rotulo: 'Tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Dor', 'Vermelhidão', 'Secreção', 'A ferida abriu', 'Dúvida sobre curativo, pontos ou dreno', 'Nada disso'],
        exclusiva: 'Nada disso', soSe: POS_OPERATORIO,
      },
      { id: 'pos_descricao', rotulo: 'Conte como está', tipo: 'texto', linhaToda: true, soSe: POS_OPERATORIO },
    ],
  },
  {
    titulo: 'Cirurgias e anestesia',
    perguntas: [
      { id: 'cirurgias', rotulo: 'Cirurgias e internações anteriores — quais, quando e se houve complicação', tipo: 'texto-longo', placeholder: 'Ex.: apêndice em 2010, sem complicação' },
      {
        id: 'anestesia', rotulo: 'Já teve problema com anestesia ou sangramento depois de um procedimento?', tipo: 'escolha',
        opcoes: ['Sim', 'Não', 'Não sei'], abreLinha: 'Sim', placeholder: 'Qual?', lembrete: 'Problema com anestesia ou sangramento',
      },
    ],
  },
  {
    titulo: 'Remédios',
    perguntas: [
      { id: 'medicamentos', rotulo: 'Remédios — nome, dose e quantas vezes ao dia', tipo: 'texto-longo', placeholder: 'Ex.: losartana 50 mg, 1 vez ao dia' },
      {
        id: 'em_uso', rotulo: 'Usa algum destes?', tipo: 'varias', duasColunas: true,
        opcoes: ['Remédio para afinar o sangue', 'AAS ou clopidogrel', 'Insulina', 'Injeção para diabetes ou para emagrecer', 'Corticoide', 'Nenhum desses'],
        exclusiva: 'Nenhum desses',
      },
    ],
  },
  {
    titulo: 'Saúde geral',
    perguntas: [
      {
        id: 'condicoes', rotulo: 'Marque o que tem:', tipo: 'varias', duasColunas: true,
        opcoes: ['Diabetes', 'Pressão alta', 'Doença do coração ou do pulmão', 'Já teve trombose', 'Outra', 'Nenhuma dessas'],
        exclusiva: 'Nenhuma dessas', abreLinha: 'Outra', placeholder: 'Qual?',
      },
      { ...ALERGIAS, placeholder: 'Qual e que reação causou' },
      { id: 'gravida', rotulo: 'Está grávida?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
      { id: 'amamentando', rotulo: 'Está amamentando?', tipo: 'escolha', opcoes: SIM_NAO, soParaSexo: 'F' },
    ],
  },
  {
    titulo: 'Exames',
    nota: AVISO_TRAZER,
    perguntas: [
      {
        id: 'exames', rotulo: 'Quais exames você tem?', tipo: 'varias', duasColunas: true,
        opcoes: ['Ultrassom', 'Tomografia', 'Exames de sangue', 'Endoscopia ou colonoscopia', 'Biópsia', 'Relatório da cirurgia', 'Não tenho exames'],
        exclusiva: 'Não tenho exames',
      },
      DOCUMENTOS,
    ],
  },
  ALGO_MAIS,
]

const PACOTES: Partial<Record<string, Parte[]>> = {
  dermatologia: DERMATOLOGIA, reumatologia: REUMATOLOGIA, cardiologia: CARDIOLOGIA, gastroenterologia: GASTROENTEROLOGIA,
  neurologia: NEUROLOGIA, endocrinologia: ENDOCRINOLOGIA, hematologia: HEMATOLOGIA, infectologia: INFECTOLOGIA,
  oncologia: ONCOLOGIA, nefrologia: NEFROLOGIA, ginecologia: GINECOLOGIA, urologia: UROLOGIA,
  geriatria: GERIATRIA, pediatria: PEDIATRIA, psiquiatria: PSIQUIATRIA, otorrinolaringologia: OTORRINOLARINGOLOGIA,
  pneumologia: PNEUMOLOGIA, hepatologia: HEPATOLOGIA, 'cirurgia-geral': CIRURGIA_GERAL,
}

/** Especialidades sem a parte "Estado civil e trabalho" (o paciente é criança; autor, 26/11/2026). */
const SEM_TRABALHO = new Set(['pediatria'])
export const temParteTrabalho = (partes: Parte[]) => !SEM_TRABALHO.has(especialidadeDasPartes(partes) ?? '')

export function partesPreConsulta(especialidade: string): Parte[] {
  return PACOTES[especialidade] ?? GERAIS
}

/** Pergunta do trabalho (parte "Estado civil e trabalho"): `sim`/`nao` = como entra no texto. */
export type PerguntaTrabalho = { rotulo: string; sim: string; nao: string }
const TRABALHO_PADRAO: PerguntaTrabalho = {
  rotulo: 'Trabalha ao ar livre, exposto ao sol ou a produtos químicos?',
  sim: 'trabalha exposto ao sol ou a produtos químicos', nao: 'não trabalha exposto ao sol nem a produtos químicos',
}
// Reumatologia: o que importa no trabalho é o esforço e o movimento repetitivo (autor, 24/11/2026)
const TRABALHO: Partial<Record<string, PerguntaTrabalho>> = {
  reumatologia: {
    rotulo: 'Seu trabalho exige esforço físico ou movimentos repetitivos?',
    sim: 'trabalha com esforço físico ou movimentos repetitivos', nao: 'não trabalha com esforço físico nem movimentos repetitivos',
  },
  // PROPOSTA do engenheiro (26/11/2026), aguardando o autor: sol/químicos não serve para coração nem barriga
  cardiologia: {
    rotulo: 'Seu trabalho exige esforço físico intenso ou é muito estressante?',
    sim: 'trabalha com esforço físico intenso ou muito estresse', nao: 'não trabalha com esforço físico intenso nem muito estresse',
  },
  gastroenterologia: {
    rotulo: 'Seu trabalho tem horários irregulares para comer ou é muito estressante?',
    sim: 'trabalha com horários irregulares para comer ou muito estresse', nao: 'não trabalha com horários irregulares para comer nem muito estresse',
  },
  neurologia: {
    rotulo: 'Seu trabalho exige dirigir, operar máquinas ou trabalhar em altura?',
    sim: 'trabalha dirigindo, operando máquinas ou em altura', nao: 'não trabalha dirigindo, operando máquinas nem em altura',
  },
  endocrinologia: {
    rotulo: 'Seu trabalho tem turnos, plantões ou horários irregulares para comer?',
    sim: 'trabalha em turnos, plantões ou com horários irregulares para comer', nao: 'não trabalha em turnos, plantões nem com horários irregulares para comer',
  },
  hematologia: {
    rotulo: 'Seu trabalho tem contato com solventes, agrotóxicos ou radiação?',
    sim: 'trabalha com solventes, agrotóxicos ou radiação', nao: 'não trabalha com solventes, agrotóxicos nem radiação',
  },
  infectologia: {
    rotulo: 'Seu trabalho tem contato com animais, sangue, pacientes ou área rural?',
    sim: 'trabalha com contato com animais, sangue, pacientes ou área rural', nao: 'não trabalha com contato com animais, sangue, pacientes nem área rural',
  },
  // oncologia: a pergunta padrão (sol ou produtos químicos) já serve
  nefrologia: {
    rotulo: 'Seu trabalho é pesado, no calor, ou com pouco acesso a água e banheiro?',
    sim: 'trabalha com esforço, no calor ou com pouco acesso a água e banheiro', nao: 'não trabalha com esforço, no calor nem com pouco acesso a água e banheiro',
  },
  ginecologia: {
    rotulo: 'Seu trabalho exige carregar peso ou ficar muito tempo em pé?',
    sim: 'trabalha carregando peso ou muito tempo em pé', nao: 'não trabalha carregando peso nem muito tempo em pé',
  },
  urologia: {
    rotulo: 'Seu trabalho tem contato com tintas, borracha ou outros produtos químicos?',
    sim: 'trabalha com tintas, borracha ou outros produtos químicos', nao: 'não trabalha com tintas, borracha nem outros produtos químicos',
  },
  // pessoa idosa: o que importa é se ainda trabalha ou cuida de alguém (sobrecarga, rotina)
  geriatria: {
    rotulo: 'Ainda trabalha ou cuida de alguém da família?',
    sim: 'ainda trabalha ou cuida de alguém da família', nao: 'não trabalha nem cuida de alguém da família',
  },
  psiquiatria: {
    rotulo: 'Seu trabalho tem plantões, turnos à noite ou muita pressão?',
    sim: 'trabalha em plantões, turnos à noite ou sob muita pressão', nao: 'não trabalha em plantões, turnos à noite nem sob muita pressão',
  },
  otorrinolaringologia: {
    rotulo: 'Seu trabalho tem barulho forte ou exige usar muito a voz?',
    sim: 'trabalha com barulho forte ou usando muito a voz', nao: 'não trabalha com barulho forte nem usando muito a voz',
  },
  pneumologia: {
    rotulo: 'Seu trabalho tem poeira, fumaça, vapores ou produtos químicos?',
    sim: 'trabalha com poeira, fumaça, vapores ou produtos químicos', nao: 'não trabalha com poeira, fumaça, vapores nem produtos químicos',
  },
  hepatologia: {
    rotulo: 'Seu trabalho tem contato com sangue, solventes ou produtos químicos?',
    sim: 'trabalha com contato com sangue, solventes ou produtos químicos', nao: 'não trabalha com sangue, solventes nem produtos químicos',
  },
  // hérnia e volta ao trabalho depois da cirurgia: o que importa é a força
  'cirurgia-geral': {
    rotulo: 'Seu trabalho exige carregar peso ou fazer muita força?',
    sim: 'trabalha carregando peso ou fazendo muita força', nao: 'não trabalha carregando peso nem fazendo muita força',
  },
}
/** As partes de cada especialidade são sempre o mesmo objeto: dá para saber de qual especialidade são. */
const ESPECIALIDADE_DAS_PARTES = new Map(Object.entries(PACOTES).map(([esp, partes]) => [partes, esp]))
export const especialidadeDasPartes = (partes: Parte[]) => ESPECIALIDADE_DAS_PARTES.get(partes)
export const perguntaTrabalho = (partes: Parte[]): PerguntaTrabalho => TRABALHO[especialidadeDasPartes(partes) ?? ''] ?? TRABALHO_PADRAO

/** A pergunta aparece para este paciente: sexo certo e, se depende de outra resposta, essa opção marcada
 *  (ou ela mesma já respondida: o que foi dito nunca some). */
export function perguntaVisivel(q: Pergunta, sexo: DadosPessoais['sexo'], respostas: RespostasPreConsulta): boolean {
  if (q.soParaSexo && q.soParaSexo !== sexo) return false
  if (!q.soSe) return true
  const v = respostas[q.soSe.pergunta]
  const opcoes: readonly string[] = typeof q.soSe.opcao === 'string' ? [q.soSe.opcao] : q.soSe.opcao
  const marcou = Array.isArray(v) ? v.some((o) => opcoes.includes(o)) : opcoes.includes(v ?? '')
  const r = respostas[q.id]
  return marcou || (Array.isArray(r) ? r.length > 0 : !!r?.trim())
}

/** Marca ou desmarca uma opção de 'varias'; a opção exclusiva não convive com as outras. */
export function alternarOpcao(marcadas: readonly string[], opcao: string, exclusiva?: string): string[] {
  if (marcadas.includes(opcao)) return marcadas.filter((o) => o !== opcao)
  if (opcao === exclusiva) return [opcao]
  return [...marcadas.filter((o) => o !== exclusiva), opcao]
}
