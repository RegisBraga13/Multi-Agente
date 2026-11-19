// O que a página inicial mostra para um dia, calculado de uma vez a partir do mesmo "agora",
// para lista, "Próximo" e "Hoje" nunca discordarem (ex.: página aberta depois da meia-noite).
import { useEffect, useState } from 'react'
import { dataLocal } from '../medico/exemplo'
import { proximoPaciente } from './dia'
import type { PedidoNaAgenda } from '../servidor/agenda'
import { agendaDoDia } from './exemplo'
import { juntarPedidos } from './pedidos'
import type { Atendimento } from './tipos'

export type VistaDoDia = {
  hoje: string; ehHoje: boolean; lista: Atendimento[]; proximo: string | null; atendidos: number
  fichasProntas: number; semFicha: number
}

export function vistaDoDia(dia: string, agora: Date, pedidos: PedidoNaAgenda[] = []): VistaDoDia {
  const hoje = dataLocal(agora)
  const ehHoje = dia === hoje
  const lista = juntarPedidos(agendaDoDia(dia, agora), pedidos, dia, agora)
  // fichas de quem ainda vai ser atendido: o número muda a cada atendimento
  const aSeguir = lista.filter((x) => !x.atendido)
  const fichasProntas = aSeguir.filter((x) => x.ficha.situacao === 'pronta').length
  return {
    hoje, ehHoje, lista, proximo: proximoPaciente(lista, ehHoje), atendidos: lista.length - aSeguir.length,
    fichasProntas, semFicha: aSeguir.length - fichasProntas,
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
