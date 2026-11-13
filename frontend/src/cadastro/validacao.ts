import { buscarEspecialidade } from '../especialidades'

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const

export type DadosCadastro = {
  nome: string
  email: string
  crm: string
  uf: string
  especialidade: string
  senha: string
  aceite: boolean
}

export type Erros = Partial<Record<keyof DadosCadastro, string>>

export const SENHA_MINIMA = 10

/** 0 a 4: comprimento, maiúscula e minúscula, número, símbolo. */
export function forcaSenha(senha: string): number {
  if (!senha) return 0
  let pontos = 0
  if (senha.length >= SENHA_MINIMA) pontos++
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++
  if (/\d/.test(senha)) pontos++
  if (/[^A-Za-z0-9]/.test(senha)) pontos++
  return pontos
}

/** Remove espaços e pontos que o médico costuma digitar no CRM. */
export function limparCrm(crm: string): string {
  return crm.replace(/[\s.\-/]/g, '')
}

/** O que é pedido de todos, inclusive de quem entra com o Google. */
export type DadosComplemento = Pick<DadosCadastro, 'crm' | 'uf' | 'especialidade' | 'aceite'>

export function validarCadastro(d: DadosCadastro): Erros {
  const erros: Erros = {}
  const nome = d.nome.trim()
  if (nome.length < 3) erros.nome = 'Informe seu nome completo.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) erros.email = 'Informe um e-mail válido.'
  if (d.senha.length < SENHA_MINIMA) erros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  else if (forcaSenha(d.senha) < 3) erros.senha = 'Use letras maiúsculas e minúsculas, números ou símbolos.'
  return { ...erros, ...validarComplemento(d) }
}

export function validarComplemento(d: DadosComplemento): Erros {
  const erros: Erros = {}
  // mesma regra do banco: só dígitos, até 8
  if (!/^\d{1,8}$/.test(limparCrm(d.crm))) erros.crm = 'Informe o número do CRM (só números).'
  if (!(UFS as readonly string[]).includes(d.uf)) erros.uf = 'Escolha a UF do CRM.'
  const esp = buscarEspecialidade(d.especialidade)
  if (!esp) erros.especialidade = 'Escolha a especialidade.'
  else if (esp.status !== 'disponivel') erros.especialidade = 'Esta especialidade ainda não está disponível.'
  if (!d.aceite) erros.aceite = 'É preciso aceitar os termos para continuar.'
  return erros
}
