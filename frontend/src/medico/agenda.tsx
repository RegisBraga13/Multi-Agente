import { useState } from 'react'
import { diaAberto } from './exemplo'
import { NOME_MODALIDADE, rotuloDiaCurto, rotuloDiaLongo } from './textos'
import type { Agenda, Modalidade } from './tipos'

type Props = {
  agenda: Agenda
  modalidade: Modalidade
  atendeOnline: boolean
  onModalidade(m: Modalidade): void
  selecionado: { data: string; inicio: string } | null
  onSelecionar(data: string, inicio: string): void
}

export function AgendaMedico({ agenda, modalidade, atendeOnline, onModalidade, selecionado, onSelecionar }: Props) {
  const dias = agenda[modalidade]
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null)
  const aberto = diaAberto(dias, diaEscolhido, selecionado)
  const horarios = dias.find((d) => d.data === aberto)?.horarios.filter((h) => h.livre) ?? []

  return (
    <div className="border border-linha bg-branco p-4 shadow-[0_30px_60px_-40px_rgba(19,48,47,.45)] sm:p-6">
      {atendeOnline && (
        <div className="grid grid-cols-2 border-[1.5px] border-tinta" role="group" aria-label="Modalidade da consulta">
          {(['presencial', 'online'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modalidade === m}
              onClick={() => onModalidade(m)}
              className={`px-4 py-3 text-[15px] font-semibold transition ${modalidade === m ? 'bg-tinta text-papel' : 'hover:bg-suave'}`}
            >
              {NOME_MODALIDADE[m]}
            </button>
          ))}
        </div>
      )}

      <p className="mt-5 text-[12px] font-bold tracking-[.14em] text-apagado uppercase">Escolha o dia</p>
      <div className="-mx-4 mt-2 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
        {dias.map((d) => {
          const r = rotuloDiaCurto(d.data)
          const sel = d.data === aberto
          const livres = d.horarios.filter((h) => h.livre).length
          return (
            <button
              key={d.data}
              type="button"
              aria-pressed={sel}
              aria-label={`${rotuloDiaLongo(d.data)}, ${livres} horários livres`}
              onClick={() => setDiaEscolhido(d.data)}
              className={`flex w-[68px] flex-none snap-start flex-col items-center border-[1.5px] py-2.5 transition ${
                sel ? 'border-(--esp) bg-(--esp) text-papel' : 'border-linha bg-papel hover:border-tinta'
              }`}
            >
              <span className="text-[12px] font-semibold uppercase">{r.semana}</span>
              <span className="font-titulo text-[26px] leading-tight font-bold">{r.dia}</span>
              <span className={`text-[12px] ${sel ? '' : 'text-apagado'}`}>{r.mes}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-4 text-[12px] font-bold tracking-[.14em] text-apagado uppercase">
        {aberto ? `Horários · ${rotuloDiaLongo(aberto)}` : 'Horários'}
      </p>
      {horarios.length ? (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {horarios.map((h) => {
            const sel = !!selecionado && selecionado.data === aberto && selecionado.inicio === h.inicio
            return (
              <button
                key={h.inicio}
                type="button"
                aria-pressed={sel}
                onClick={() => aberto && onSelecionar(aberto, h.inicio)}
                className={`border-[1.5px] py-3 text-[16px] font-semibold tabular-nums transition ${
                  sel ? 'border-(--esp) bg-(--esp) text-papel' : 'border-linha bg-papel hover:border-(--esp)'
                }`}
              >
                {h.inicio}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-apagado">Sem horários livres neste dia.</p>
      )}
    </div>
  )
}
