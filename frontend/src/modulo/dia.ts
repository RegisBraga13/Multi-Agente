// Regras da agenda do dia (página inicial do módulo). Datas sempre locais.
import { dataLocal } from '../medico/exemplo'
import type { Atendimento } from './tipos'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** 'YYYY-MM-DD' → Date local à meia-noite. */
export function paraData(data: string): Date {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function ordenarPorHorario(lista: Atendimento[]): Atendimento[] {
  return [...lista].sort((x, y) => x.inicio.localeCompare(y.inicio))
}

export function idade(nascimento: string, em: Date): number {
  const n = paraData(nascimento)
  let anos = em.getFullYear() - n.getFullYear()
  if (em.getMonth() < n.getMonth() || (em.getMonth() === n.getMonth() && em.getDate() < n.getDate())) anos--
  return anos
}

/** Id do primeiro paciente ainda não atendido (lista já em ordem de horário); só hoje. */
export function proximoPaciente(lista: Atendimento[], ehHoje: boolean): string | null {
  if (!ehHoje) return null
  return lista.find((x) => !x.atendido)?.id ?? null
}

export function dataPorExtenso(data: string): string {
  const d = paraData(data)
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}

export function somarDias(data: string, n: number): string {
  const d = paraData(data)
  d.setDate(d.getDate() + n)
  return dataLocal(d)
}
