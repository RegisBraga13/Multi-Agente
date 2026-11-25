import { Fragment, useId, type CSSProperties, type ReactNode } from 'react'

type Props = {
  rotulo: string
  ajuda?: string
  /** 'uma' = rádio; 'varias' = caixas de marcar */
  modo: 'uma' | 'varias'
  opcoes: readonly { valor: string; rotulo: string }[]
  marcadas: readonly string[]
  onAlternar(valor: string): void
  /** no PC, as opções em duas colunas, lidas de cima para baixo */
  duasColunas?: boolean
  /** opções mais baixas (texto em linhas justas), para a parte caber numa tela */
  compacto?: boolean
  /** campo que aparece quando a opção está marcada (ex.: "Outro" → onde?): em duas colunas, no lugar vazio logo abaixo dela;
   *  nas outras, ao lado dela. A tela não cresce ao abrir o campo. */
  aoLado?: { valor: string; campo: ReactNode }
}

/** Pergunta de tocar: opções em botões largos, com rádio ou caixa nativos por baixo. */
export function GrupoOpcoes({ rotulo, ajuda, modo, opcoes, marcadas, onAlternar, duasColunas, compacto, aoLado }: Props) {
  const justo = duasColunas || compacto
  const id = useId()
  return (
    <fieldset aria-describedby={ajuda ? `${id}-ajuda` : undefined}>
      <legend className="mb-1 text-[14px] font-semibold">{rotulo}</legend>
      {ajuda && <p id={`${id}-ajuda`} className="-mt-1 mb-2 text-[13px] text-apagado">{ajuda}</p>}
      <div
        className={duasColunas ? 'grid gap-1 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[repeat(var(--linhas),auto)] sm:gap-x-3' : 'flex flex-wrap gap-1.5'}
        style={duasColunas ? ({ '--linhas': Math.ceil((opcoes.length + (aoLado && marcadas.includes(aoLado.valor) ? 1 : 0)) / 2) } as CSSProperties) : undefined}
      >
        {opcoes.map((o) => {
          const sel = marcadas.includes(o.valor)
          const comCampo = sel && aoLado?.valor === o.valor
          const opcao = (
            <label
              key={o.valor}
              className={`flex cursor-pointer items-center gap-1.5 border-[1.5px] px-2 ${justo ? 'py-1 leading-tight' : 'py-1.5'} text-[14px] transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--esp) ${sel ? 'border-(--esp) bg-(--esp)/10 font-semibold' : 'border-linha bg-papel hover:border-tinta'}`}
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
          if (!comCampo) return opcao
          if (duasColunas) return <Fragment key={o.valor}>{opcao}<div>{aoLado.campo}</div></Fragment>
          return (
            <div key={o.valor} className="flex min-w-[16rem] flex-1 items-start gap-1">
              <div className="flex-none">{opcao}</div>
              <div className="min-w-0 flex-1">{aoLado.campo}</div>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
