// Peças visuais comuns às páginas da consulta.
import { useEffect, useRef, type ReactNode } from 'react'
import { nomeSituacao } from './etapas'
import type { Situacao } from './tipos'

export const ROTULO = 'text-[11px] font-bold tracking-[0.14em] text-apagado uppercase'

/** Etiqueta da situação: cheia = oficializado; tracejada = pendente; alerta = desatualizado. */
export function EtiquetaSituacao({ s }: { s: Situacao }) {
  const estilo =
    s === 'oficializado' ? 'border-petroleo bg-petroleo text-papel'
    : s === 'desatualizado' ? 'border-alerta-clinico text-alerta-clinico'
    : s === 'revisado_medico' ? 'border-tinta text-tinta'
    : 'border-dashed border-(--esp-medio) text-apagado'
  return <span className={`shrink-0 border-[1.5px] px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${estilo}`}>{s === 'oficializado' ? '✓ ' : ''}{nomeSituacao(s)}</span>
}

/** Cartão branco de um bloco: título + etiqueta em cima, conteúdo, rodapé com a ação. */
export function Cartao({ titulo, situacao, extra, rodape, children }: { titulo: string; situacao?: Situacao; extra?: ReactNode; rodape?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col border border-linha bg-branco" aria-label={titulo}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-linha px-5 py-2">
        <h2 className="text-[21px] font-semibold">{titulo}</h2>
        {situacao && <EtiquetaSituacao s={situacao} />}
        <div className="ml-auto">{extra}</div>
      </div>
      <div className="flex-1 px-5 py-3">{children}</div>
      {rodape && <div className="flex items-center justify-end gap-3 border-t border-linha px-5 py-2.5">{rodape}</div>}
    </section>
  )
}

/** Botão de oficializar: só o médico oficializa; bloqueado mostra o motivo. */
export function BotaoOficializar({ rotulo, oficializado, motivo, onClick }: { rotulo: string; oficializado: boolean; motivo?: string; onClick: () => void }) {
  if (oficializado) return <span className="text-[14px] font-semibold text-petroleo">✓ Oficializado</span>
  return (
    <>
      {motivo && <span className="text-[13.5px] text-apagado">{motivo}</span>}
      <button type="button" disabled={!!motivo} onClick={onClick} className="bg-(--esp) px-4 py-2 text-[15px] font-bold text-papel transition enabled:hover:-translate-y-0.5 disabled:opacity-40">
        {rotulo}
      </button>
    </>
  )
}

/** Painel que abre por cima da página (sem sair dela). Fecha com ×, Esc ou clique fora. */
export function Gaveta({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onFechar])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-tinta/30" onClick={onFechar}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[440px] flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px] outline-none">
        <div className="flex items-center justify-between border-b border-linha px-5 py-3">
          <h2 className="text-[22px] font-semibold">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="px-2 text-[24px] leading-none text-apagado hover:text-tinta">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
