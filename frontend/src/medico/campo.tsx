import { useId, type ReactNode } from 'react'
import type { PropsCampo } from './estilos'

/** Rótulo + campo + erro/ajuda, com os atributos de acessibilidade ligados. */
export function Campo({ rotulo, erro, ajuda, children }: { rotulo: string; erro?: string; ajuda?: string; children: (p: PropsCampo) => ReactNode }) {
  const id = useId()
  const descr = [erro && `${id}-erro`, ajuda && `${id}-ajuda`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">{rotulo}</label>
      {children({ id, 'aria-invalid': !!erro, 'aria-describedby': descr })}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="mt-1.5 text-[13px] text-apagado">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} role="alert" className="mt-1.5 text-[13.5px] text-alerta">{erro}</p>}
    </div>
  )
}
