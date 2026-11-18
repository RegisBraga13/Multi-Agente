// Tipos da página inicial do módulo. Já no formato da futura tabela `appointments`,
// para a ligação ao Supabase não exigir refazer a tela.
import type { EstadoCivil } from '../medico/regras'
import type { Modalidade } from '../medico/tipos'

export type TipoAtendimento = 'consulta' | 'retorno'

/** Ficha da pré-consulta enviada pelo paciente (página do médico). Só a "pronta" tem conteúdo. */
export type Ficha =
  | {
      situacao: 'pronta'
      /** 'HH:MM' em que chegou */
      recebidaAs: string
      /** da identificação do formulário (sexo é obrigatório; estado civil e profissão, opcionais: '' = não respondeu) */
      sexo: 'F' | 'M' | 'outro'
      estadoCivil: EstadoCivil | ''
      profissao: string
      queixa: string
      emUso: string[]
      antecedentes: string[]
      alergias: { substancia: string; reacao: string }[]
      /** consentimento da transcrição da consulta */
      transcricao: 'aceita' | 'recusada'
    }
  | { situacao: 'link-enviado' }
  | { situacao: 'sem-ficha' }

export type Atendimento = {
  id: string
  /** 'HH:MM' */
  inicio: string
  /** `id`: identificador do paciente (criado pelo sistema, nunca muda) */
  paciente: { id: string; nome: string; /** 'YYYY-MM-DD' */ nascimento: string }
  tipo: TipoAtendimento
  modalidade: Modalidade
  /** 'Particular' ou o nome do convênio */
  pagamento: string
  ficha: Ficha
  atendido: boolean
  /** já tem prontuário: mostra o link "Prontuário" na ficha */
  temHistorico: boolean
}
