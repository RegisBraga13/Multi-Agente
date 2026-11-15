// Classes compartilhadas pelos formulários da página do médico.

export type PropsCampo = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }

export function classeEntrada(p: PropsCampo) {
  return `w-full border-[1.5px] bg-papel px-4 py-3 text-[16px] outline-none transition focus:border-(--esp) focus:bg-branco ${p['aria-invalid'] ? 'border-alerta' : 'border-linha'}`
}

export const btnPrimario = 'w-full bg-(--esp) px-6 py-4 text-[17px] font-bold text-papel transition hover:-translate-y-0.5'
export const btnSecundario = 'w-full border-[1.5px] border-tinta px-6 py-3.5 text-[16px] font-semibold transition hover:bg-tinta hover:text-papel'
