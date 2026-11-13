import type { Especialidade } from './especialidades'

const CORES_LOGO = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10']

/** especIAlista: letras nas cores do logo, "IA" na cor da tinta. */
export function Marca({ className = '' }: { className?: string }) {
  const letras = [...'espec', 'IA', ...'lista']
  let k = 0
  return (
    <span className={`font-titulo font-semibold whitespace-nowrap ${className}`} aria-label="especIAlista">
      {letras.map((l, i) =>
        l === 'IA' ? (
          <b key={i} className="font-extrabold text-tinta">IA</b>
        ) : (
          <span key={i} style={{ color: `var(--color-${CORES_LOGO[k++]})` }}>{l}</span>
        ),
      )}
    </span>
  )
}

/** Nome do módulo: geriatr + IA, com o "IA" na cor da especialidade. */
export function NomeModulo({ esp, className = '' }: { esp: Especialidade; className?: string }) {
  return (
    <span className={`font-titulo font-semibold whitespace-nowrap ${className}`} aria-label={`${esp.raiz}IA`}>
      {esp.raiz}
      <b className="font-extrabold" style={{ color: esp.cor }}>IA</b>
    </span>
  )
}
