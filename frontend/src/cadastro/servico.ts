import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { limparCrm, type DadosCadastro, type DadosComplemento } from './validacao'

export type ResultadoCadastro =
  | { ok: true; especialidade: string }
  | { ok: false; motivo: 'email_em_uso' | 'crm_em_uso' | 'indisponivel' }

export type ResultadoGoogle =
  | { ok: true; nome: string; email: string }
  | { ok: false; motivo: 'cancelado' | 'indisponivel' }

/** Interface própria: a tela não conhece o provedor. */
export interface ServicoCadastro {
  readonly simulado: boolean
  criarConta(dados: DadosCadastro): Promise<ResultadoCadastro>
  /** Login com Google; o CRM e a especialidade vêm depois, em completarCadastro. */
  entrarComGoogle(): Promise<ResultadoGoogle>
  completarCadastro(dados: DadosComplemento): Promise<ResultadoCadastro>
}

const espera = () => new Promise((r) => setTimeout(r, 600))

/** Só para desenvolvimento sem Supabase configurado: não grava nada. */
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

/**
 * Supabase: auth.signUp leva os dados em user_metadata e o gatilho handle_new_user
 * (migração 0005) cria médico, pedido de CRM e teste grátis na mesma transação.
 * Google e complemento de cadastro ainda não existem (precisam do provedor OAuth
 * configurado no painel): respondem "indisponivel" de forma honesta.
 */
export function criarServicoSupabase(cliente: SupabaseClient): ServicoCadastro {
  return {
    simulado: false,
    async criarConta(dados) {
      const crm = limparCrm(dados.crm)
      const uf = dados.uf.toUpperCase()

      const { data: livre, error: erroCrm } = await cliente.rpc('crm_disponivel', { p_crm: crm, p_uf: uf })
      if (erroCrm) return { ok: false, motivo: 'indisponivel' }
      if (livre === false) return { ok: false, motivo: 'crm_em_uso' }

      const { data, error } = await cliente.auth.signUp({
        email: dados.email.trim(),
        password: dados.senha,
        options: {
          data: { nome: dados.nome.trim(), crm, uf, especialidade: dados.especialidade },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) {
        if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
          return { ok: false, motivo: 'email_em_uso' }
        }
        return { ok: false, motivo: 'indisponivel' }
      }
      // Com confirmação de e-mail ligada, e-mail já cadastrado volta sem erro e sem identities.
      if (data.user && data.user.identities?.length === 0) return { ok: false, motivo: 'email_em_uso' }
      return { ok: true, especialidade: dados.especialidade }
    },
    async entrarComGoogle() {
      return { ok: false, motivo: 'indisponivel' }
    },
    async completarCadastro() {
      return { ok: false, motivo: 'indisponivel' }
    },
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const servicoCadastro: ServicoCadastro =
  url && chave ? criarServicoSupabase(createClient(url, chave)) : servicoSimulado
