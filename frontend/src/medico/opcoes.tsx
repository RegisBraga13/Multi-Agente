import { useId } from 'react'

type Props = {
  rotulo: string
  ajuda?: string
  /** 'uma' = rádio; 'varias' = caixas de marcar */
  modo: 'uma' | 'varias'
  opcoes: readonly { valor: string; rotulo: string }[]
  marcadas: readonly string[]
  onAlternar(valor: string): void
}

/** Pergunta de tocar: opções em botões largos, com rádio ou caixa nativos por baixo. */
export function GrupoOpcoes({ rotulo, ajuda, modo, opcoes, marcadas, onAlternar }: Props) {
  const id = useId()
  return (
    <fieldset aria-describedby={ajuda ? `${id}-ajuda` : undefined}>
      <legend className="mb-1.5 text-[14px] font-semibold">{rotulo}</legend>
      {ajuda && <p id={`${id}-ajuda`} className="-mt-1 mb-2 text-[13px] text-apagado">{ajuda}</p>}
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const sel = marcadas.includes(o.valor)
          return (
            <label
              key={o.valor}
              className={`flex cursor-pointer items-center gap-2 border-[1.5px] px-3.5 py-2.5 text-[15px] transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--esp) ${sel ? 'border-(--esp) bg-(--esp)/10 font-semibold' : 'border-linha bg-papel hover:border-tinta'}`}
            >
              <input
                type={modo === 'uma' ? 'radio' : 'checkbox'}
                name={id}
                value={o.valor}
                checked={sel}
                onChange={() => onAlternar(o.valor)}
                className="sr-only"
              />
              <span aria-hidden className={`grid h-4 w-4 flex-none place-items-center border-[1.5px] text-[11px] leading-none ${sel ? 'border-(--esp) bg-(--esp) text-papel' : 'border-apagado'}`}>
                {sel ? '✓' : ''}
              </span>
              {o.rotulo}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
