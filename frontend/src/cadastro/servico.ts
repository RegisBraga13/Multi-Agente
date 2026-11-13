import type { DadosCadastro, DadosComplemento } from './validacao'

export type ResultadoCadastro =
  | { ok: true; especialidade: string }
  | { ok: false; motivo: 'email_em_uso' | 'crm_em_uso' | 'indisponivel' }

export type ResultadoGoogle =
  | { ok: true; nome: string; email: string }
  | { ok: false; motivo: 'cancelado' | 'indisponivel' }

/** Interface própria: a tela não conhece o provedor (Supabase entra aqui depois). */
export interface ServicoCadastro {
  readonly simulado: boolean
  criarConta(dados: DadosCadastro): Promise<ResultadoCadastro>
  /** Login com Google; o CRM e a especialidade vêm depois, em completarCadastro. */
  entrarComGoogle(): Promise<ResultadoGoogle>
  completarCadastro(dados: DadosComplemento): Promise<ResultadoCadastro>
}

const espera = () => new Promise((r) => setTimeout(r, 600))

/**
 * Simulado: não grava nada nem envia dados para lugar nenhum.
 * Existe só até o projeto Supabase ser criado (cadastro, Google, CRM e teste grátis).
 */
export const servicoSimulado: ServicoCadastro = {
  simulado: true,
  async criarConta(dados) {
    await espera()
    return { ok: true, especialidade: dados.especialidade }
  },
  async entrarComGoogle() {
    await espera()
    return { ok: true, nome: 'Médica de Teste', email: 'medica.teste@exemplo.com' }
  },
  async completarCadastro(dados) {
    await espera()
    return { ok: true, especialidade: dados.especialidade }
  },
}

export const servicoCadastro: ServicoCadastro = servicoSimulado
