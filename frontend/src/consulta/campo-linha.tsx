// Campo de UMA linha que cresce para o lado enquanto se digita (largura do conteúdo).
// Nunca quebra linha: ao chegar na largura toda, o começo do texto vai saindo pela esquerda (como um campo comum).
// Enter encerra o campo e pula para o próximo. Sem corretor/sugestões do navegador (atrapalham).
import { forwardRef, type InputHTMLAttributes } from 'react'

/** Desliga corretor ortográfico, autocompletar e sugestões em qualquer campo de texto clínico. */
export const SEM_CORRETOR = { spellCheck: false, autoCorrect: 'off', autoCapitalize: 'off', autoComplete: 'off' } as const

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {
  value: string
  /** borda, espaçamento e fonte (iguais no campo e na medida) */
  caixa: string
  /** Enter: o que fazer (normalmente, focar o próximo campo) */
  onEnter: () => void
}

export const CampoLinha = forwardRef<HTMLInputElement, Props>(function CampoLinha({ value, caixa, onEnter, placeholder, className = '', ...resto }, ref) {
  return (
    // truque do grid: o span invisível tem o mesmo texto e define a largura do campo (até a largura toda)
    <span className="inline-grid max-w-full min-w-[12ch] align-top">
      <span aria-hidden className={`invisible col-start-1 row-start-1 overflow-hidden border-transparent whitespace-pre ${caixa}`}>
        {(value || placeholder || '') + '  '}
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        {...SEM_CORRETOR}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onEnter() }
        }}
        className={`col-start-1 row-start-1 w-full min-w-0 ${caixa} ${className}`}
        {...resto}
      />
    </span>
  )
})
