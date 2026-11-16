import type { ReactNode } from 'react'
import { PAGINA } from './estilos'
import { duvidasDaPagina, linkWhatsapp } from './duvidas'
import { ACESSO_TRANSCRICAO } from './textos'
import type { Medico } from './tipos'

// Os atalhos do topo já dizem o nome de cada seção; aqui fica só o título.
function Titulo({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} tabIndex={-1} className="text-[clamp(24px,2.6vw,32px)] leading-[1.05] font-bold outline-none">{children}</h2>
}

/** Como funciona: os três passos e, junto, a transcrição da consulta. Textos do autor (15/11/2026). */
export function ComoFunciona() {
  const passos = [
    ['Escolha quando e como consultar', 'Agende seu atendimento presencial ou online, no horário mais conveniente.'],
    ['Foco no atendimento personalizado', 'Receba e preencha seu formulário antes da consulta e permita que seu médico dedique mais tempo à sua avaliação.'],
    ['Cuide da sua saúde', 'Compareça à consulta e receba uma avaliação individualizada, com atenção às suas necessidades.'],
  ]
  return (
    <section id="secao-como-funciona" aria-labelledby="h-como" className={PAGINA}>
      <Titulo id="h-como">Três passos até a consulta.</Titulo>
      <ol className="mt-6 grid gap-3 md:grid-cols-3">
        {passos.map(([t, x], i) => (
          <li key={t} className="border border-linha bg-branco p-5">
            <b className="font-titulo text-[32px] leading-none font-extrabold text-(--esp)">{String(i + 1).padStart(2, '0')}</b>
            <h3 className="mt-2 text-[18px] leading-snug font-semibold">{t}</h3>
            <p className="mt-1 text-[14.5px] text-apagado">{x}</p>
          </li>
        ))}
      </ol>
      <div className="mt-3 border-l-4 border-(--esp) bg-branco p-5 sm:px-7 sm:py-6">
        <h3 className="text-[clamp(19px,2vw,22px)] leading-tight font-bold">Tecnologia a favor do cuidado.</h3>
        <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed">
          Seu médico utiliza inteligência artificial para auxiliar no registro e na organização das informações clínicas, proporcionando mais tempo para ouvir, avaliar e orientar você.
        </p>
        <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed">
          A transcrição por voz é opcional. Sua decisão não interfere na qualidade do atendimento. {ACESSO_TRANSCRICAO}
        </p>
      </div>
    </section>
  )
}

export function Duvidas({ medico }: { medico: Medico }) {
  const lista = duvidasDaPagina(medico.especialidade)
  const meio = Math.ceil(lista.length / 2)
  // No PC, duas colunas; e só uma resposta aberta por vez (abrir outra fecha a anterior),
  // para tudo caber numa tela ao clicar em "Dúvidas".
  const coluna = (itens: typeof lista) =>
    itens.map((d) => (
      <details key={d.id} name="duvidas" className="group border-b border-linha">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 text-[15px] leading-snug font-semibold sm:gap-4 sm:py-3 sm:text-[16px] [&::-webkit-details-marker]:hidden">
          <span className="flex-1">{d.pergunta}</span>
          <i aria-hidden className="grid h-6 w-6 flex-none place-items-center bg-suave not-italic transition group-open:rotate-45 group-open:bg-(--esp) group-open:text-papel">+</i>
        </summary>
        <div className="max-w-[70ch] pb-3 text-[14.5px] sm:pb-4 sm:text-[15px]">
          <p className="text-apagado">{d.resposta}</p>
          {d.acao === 'lista-convenios' && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Convênios atendidos">
              {['Particular', ...medico.convenios].map((c) => (
                <li key={c} className="border border-linha bg-branco px-2.5 py-1 text-[14px] font-semibold text-tinta">{c}</li>
              ))}
            </ul>
          )}
          {d.acao === 'whatsapp-consultorio' && (
            <a
              href={linkWhatsapp(medico.whatsappConsultorio)} target="_blank" rel="noopener noreferrer"
              className="mt-2.5 inline-block border-[1.5px] border-(--esp) px-4 py-2 text-[14.5px] font-semibold text-(--esp) no-underline transition hover:bg-(--esp) hover:text-papel"
            >
              Falar com o consultório no WhatsApp
            </a>
          )}
        </div>
      </details>
    ))
  return (
    <section id="secao-duvidas" aria-labelledby="h-duv" className={PAGINA}>
      <Titulo id="h-duv">Tire suas dúvidas.</Titulo>
      <div className="mt-5 grid gap-x-10 lg:grid-cols-2 lg:items-start">
        <div className="border-t border-linha">{coluna(lista.slice(0, meio))}</div>
        <div className="lg:border-t lg:border-linha">{coluna(lista.slice(meio))}</div>
      </div>
    </section>
  )
}
