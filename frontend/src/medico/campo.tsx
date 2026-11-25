import { useId, type ReactNode } from 'react'
import type { PropsCampo } from './estilos'

/** Rótulo + campo + erro/ajuda, com os atributos de acessibilidade ligados. */
/** `rotuloOculto`: o rótulo só para leitor de tela (o título da parte já é a pergunta). */
export function Campo({ rotulo, erro, ajuda, rotuloOculto, children }: { rotulo: string; erro?: string; ajuda?: string; rotuloOculto?: boolean; children: (p: PropsCampo) => ReactNode }) {
  const id = useId()
  const descr = [erro && `${id}-erro`, ajuda && `${id}-ajuda`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className={rotuloOculto ? 'sr-only' : 'mb-1.5 block text-[14px] font-semibold'}>{rotulo}</label>
      {children({ id, 'aria-invalid': !!erro, 'aria-describedby': descr })}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="mt-1.5 text-[13px] text-apagado">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} role="alert" className="mt-1.5 text-[13.5px] text-alerta">{erro}</p>}
    </div>
  )
}
