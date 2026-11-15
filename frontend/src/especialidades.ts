// Catálogo das especialidades: usado na escolha do módulo ao testar ou contratar.

export type Especialidade = {
  slug: string
  nome: string
  /** como se chama quem exerce: Dermatologista, Geriatra */
  profissional: string
  /** parte do nome antes do "IA" final: geriatr + IA */
  raiz: string
  cor: string
  status: 'disponivel' | 'em-breve'
}

export const ESPECIALIDADES: Especialidade[] = [
  { slug: 'geriatria', nome: 'Geriatria', profissional: 'Geriatra', raiz: 'geriatr', cor: '#0E7C7B', status: 'disponivel' },
  { slug: 'reumatologia', nome: 'Reumatologia', profissional: 'Reumatologista', raiz: 'reumatolog', cor: '#3F7352', status: 'disponivel' },
  { slug: 'dermatologia', nome: 'Dermatologia', profissional: 'Dermatologista', raiz: 'dermatolog', cor: '#A85A2E', status: 'disponivel' },
  { slug: 'cardiologia', nome: 'Cardiologia', profissional: 'Cardiologista', raiz: 'cardiolog', cor: '#8E3B5C', status: 'disponivel' },
  { slug: 'psiquiatria', nome: 'Psiquiatria', profissional: 'Psiquiatra', raiz: 'psiquiatr', cor: '#5B4FA0', status: 'disponivel' },
  { slug: 'neurologia', nome: 'Neurologia', profissional: 'Neurologista', raiz: 'neurolog', cor: '#2F5D9E', status: 'em-breve' },
  { slug: 'endocrinologia', nome: 'Endocrinologia', profissional: 'Endocrinologista', raiz: 'endocrinolog', cor: '#B07A1F', status: 'em-breve' },
  { slug: 'ortopedia', nome: 'Ortopedia', profissional: 'Ortopedista', raiz: 'ortoped', cor: '#4F6B7A', status: 'em-breve' },
  { slug: 'pediatria', nome: 'Pediatria', profissional: 'Pediatra', raiz: 'pediatr', cor: '#B0485F', status: 'em-breve' },
  { slug: 'ginecologia', nome: 'Ginecologia', profissional: 'Ginecologista', raiz: 'ginecolog', cor: '#8A4F9E', status: 'em-breve' },
]

export function buscarEspecialidade(slug: string | null | undefined): Especialidade | undefined {
  return ESPECIALIDADES.find((e) => e.slug === slug)
}
