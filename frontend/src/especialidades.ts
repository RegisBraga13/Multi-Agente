// Catálogo das especialidades: usado na escolha do módulo ao testar ou contratar.

export type Especialidade = {
  slug: string
  nome: string
  /** parte do nome antes do "IA" final: geriatr + IA */
  raiz: string
  cor: string
  status: 'disponivel' | 'em-breve'
}

export const ESPECIALIDADES: Especialidade[] = [
  { slug: 'geriatria', nome: 'Geriatria', raiz: 'geriatr', cor: '#0E7C7B', status: 'disponivel' },
  { slug: 'reumatologia', nome: 'Reumatologia', raiz: 'reumatolog', cor: '#3F7352', status: 'disponivel' },
  { slug: 'dermatologia', nome: 'Dermatologia', raiz: 'dermatolog', cor: '#A85A2E', status: 'disponivel' },
  { slug: 'cardiologia', nome: 'Cardiologia', raiz: 'cardiolog', cor: '#8E3B5C', status: 'disponivel' },
  { slug: 'psiquiatria', nome: 'Psiquiatria', raiz: 'psiquiatr', cor: '#5B4FA0', status: 'disponivel' },
  { slug: 'neurologia', nome: 'Neurologia', raiz: 'neurolog', cor: '#2F5D9E', status: 'em-breve' },
  { slug: 'endocrinologia', nome: 'Endocrinologia', raiz: 'endocrinolog', cor: '#B07A1F', status: 'em-breve' },
  { slug: 'ortopedia', nome: 'Ortopedia', raiz: 'ortoped', cor: '#4F6B7A', status: 'em-breve' },
  { slug: 'pediatria', nome: 'Pediatria', raiz: 'pediatr', cor: '#B0485F', status: 'em-breve' },
  { slug: 'ginecologia', nome: 'Ginecologia', raiz: 'ginecolog', cor: '#8A4F9E', status: 'em-breve' },
]

export function buscarEspecialidade(slug: string | null | undefined): Especialidade | undefined {
  return ESPECIALIDADES.find((e) => e.slug === slug)
}
