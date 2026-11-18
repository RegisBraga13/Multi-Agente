// Blocos do formulário do paciente: uma parte por tela. Só a Identificação é obrigatória.
import { perguntaVisivel, type Parte, type RespostasPreConsulta } from './pre-consulta'
import { validarDadosPessoais, type DadosPessoais } from './regras'

export type Bloco =
  | { id: 'identificacao' | 'trabalho'; titulo: string; obrigatorio: boolean }
  | { id: string; titulo: string; obrigatorio: false; parte: Parte }

export function blocosDoFormulario(partes: Parte[]): Bloco[] {
  return [
    { id: 'identificacao', titulo: 'Identificação', obrigatorio: true },
    { id: 'trabalho', titulo: 'Estado civil e trabalho', obrigatorio: false },
    ...partes.map((parte, i) => ({ id: `parte-${i}`, titulo: parte.titulo, obrigatorio: false as const, parte })),
  ]
}

type Estado = { dados: DadosPessoais; respostas: RespostasPreConsulta; fotos: string[]; hoje: Date }

const preenchida = (r: string | string[] | undefined) => (Array.isArray(r) ? r.length > 0 : !!r?.trim())

/** Para a revisão: o bloco tem alguma resposta (a Identificação, só quando válida). */
export function blocoRespondido(b: Bloco, { dados, respostas, fotos, hoje }: Estado): boolean {
  if ('parte' in b) {
    return b.parte.perguntas.some((q) => perguntaVisivel(q, dados.sexo) && (q.tipo === 'foto' ? fotos.includes(q.id) : preenchida(respostas[q.id])))
  }
  if (b.id === 'identificacao') return Object.keys(validarDadosPessoais(dados, hoje)).length === 0
  return !!(dados.estadoCivil || dados.profissao.trim() || dados.trabalhoExposto)
}
