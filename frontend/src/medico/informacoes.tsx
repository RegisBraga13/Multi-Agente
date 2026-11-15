import type { ReactNode } from 'react'
import { artigo, textoTranscricao } from './textos'
import type { Medico } from './tipos'

function Titulo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <>
      <p className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase">{rotulo}</p>
      <h2 className="mt-2 text-[clamp(28px,4vw,40px)] leading-[1.05] font-bold">{children}</h2>
    </>
  )
}

export function ComoFunciona() {
  const passos = [
    ['Escolha o horário', 'Presencial ou online, no dia que for melhor para você.'],
    ['Preencha o formulário', 'Pelo WhatsApp, aqui na página ou, se preferir, na própria consulta.'],
    ['Venha para a consulta', 'O consultório confirma o horário e lembra você antes do dia.'],
  ]
  return (
    <section aria-labelledby="h-como">
      <Titulo rotulo="Como funciona">
        <span id="h-como">Três passos até a consulta.</span>
      </Titulo>
      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {passos.map(([t, x], i) => (
          <li key={t} className="border border-linha bg-branco p-6">
            <b className="font-titulo text-[44px] leading-none font-extrabold text-(--esp)">{String(i + 1).padStart(2, '0')}</b>
            <h3 className="mt-3 text-[21px] font-semibold">{t}</h3>
            <p className="mt-1 text-[15px] text-apagado">{x}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SobreTranscricao({ medico }: { medico: Medico }) {
  return (
    <section aria-labelledby="h-transc" className="border-l-4 border-(--esp) bg-branco p-6 sm:p-8">
      <Titulo rotulo="Transcrição da consulta">
        <span id="h-transc">Você decide se a conversa é transcrita.</span>
      </Titulo>
      <p className="mt-4 max-w-[62ch] text-[16.5px] leading-relaxed">{textoTranscricao(medico)}</p>
    </section>
  )
}

export function Duvidas({ medico }: { medico: Medico }) {
  const itens: [string, string][] = [
    ['O horário já fica marcado?', 'Fica reservado como pedido. O consultório confirma pelo WhatsApp.'],
    ['Posso desmarcar ou remarcar?', 'Pode. Fale com o consultório pelo WhatsApp e escolha outro dia.'],
    ['Como é a consulta online?', 'Você recebe o link pelo WhatsApp e entra pelo navegador, sem baixar aplicativo.'],
    ['Preciso preencher o formulário antes?', `Não é obrigatório, mas ajuda muito: ${artigo(medico)} já chega à consulta conhecendo o seu caso.`],
    ['Meus dados ficam protegidos?', 'Ficam guardados com criptografia, em servidores no Brasil, e só o consultório tem acesso.'],
  ]
  return (
    <section aria-labelledby="h-duv">
      <Titulo rotulo="Dúvidas">
        <span id="h-duv">Antes de marcar.</span>
      </Titulo>
      <div className="mt-6 border-t border-linha">
        {itens.map(([q, r]) => (
          <details key={q} className="group border-b border-linha">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{q}</span>
              <i aria-hidden className="grid h-7 w-7 flex-none place-items-center bg-suave not-italic transition group-open:rotate-45 group-open:bg-(--esp) group-open:text-papel">+</i>
            </summary>
            <p className="pb-4 text-apagado">{r}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
