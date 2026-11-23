// Onde o prontuário de cada paciente fica guardado no navegador (simulação, até o servidor).
export const CHAVE_PRONTUARIO = (pacienteId: string) => `especialista:prontuario:${pacienteId}`
export const PREFIXO_PRONTUARIO = CHAVE_PRONTUARIO('')

/** O paciente já tem alguma entrada salva (terminou uma consulta ou retorno)? */
export function temProntuarioSalvo(pacienteId: string): boolean {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE_PRONTUARIO(pacienteId)) ?? '[]')
    return Array.isArray(x) && x.length > 0
  } catch { return false }
}

/** Demonstração: apaga o prontuário do paciente para repetir o caso desde a primeira consulta. */
export function reiniciarPaciente(pacienteId: string): void {
  try { localStorage.removeItem(CHAVE_PRONTUARIO(pacienteId)) } catch { /* sem armazenamento: nada a apagar */ }
}
