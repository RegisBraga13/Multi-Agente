import { useSyncExternalStore } from 'react'

// Abaixo de 768 px (md do Tailwind) o painel do agendamento ocupa a tela inteira.
const CONSULTA = '(max-width: 767px)'

export function useTelaPequena(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    () => window.matchMedia(CONSULTA).matches,
  )
}
