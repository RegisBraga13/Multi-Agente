import type { ReactNode } from 'react'
import { PAGINA } from './estilos'
import { duvidasDaPagina, linkWhatsapp } from './duvidas'
import { ACESSO_TRANSCRICAO } from './textos'
import type { Medico } from './tipos'

// Os atalhos do topo já dizem o nome de cada seção; aqui fica só o título.
function Titulo({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="text-[clamp(28px,4vw,40px)] leading-[1.05] font-bold">{children}</h2>
}

/** Como funciona: os três passos e, junto, a transcrição da consulta. Textos do autor (15/11/2026). */
export function ComoFunciona() {
  const passos = [
    ['Escolha quando e como consultar', 'Agende seu atendimento presencial ou online, no horário mais conveniente.'],
    ['Foco no atendimento personalizado', 'Compartilhe seus dados antes da consulta e permita que seu médico dedique mais tempo à sua avaliação.'],
    ['Cuide da sua saúde', 'Compareça à consulta e receba uma avaliação individualizada, com atenção às suas necessidades.'],
  ]
  return (
    <section id="como-funciona" aria-labelledby="h-como" className={PAGINA}>
      <Titulo id="h-como">Três passos até a consulta.</Titulo>
      <ol className="mt-8 grid gap-3 md:grid-cols-3">
        {passos.map(([t, x], i) => (
          <li key={t} className="border border-linha bg-branco p-6">
            <b className="font-titulo text-[44px] leading-none font-extrabold text-(--esp)">{String(i + 1).padStart(2, '0')}</b>
            <h3 className="mt-3 text-[21px] font-semibold">{t}</h3>
            <p className="mt-1 text-[15px] text-apagado">{x}</p>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-l-4 border-(--esp) bg-branco p-6 sm:p-8">
        <h3 className="text-[clamp(22px,3vw,28px)] leading-tight font-bold">Tecnologia a favor do cuidado.</h3>
        <p className="mt-3 max-w-[62ch] text-[16.5px] leading-relaxed">
          Seu médico utiliza inteligência artificial para auxiliar no registro e na organização das informações clínicas, proporcionando mais tempo para ouvir, avaliar e orientar você.
        </p>
        <p className="mt-3 max-w-[62ch] text-[16.5px] leading-relaxed">
          A transcrição por voz é opcional. Sua decisão não interfere na qualidade do atendimento. {ACESSO_TRANSCRICAO}
        </p>
      </div>
    </section>
  )
}

export function Duvidas({ medico }: { medico: Medico }) {
  return (
    <section id="duvidas" aria-labelledby="h-duv" className={`${PAGINA} border-t border-linha`}>
      <Titulo id="h-duv">Tire suas dúvidas.</Titulo>
      <div className="mt-6 border-t border-linha">
        {duvidasDaPagina(medico.especialidade).map((d) => (
          <details key={d.id} className="group border-b border-linha">
            <summary className="flex cursor-pointer list-none items-center gap-4 py-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex-1">{d.pergunta}</span>
              <i aria-hidden className="grid h-7 w-7 flex-none place-items-center bg-suave not-italic transition group-open:rotate-45 group-open:bg-(--esp) group-open:text-papel">+</i>
            </summary>
            <div className="max-w-[70ch] pb-5">
              <p className="text-apagado">{d.resposta}</p>
              {d.acao === 'whatsapp-consultorio' && (
                <a
                  href={linkWhatsapp(medico.whatsappConsultorio)} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block border-[1.5px] border-(--esp) px-4 py-2.5 text-[15px] font-semibold text-(--esp) no-underline transition hover:bg-(--esp) hover:text-papel"
                >
                  Falar com o consultório no WhatsApp
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
