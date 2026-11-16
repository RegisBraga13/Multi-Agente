// "A IA escreve ao vivo", no ritmo da landing (index.html, iniciaHist): 3 caracteres a cada 33 ms.
// Usado na história e nos diagnósticos. Escreve uma fila de textos, um depois do outro.
import { useEffect, useRef, useState } from 'react'

const LETRAS_POR_PASSO = 3
const MS_POR_PASSO = 33

/**
 * `textos`: a fila (fixa durante a escrita). `animar` falso (versão já escrita antes, ou movimento reduzido) = tudo pronto.
 * Devolve k = item sendo escrito (k = textos.length → terminou) e n = letras já escritas dele.
 */
export function useEscrita(textos: string[], animar: boolean, onFim?: () => void) {
  const reduz = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [pos, setPos] = useState(() => ({ k: animar && !reduz ? 0 : textos.length, n: 0 }))
  const escrevendo = pos.k < textos.length
  const fim = useRef(onFim)
  useEffect(() => { fim.current = onFim })

  useEffect(() => {
    if (!escrevendo) return
    const t = setTimeout(() => {
      setPos(({ k, n }) => (n + LETRAS_POR_PASSO >= textos[k].length ? { k: k + 1, n: 0 } : { k, n: n + LETRAS_POR_PASSO }))
    }, MS_POR_PASSO)
    return () => clearTimeout(t)
  }, [pos, escrevendo, textos])

  useEffect(() => { if (!escrevendo) fim.current?.() }, [escrevendo])

  return { k: pos.k, n: pos.n, escrevendo }
}
