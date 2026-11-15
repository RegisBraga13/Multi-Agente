import type { CSSProperties, ReactNode } from 'react'
import { Marca } from './marca'

const LINKS = [
  { href: '/funcionalidades.html', texto: 'Funcionalidades' },
  { href: '/#precos', texto: 'Preço' },
  { href: '/#seguranca', texto: 'Segurança' },
  { href: '/#faq', texto: 'FAQ' },
]

export function Topo() {
  return (
    <header className="sticky top-0 z-50 border-b border-linha bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3.5 sm:px-6">
        <a href="/" className="text-[26px] no-underline" aria-label="Início"><Marca /></a>
        <nav aria-label="Principal" className="hidden gap-6 text-[15px] font-medium md:flex">
          {LINKS.map((l) => <a key={l.href} href={l.href} className="hover:text-(--esp)">{l.texto}</a>)}
        </nav>
        <a href="/#precos" className="ml-auto bg-(--esp) px-[18px] py-[11px] text-[15px] font-bold text-papel transition hover:-translate-y-0.5">
          Ver planos
        </a>
      </div>
    </header>
  )
}

export function Rodape() {
  return (
    <footer className="border-t-[3px] border-transparent [border-image:var(--espectro)_1]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <Marca className="text-[28px]" />
          <p className="mt-3 max-w-xs text-[15px] text-apagado">A IA clínica que devolve tempo ao médico especialista. Feita no Brasil.</p>
        </div>
        <nav aria-label="Legal" className="flex flex-col gap-3 text-[15px]">
          <a href="/#seguranca" className="hover:text-(--esp)">Segurança e LGPD</a>
          <a href="/#faq" className="hover:text-(--esp)">Perguntas frequentes</a>
        </nav>
      </div>
    </footer>
  )
}

export function Moldura({ cor, children }: { cor?: string; children: ReactNode }) {
  return (
    <div style={cor ? ({ '--esp': cor } as CSSProperties) : undefined} className="flex min-h-screen flex-col">
      <Topo />
      <main className="flex-1">{children}</main>
      <Rodape />
    </div>
  )
}
