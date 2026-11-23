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
  // sem ninguém a seguir, a consulta de demonstração (sempre disponível) ainda abre; o retorno tem o seu cartão
  return (lista.find((x) => !x.atendido && !x.sempreDisponivel) ?? lista.find((x) => !x.atendido && x.tipo === 'consulta'))?.id ?? null
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

export function saudacao(agora: Date): string {
  const h = agora.getHours()
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
}

/** Lista do cartão "Hoje": atendidos viram contagem; mostra até `max` a partir do próximo. */
export function janelaDeHoje(lista: Atendimento[], max: number): { atendidos: number; visiveis: Atendimento[]; restantes: number } {
  const aSeguir = lista.filter((x) => !x.atendido)
  return { atendidos: lista.length - aSeguir.length, visiveis: aSeguir.slice(0, max), restantes: Math.max(0, aSeguir.length - max) }
}

/** "Página" do módulo à vista, pelo endereço (#agenda), para o Voltar do navegador funcionar. */
export type VistaModulo = 'inicio' | 'agenda'
export function vistaDoModulo(hash: string): VistaModulo {
  return hash === '#agenda' ? 'agenda' : 'inicio'
}
