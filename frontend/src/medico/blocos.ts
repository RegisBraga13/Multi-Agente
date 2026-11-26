// Blocos do formulário do paciente: uma parte por tela. Obrigatória: só a Identificação (alergias ficam em Saúde geral, opcional).
// O resto pode ser pulado.
import { perguntaVisivel, temParteTrabalho, type Parte, type RespostasPreConsulta } from './pre-consulta'
import { validarDadosPessoais, type DadosPessoais } from './regras'

export type Bloco =
  | { id: 'identificacao' | 'trabalho'; titulo: string; obrigatorio: boolean }
  | { id: string; titulo: string; obrigatorio: boolean; parte: Parte }

export function blocosDoFormulario(partes: Parte[]): Bloco[] {
  return [
    { id: 'identificacao', titulo: 'Identificação', obrigatorio: true },
    // Pediatria: o paciente é criança, sem estado civil nem trabalho (autor, 26/11/2026)
    ...(temParteTrabalho(partes) ? [{ id: 'trabalho' as const, titulo: 'Estado civil e trabalho', obrigatorio: false }] : []),
    ...partes.map((parte, i) => ({ id: `parte-${i}`, titulo: parte.titulo, obrigatorio: parte.perguntas.some((q) => q.obrigatoria), parte })),
  ]
}

/** Formulário dentro da anamnese: sem a Identificação (nome, nascimento, cidade). A anamnese só existe para montar a
 *  história clínica, que não leva dado pessoal (regra 9.1); idade e sexo já estão no topo da consulta. */
export const blocosDaAnamnese = (partes: Parte[]): Bloco[] =>
  blocosDoFormulario(partes).filter((b) => b.id !== 'identificacao').flatMap((b): Bloco[] => {
    // parte longa: uma tela para cada grupo de perguntas ("Onde dói 1/2", "Onde dói 2/2")
    if (!('parte' in b) || !b.parte.telasDoMedico) return [b]
    const telas = b.parte.telasDoMedico
    return telas.map((ids, i) => {
      const titulo = `${b.parte.titulo} ${i + 1}/${telas.length}`
      const parte: Parte = { ...b.parte, titulo, colunas: undefined, telasDoMedico: undefined, perguntas: b.parte.perguntas.filter((q) => ids.includes(q.id)) }
      return { ...b, id: `${b.id}-${i + 1}`, titulo, parte }
    })
  })

/** Some a parte cujas perguntas dependem todas de outra resposta e nenhuma se aplica (ex.: "Dor de cabeça" só para quem
 *  marcou dor de cabeça no motivo): sem tela vazia. As partes que vêm antes nunca mudam de lugar. */
export const blocosVisiveis = (blocos: Bloco[], sexo: DadosPessoais['sexo'], respostas: RespostasPreConsulta): Bloco[] =>
  blocos.filter((b) => !('parte' in b) || b.parte.perguntas.some((q) => perguntaVisivel(q, sexo, respostas)))

type Estado = { dados: DadosPessoais; respostas: RespostasPreConsulta; fotos: string[]; hoje: Date }

const preenchida = (r: string | string[] | undefined) => (Array.isArray(r) ? r.length > 0 : !!r?.trim())

/** Para a revisão: o bloco tem alguma resposta (a Identificação, só quando válida). */
export function blocoRespondido(b: Bloco, { dados, respostas, fotos, hoje }: Estado): boolean {
  if ('parte' in b) {
    return b.parte.perguntas.some((q) => perguntaVisivel(q, dados.sexo, respostas) && (q.tipo === 'foto' ? fotos.includes(q.id)
      : q.tipo === 'arquivos' ? fotos.some((f) => f.startsWith(`${q.id}_`)) : preenchida(respostas[q.id])))
  }
  if (b.id === 'identificacao') return Object.keys(validarDadosPessoais(dados, hoje)).length === 0
  return !!(dados.estadoCivil || dados.profissao.trim() || dados.trabalhoExposto)
}

/** Perguntas obrigatórias do bloco ainda sem resposta (a Identificação tem a sua própria validação). */
export function faltaResponder(b: Bloco, { dados, respostas }: Estado): string[] {
  if (!('parte' in b)) return []
  return b.parte.perguntas.filter((q) => q.obrigatoria && perguntaVisivel(q, dados.sexo, respostas) && !preenchida(respostas[q.id])).map((q) => q.id)
}
