import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { criarServicoSupabase } from './servico'
import type { DadosCadastro } from './validacao'

const dados: DadosCadastro = {
  nome: ' Ana Souza ', email: ' ana@exemplo.com ', crm: '12.345-6', uf: 'sp',
  especialidade: 'cardiologia', senha: 'Senha!Forte123', aceite: true,
}

function clienteFalso(opts: { livre?: boolean | null; erroRpc?: boolean; signUp?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(
    opts.erroRpc ? { data: null, error: { message: 'x' } } : { data: opts.livre ?? true, error: null },
  )
  const signUp = vi.fn().mockResolvedValue(opts.signUp ?? { data: { user: { identities: [{}] } }, error: null })
  return { cliente: { rpc, auth: { signUp } } as unknown as SupabaseClient, rpc, signUp }
}

vi.stubGlobal('window', { location: { origin: 'https://exemplo.test' } })

describe('servico Supabase · criarConta', () => {
  it('normaliza CRM/UF e envia os dados em user_metadata', async () => {
    const { cliente, rpc, signUp } = clienteFalso({})
    const r = await criarServicoSupabase(cliente).criarConta(dados)
    expect(r).toEqual({ ok: true, especialidade: 'cardiologia' })
    expect(rpc).toHaveBeenCalledWith('crm_disponivel', { p_crm: '123456', p_uf: 'SP' })
    expect(signUp.mock.calls[0][0].options.data).toEqual({ nome: 'Ana Souza', crm: '123456', uf: 'SP', especialidade: 'cardiologia' })
    expect(signUp.mock.calls[0][0].email).toBe('ana@exemplo.com')
  })

  it('barra CRM já cadastrado antes de criar o usuário', async () => {
    const { cliente, signUp } = clienteFalso({ livre: false })
    expect(await criarServicoSupabase(cliente).criarConta(dados)).toEqual({ ok: false, motivo: 'crm_em_uso' })
    expect(signUp).not.toHaveBeenCalled()
  })

  it('falha na checagem do CRM não cria usuário', async () => {
    const { cliente, signUp } = clienteFalso({ erroRpc: true })
    expect(await criarServicoSupabase(cliente).criarConta(dados)).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(signUp).not.toHaveBeenCalled()
  })

  it('e-mail já cadastrado: por erro explícito ou por identities vazio', async () => {
    const a = clienteFalso({ signUp: { data: { user: null }, error: { code: 'user_already_exists', message: 'User already registered' } } })
    expect(await criarServicoSupabase(a.cliente).criarConta(dados)).toEqual({ ok: false, motivo: 'email_em_uso' })
    const b = clienteFalso({ signUp: { data: { user: { identities: [] } }, error: null } })
    expect(await criarServicoSupabase(b.cliente).criarConta(dados)).toEqual({ ok: false, motivo: 'email_em_uso' })
  })

  it('erro desconhecido do signUp vira indisponivel', async () => {
    const { cliente } = clienteFalso({ signUp: { data: { user: null }, error: { code: 'unexpected_failure', message: 'boom' } } })
    expect(await criarServicoSupabase(cliente).criarConta(dados)).toEqual({ ok: false, motivo: 'indisponivel' })
  })

  it('não é simulado; Google e complemento respondem indisponivel', async () => {
    const s = criarServicoSupabase(clienteFalso({}).cliente)
    expect(s.simulado).toBe(false)
    expect(await s.entrarComGoogle()).toEqual({ ok: false, motivo: 'indisponivel' })
    expect(await s.completarCadastro(dados)).toEqual({ ok: false, motivo: 'indisponivel' })
  })
})
