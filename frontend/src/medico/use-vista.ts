import { useSyncExternalStore } from 'react'

/** Qual "página" da página do médico está à vista. Vem do endereço (#como-funciona, #duvidas, #agenda), para o botão Voltar funcionar. */
export type Vista = 'inicio' | 'como' | 'duvidas' | 'agenda'

const assinar = (avisar: () => void) => {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}

export function vistaDoEndereco(hash: string): Vista {
  return hash === '#como-funciona' ? 'como' : hash === '#duvidas' ? 'duvidas' : hash === '#agenda' ? 'agenda' : 'inicio'
}

export function useVista(): Vista {
  return vistaDoEndereco(useSyncExternalStore(assinar, () => window.location.hash))
}
