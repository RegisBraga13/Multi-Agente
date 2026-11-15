// Perguntas da pré-consulta: parte do "pacote" de cada especialidade.
// O formulário é o mesmo para todas; só as partes e as perguntas mudam.
// Especialidade sem pacote próprio usa as perguntas gerais.
// Quando o médico puder editar o próprio modelo (tela CF-04), isto passa para o banco.
import type { DadosPessoais } from './regras'

export type TipoPergunta = 'texto' | 'texto-longo' | 'escolha' | 'varias' | 'foto'

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
}

export type Parte = { titulo: string; perguntas: Pergunta[]; nota?: string }

/** Respostas da pré-consulta, pela chave de cada pergunta (as fotos vão à parte). */
export type RespostasPreConsulta = Record<string, string | string[]>

const QUEIXA: Pergunta = { id: 'queixa', rotulo: 'O que trouxe você à consulta?', tipo: 'texto-longo' }
const DESDE: Pergunta = { id: 'desde_quando', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: uns três meses' }
const ALERGIAS: Pergunta = {
  id: 'alergias', rotulo: 'Alergias', tipo: 'texto',
  placeholder: 'Ex.: dipirona, níquel. Se não tiver, escreva “não”.',
}
const SIM_NAO = ['Sim', 'Não'] as const

const GERAIS: Parte[] = [
  { titulo: 'Queixa principal', perguntas: [QUEIXA, DESDE] },
  {
    titulo: 'Saúde geral',
    perguntas: [{ id: 'medicamentos', rotulo: 'Medicamentos que usa ou já usou', tipo: 'texto-longo' }, ALERGIAS],
  },
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
    ],
  },
  {
    titulo: 'Fototipo e exposição ao sol',
    perguntas: [
      { id: 'cor_pele', rotulo: 'Cor da pele', tipo: 'escolha', opcoes: ['Muito clara', 'Clara', 'Morena clara', 'Morena', 'Morena escura', 'Negra'] },
      { id: 'cor_olhos', rotulo: 'Cor dos olhos', tipo: 'escolha', opcoes: ['Azuis ou verdes', 'Castanho-claros', 'Castanho-escuros ou pretos'] },
      { id: 'cor_cabelo', rotulo: 'Cor natural do cabelo', tipo: 'escolha', opcoes: ['Ruivo', 'Loiro', 'Castanho', 'Preto'] },
      {
        id: 'reacao_sol', rotulo: 'No sol, sua pele costuma:', tipo: 'escolha',
        opcoes: [
          'Sempre queimar e nunca bronzear',
          'Queimar fácil e bronzear pouco',
          'Queimar às vezes e bronzear aos poucos',
          'Raramente queimar e bronzear fácil',
          'Nunca queimar',
        ],
      },
      { id: 'protetor', rotulo: 'Usa protetor solar?', tipo: 'escolha', opcoes: ['Todo dia', 'Às vezes', 'Raramente', 'Nunca'] },
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
      { id: 'doencas', rotulo: 'Doenças crônicas', tipo: 'texto', placeholder: 'Ex.: diabetes, pressão alta, tireoide' },
      { id: 'medicamentos', rotulo: 'Medicamentos em uso, incluindo hormônios e corticoides', tipo: 'texto-longo', placeholder: 'Inclua pomadas e cremes' },
      ALERGIAS,
      { id: 'gestacao', rotulo: 'Está grávida ou amamentando?', tipo: 'escolha', opcoes: ['Não', 'Grávida', 'Amamentando'], soParaSexo: 'F' },
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
    titulo: 'Fotos',
    nota: 'A foto ajuda a acompanhar a evolução, e o exame presencial continua necessário.',
    perguntas: [
      { id: 'foto_perto', rotulo: 'Foto de perto', tipo: 'foto', ajuda: 'Com boa luz. Até 10 MB.' },
      { id: 'foto_longe', rotulo: 'Foto de longe', tipo: 'foto', ajuda: 'Mostrando onde fica a lesão no corpo. Até 10 MB.' },
    ],
  },
]

const PACOTES: Partial<Record<string, Parte[]>> = { dermatologia: DERMATOLOGIA }

export function partesPreConsulta(especialidade: string): Parte[] {
  return PACOTES[especialidade] ?? GERAIS
}

export function perguntaVisivel(q: Pergunta, sexo: DadosPessoais['sexo']): boolean {
  return !q.soParaSexo || q.soParaSexo === sexo
}

/** Marca ou desmarca uma opção de 'varias'; a opção exclusiva não convive com as outras. */
export function alternarOpcao(marcadas: readonly string[], opcao: string, exclusiva?: string): string[] {
  if (marcadas.includes(opcao)) return marcadas.filter((o) => o !== opcao)
  if (opcao === exclusiva) return [opcao]
  return [...marcadas.filter((o) => o !== exclusiva), opcao]
}
