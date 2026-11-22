// Junta o que vem do servidor com o que ainda é local (exemplos e retornos simulados). Funções puras.
import type { EntradaProntuario, PacienteComProntuario } from './registro'

const ordem = (a: { data: string; hora: string }) => `${a.data} ${a.hora}`

/** Entradas locais + do servidor, sem repetir o mesmo `id` (a do servidor vence), mais recente no topo. */
export function juntarEntradas(locais: EntradaProntuario[], servidor: EntradaProntuario[]): EntradaProntuario[] {
  const ids = new Set(servidor.map((e) => e.id))
  return [...servidor, ...locais.filter((e) => !ids.has(e.id))].sort((a, b) => ordem(b).localeCompare(ordem(a)))
}

/** Paciente nos dois lados: soma as entradas, fica a data mais recente e o nome do servidor. */
export function juntarPacientes(locais: PacienteComProntuario[], servidor: PacienteComProntuario[]): PacienteComProntuario[] {
  const todos = new Map<string, PacienteComProntuario>(locais.map((p) => [p.id, p]))
  for (const s of servidor) {
    const l = todos.get(s.id)
    todos.set(s.id, l ? { ...s, entradas: l.entradas + s.entradas, ultima: l.ultima > s.ultima ? l.ultima : s.ultima } : s)
  }
  return [...todos.values()].sort((a, b) => b.ultima.localeCompare(a.ultima) || a.nome.localeCompare(b.nome))
}

/** O adendo só vale com texto escrito (espaços não contam). */
export const adendoValido = (texto: string) => texto.trim().length > 0
