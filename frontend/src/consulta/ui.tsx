// Peças visuais comuns às páginas da consulta.
import { useEffect, useRef, type ReactNode } from 'react'
import { nomeSituacao } from './etapas'
import type { Situacao } from './tipos'

export const ROTULO = 'text-[11px] font-bold tracking-[0.14em] text-apagado uppercase'

/** Etiqueta da situação: cheia = oficializado; tracejada = pendente ou desatualizado (vermelho só para alergia). */
export function EtiquetaSituacao({ s }: { s: Situacao }) {
  const estilo =
    s === 'oficializado' ? 'border-petroleo bg-petroleo text-papel'
    : s === 'desatualizado' ? 'border-dashed border-tinta font-bold text-tinta'
    : s === 'revisado_medico' ? 'border-tinta text-tinta'
    : 'border-dashed border-(--esp-medio) text-apagado'
  return <span className={`shrink-0 border-[1.5px] px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${estilo}`}>{s === 'oficializado' ? '✓ ' : ''}{nomeSituacao(s)}</span>
}

/** Cartão branco de um bloco: título + etiqueta em cima, conteúdo, rodapé com a ação. */
/** `legenda`: significado dos ícones usados no cartão, à esquerda do rodapé. `cabecalho` ocupa o lugar do título (que segue como nome acessível). */
/** `fundo` e `linha`: cores do cartão (padrão: branco com linhas claras; a história usa o verde-acinzentado da landing). */
export function Cartao({ titulo, cabecalho, situacao, extra, rodape, legenda, children, fundo = 'bg-branco', linha = 'border-linha' }: { titulo: string; cabecalho?: ReactNode; situacao?: Situacao; extra?: ReactNode; rodape?: ReactNode; legenda?: ReactNode; children: ReactNode; fundo?: string; linha?: string }) {
  return (
    <section className={`flex min-w-0 flex-col border ${linha} ${fundo}`} aria-label={titulo}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b ${linha} px-5 py-2`}>
        {cabecalho ?? <h2 className="text-[21px] font-semibold">{titulo}</h2>}
        {situacao && <EtiquetaSituacao s={situacao} />}
        <div className="ml-auto">{extra}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-5 py-3">{children}</div>
      {rodape && (
        <div className={`flex items-center justify-end gap-3 border-t ${linha} px-5 py-2.5`}>
          {legenda && <span className="mr-auto text-[12.5px] whitespace-nowrap text-apagado">{legenda}</span>}
          {rodape}
        </div>
      )}
    </section>
  )
}

/** Botão de salvar (= oficializar, na Constituição): só o médico salva; bloqueado mostra o motivo. */
/** `bloqueado`: botão desativado. `motivo`: aviso curto ao lado (ex.: depois de uma tentativa de salvar). */
export function BotaoOficializar({ rotulo, oficializado, motivo, bloqueado = false, onClick }: { rotulo: string; oficializado: boolean; motivo?: string; bloqueado?: boolean; onClick: () => void }) {
  if (oficializado) return <span className="text-[14px] font-semibold text-petroleo">✓ Salvo</span>
  return (
    <>
      {motivo && <span className="text-[13.5px] whitespace-nowrap text-apagado">{motivo}</span>}
      <button type="button" disabled={bloqueado} onClick={onClick} className="bg-(--esp) px-4 py-2 text-[15px] font-bold whitespace-nowrap text-papel transition enabled:hover:-translate-y-0.5 disabled:opacity-40">
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
