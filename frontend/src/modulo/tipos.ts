// Tipos da página inicial do módulo. Já no formato da futura tabela `appointments`,
// para a ligação ao Supabase não exigir refazer a tela.
import type { Modalidade } from '../medico/tipos'

export type TipoAtendimento = 'consulta' | 'retorno'

export type Atendimento = {
  id: string
  /** 'HH:MM' */
  inicio: string
  paciente: { nome: string; /** 'YYYY-MM-DD' */ nascimento: string }
  tipo: TipoAtendimento
  modalidade: Modalidade
  /** formulário da consulta enviado pelo paciente (página do médico) */
  formulario: 'preenchido' | 'pendente'
  atendido: boolean
  /** já tem prontuário: mostra o link "Prontuário" */
  temHistorico: boolean
}
