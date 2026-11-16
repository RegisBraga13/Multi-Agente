// O que a página inicial mostra para um dia, calculado de uma vez a partir do mesmo "agora",
// para lista, "Próximo" e "Hoje" nunca discordarem (ex.: página aberta depois da meia-noite).
import { useEffect, useState } from 'react'
import { dataLocal } from '../medico/exemplo'
import { proximoPaciente } from './dia'
import { agendaDoDia } from './exemplo'
import type { Atendimento } from './tipos'

export type VistaDoDia = {
  hoje: string; ehHoje: boolean; lista: Atendimento[]; proximo: string | null; atendidos: number
  fichasProntas: number; semFicha: number
}

export function vistaDoDia(dia: string, agora: Date): VistaDoDia {
  const hoje = dataLocal(agora)
  const ehHoje = dia === hoje
  const lista = agendaDoDia(dia, agora)
  const fichasProntas = lista.filter((x) => x.ficha.situacao === 'pronta').length
  return {
    hoje, ehHoje, lista, proximo: proximoPaciente(lista, ehHoje), atendidos: lista.filter((x) => x.atendido).length,
    fichasProntas, semFicha: lista.length - fichasProntas,
  }
}

/** Hora atual, renovada a cada minuto (o "Próximo" e o "Atendido" avançam sozinhos). */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return agora
}
