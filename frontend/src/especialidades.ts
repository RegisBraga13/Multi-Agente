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
  /** cor parecida com o vermelho da alergia: alergia em fundo branco (ver alergia.ts) */
  alergiaContornada?: boolean
}

export const ESPECIALIDADES: Especialidade[] = [
  { slug: 'geriatria', nome: 'Geriatria', profissional: 'Geriatra', raiz: 'geriatr', cor: '#0E7C7B', status: 'disponivel' },
  { slug: 'reumatologia', nome: 'Reumatologia', profissional: 'Reumatologista', raiz: 'reumatolog', cor: '#3F7352', status: 'disponivel' },
  { slug: 'dermatologia', nome: 'Dermatologia', profissional: 'Dermatologista', raiz: 'dermatolog', cor: '#A85A2E', status: 'disponivel', alergiaContornada: true },
  { slug: 'cardiologia', nome: 'Cardiologia', profissional: 'Cardiologista', raiz: 'cardiolog', cor: '#8E3B5C', status: 'disponivel', alergiaContornada: true },
  { slug: 'gastroenterologia', nome: 'Gastroenterologia', profissional: 'Gastroenterologista', raiz: 'gastroenterolog', cor: '#6F6A2A', status: 'disponivel' },
  { slug: 'hematologia', nome: 'Hematologia', profissional: 'Hematologista', raiz: 'hematolog', cor: '#A3283C', status: 'disponivel', alergiaContornada: true },
  { slug: 'infectologia', nome: 'Infectologia', profissional: 'Infectologista', raiz: 'infectolog', cor: '#4E7A2A', status: 'disponivel' },
  { slug: 'oncologia', nome: 'Oncologia', profissional: 'Oncologista', raiz: 'oncolog', cor: '#5C4033', status: 'disponivel' },
  { slug: 'nefrologia', nome: 'Nefrologia', profissional: 'Nefrologista', raiz: 'nefrolog', cor: '#1F6F8B', status: 'disponivel' },
  { slug: 'urologia', nome: 'Urologia', profissional: 'Urologista', raiz: 'urolog', cor: '#3E5C8A', status: 'disponivel' },
  { slug: 'psiquiatria', nome: 'Psiquiatria', profissional: 'Psiquiatra', raiz: 'psiquiatr', cor: '#5B4FA0', status: 'disponivel' },
  { slug: 'neurologia', nome: 'Neurologia', profissional: 'Neurologista', raiz: 'neurolog', cor: '#2F5D9E', status: 'disponivel' },
  { slug: 'endocrinologia', nome: 'Endocrinologia', profissional: 'Endocrinologista', raiz: 'endocrinolog', cor: '#B07A1F', status: 'disponivel' },
  { slug: 'ortopedia', nome: 'Ortopedia', profissional: 'Ortopedista', raiz: 'ortoped', cor: '#4F6B7A', status: 'em-breve' },
  { slug: 'pediatria', nome: 'Pediatria', profissional: 'Pediatra', raiz: 'pediatr', cor: '#B0485F', status: 'disponivel', alergiaContornada: true },
  { slug: 'otorrinolaringologia', nome: 'Otorrinolaringologia', profissional: 'Otorrinolaringologista', raiz: 'otorrinolaringolog', cor: '#8A5A44', status: 'disponivel' },
  { slug: 'pneumologia', nome: 'Pneumologia', profissional: 'Pneumologista', raiz: 'pneumolog', cor: '#2D6A7A', status: 'disponivel' },
  { slug: 'cirurgia-geral', nome: 'Cirurgia Geral', profissional: 'Cirurgião geral', raiz: 'cirurg', cor: '#3B4A63', status: 'disponivel' },
  { slug: 'hepatologia', nome: 'Hepatologia', profissional: 'Hepatologista', raiz: 'hepatolog', cor: '#7A3E2B', status: 'disponivel' },
  { slug: 'ginecologia', nome: 'Ginecologia', profissional: 'Ginecologista', raiz: 'ginecolog', cor: '#8A4F9E', status: 'disponivel' },
]

export function buscarEspecialidade(slug: string | null | undefined): Especialidade | undefined {
  return ESPECIALIDADES.find((e) => e.slug === slug)
}
