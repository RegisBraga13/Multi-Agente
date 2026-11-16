import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/** Caixa de texto que começa com a altura de uma linha e cresce conforme o paciente escreve. */
export function TextoCrescente({ value, className, ...resto }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // + borda, para não aparecer barra de rolagem
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`
  }, [value])
  return <textarea ref={ref} rows={1} value={value} className={`resize-none overflow-hidden ${className ?? ''}`} {...resto} />
}
