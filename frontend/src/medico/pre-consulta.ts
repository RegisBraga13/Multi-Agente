// Perguntas da pré-consulta: parte do "pacote" de cada especialidade.
// O formulário é o mesmo para todas; só a lista de perguntas muda.
// Especialidade sem pacote próprio usa as perguntas gerais.
// Quando o médico puder editar as próprias perguntas (tela CF-04), isto passa para o banco.

export type TipoPergunta = 'texto' | 'texto-longo' | 'foto'

export type Pergunta = {
  /** chave da resposta; estável, para o banco */
  id: string
  rotulo: string
  tipo: TipoPergunta
  placeholder?: string
  ajuda?: string
}

/** Respostas da pré-consulta, pela chave de cada pergunta (a foto vai à parte). */
export type RespostasPreConsulta = Record<string, string>

const QUEIXA: Pergunta = { id: 'queixa', rotulo: 'O que trouxe você à consulta?', tipo: 'texto-longo' }
const DESDE: Pergunta = { id: 'desde_quando', rotulo: 'Desde quando?', tipo: 'texto', placeholder: 'Ex.: uns três meses' }
const ALERGIAS: Pergunta = {
  id: 'alergias', rotulo: 'Alergia a algum medicamento?', tipo: 'texto',
  placeholder: 'Ex.: dipirona. Se não tiver, escreva “não”.',
}

const GERAIS: Pergunta[] = [
  QUEIXA,
  DESDE,
  { id: 'medicamentos', rotulo: 'Medicamentos que usa ou já usou', tipo: 'texto-longo' },
  ALERGIAS,
]

const PACOTES: Partial<Record<string, Pergunta[]>> = {
  dermatologia: [
    QUEIXA,
    DESDE,
    { id: 'medicamentos', rotulo: 'Medicamentos e cremes que usa ou já usou', tipo: 'texto-longo' },
    ALERGIAS,
    { id: 'foto_lesao', rotulo: 'Foto da lesão (opcional)', tipo: 'foto', ajuda: 'Uma foto com boa luz ajuda. Até 10 MB.' },
  ],
}

export function perguntasPreConsulta(especialidade: string): Pergunta[] {
  return PACOTES[especialidade] ?? GERAIS
}
