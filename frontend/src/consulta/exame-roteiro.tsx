// Exame físico por roteiro (ex.: Reumatologia): só os cabeçalhos das partes; clicar abre as opções. Começa pela
// primeira aberta; "Pronto ›" fecha (mostrando o resumo numa linha) e abre a próxima. O médico pode voltar em
// qualquer parte e mudar; só fica definitivo quando salva o exame (autor, 24/11/2026).
import { Fragment, useEffect, useState } from 'react'
import { SEM_CORRETOR } from './campo-linha'
import { alternarMarca, chaveDaLinha, COMPARADO, escreverCampo, parteFeita, resumoDaParte, type MarcasExame, type ParteRoteiro, type Roteiro } from './roteiro-exame'
import { TextoCrescente } from '../medico/texto-crescente'

type Props = {
  roteiro: Roteiro
  marcas: MarcasExame
  onMarcas: (m: MarcasExame) => void
  observacoes: string
  onObservacoes: (t: string) => void
  /** retorno: o que foi marcado na consulta anterior, em cinza ao lado de cada parte */
  anteriores?: MarcasExame
  /** uma parte abriu ou fechou (aberta, as fotos se recolhem para caber na tela) */
  onAbrir?: (aberta: boolean) => void
}

const CHIP = 'border-[1.5px] px-1.5 py-0 text-[13px] leading-[1.4]'
/** caixinha de número ou de "Outro", da altura de uma opção */
const CAIXA_NUMERO = 'border-[1.5px] border-linha bg-branco px-1 py-0 text-center text-[13px] leading-[1.4] focus:border-tinta focus:outline-none'

export function ExameRoteiro({ roteiro, marcas, onMarcas, observacoes, onObservacoes, anteriores, onAbrir }: Props) {
  // consulta nova: abre a primeira parte; retomada (já tem marcas): tudo fechado, com os resumos
  const [aberta, setAbertaEstado] = useState<number | null>(() => (Object.keys(marcas).length ? null : 0))
  const setAberta = (i: number | null) => { setAbertaEstado(i); onAbrir?.(i !== null) }
  useEffect(() => { onAbrir?.(aberta !== null) }, []) // eslint-disable-line react-hooks/exhaustive-deps -- só ao abrir a página

  if (aberta !== null) {
    // uma parte aberta: as outras viram uma linha de atalhos (como no exame da Dermatologia, os outros campos se recolhem)
    const parte = roteiro[aberta]
    const antes = anteriores ? resumoDaParte(parte, anteriores) : ''
    return (
      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <nav aria-label="Partes do exame" className="flex flex-wrap items-center gap-x-1 gap-y-0.5 border-b border-linha pb-1 text-[13px]">
          {roteiro.map((p, i) => {
            const feita = parteFeita(p, marcas)
            return (
              // tocar na parte aberta fecha todas (volta à lista com os resumos)
              <button key={p.id} type="button" onClick={() => setAberta(i === aberta ? null : i)} aria-current={i === aberta ? 'step' : undefined}
                title={i === aberta ? 'Fechar' : undefined}
                className={`px-1.5 py-0.5 ${i === aberta ? 'bg-tinta font-bold text-papel' : 'hover:bg-suave'} ${feita && i !== aberta ? 'text-(--esp)' : ''}`}>
                {i + 1}. {p.titulo}{feita && i !== aberta ? ' ✓' : ''}
              </button>
            )
          })}
        </nav>
        {parte.ajuda && <p className="mt-1 text-[12px] text-apagado">{parte.ajuda}</p>}
        {antes && <p className="mt-1 text-[12.5px] text-apagado">Antes: {antes}</p>}
        <div className="mt-1"><Linhas parte={parte} marcas={marcas} onMarcas={onMarcas} /></div>
        <div className="mt-1.5 flex justify-end">
          <button type="button" onClick={() => setAberta(aberta + 1 < roteiro.length ? aberta + 1 : null)}
            className="border-[1.5px] border-tinta px-3 py-0.5 text-[13.5px] font-bold hover:bg-tinta hover:text-papel">
            Pronto ›
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col">
      <ol className="border-t border-linha">
        {roteiro.map((parte, i) => {
          const feita = parteFeita(parte, marcas)
          const antes = anteriores ? resumoDaParte(parte, anteriores) : ''
          return (
            <li key={parte.id} className="border-b border-linha">
              <button type="button" onClick={() => setAberta(i)} aria-expanded={false}
                className="flex w-full items-baseline gap-2 py-[3px] text-left">
                <span aria-hidden className={`w-3 shrink-0 text-[13px] font-bold ${feita ? 'text-(--esp)' : 'text-apagado'}`}>{feita ? '✓' : '›'}</span>
                <span className="shrink-0 text-[14px] font-bold">{i + 1}. {parte.titulo}</span>
                {/* hoje e (no retorno) antes dividem a linha; o que não cabe termina em "…" (o título mostra tudo) */}
                <span className="min-w-0 flex-1 truncate text-[13px] text-apagado" title={resumoDaParte(parte, marcas)}>{resumoDaParte(parte, marcas)}</span>
                {antes && <span className="max-w-[45%] min-w-0 truncate text-[12px] text-apagado/80 italic" title={`antes: ${antes}`}>antes: {antes}</span>}
              </button>
            </li>
          )
        })}
      </ol>
      {anteriores && (
        // retorno: comparação com a consulta anterior, antes das Observações
        <div role="group" aria-label={COMPARADO.rotulo} className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-apagado">{COMPARADO.rotulo}</span>
          {COMPARADO.opcoes.map((o) => {
            const sel = marcas[COMPARADO.chave]?.includes(o)
            return (
              <button key={o} type="button" aria-pressed={!!sel} onClick={() => onMarcas(alternarMarca(marcas, COMPARADO.chave, o, false))}
                className={`${CHIP} ${sel ? 'border-tinta bg-tinta font-semibold text-papel' : 'border-linha bg-branco hover:border-tinta'}`}>
                {o}
              </button>
            )
          })}
        </div>
      )}
      {/* depois do item 5: texto livre para observar e acrescentar (autor, 24/11/2026) */}
      <label className="mt-2 block">
        <span className="mb-0.5 block text-[13px] font-semibold text-apagado">Observações</span>
        <TextoCrescente {...SEM_CORRETOR} value={observacoes} onChange={(e) => onObservacoes(e.target.value)} placeholder="Acrescente o que quiser, com suas palavras"
          className="block w-full border-[1.5px] border-linha bg-branco px-2.5 py-1 text-[14px] leading-snug focus:border-tinta focus:outline-none" />
      </label>
    </div>
  )
}

/** As linhas de uma parte. Linhas só de lado (D/E) ou "Sim" ficam em 3 colunas, por grupo (ex.: MMSS, MMII). */
function Linhas({ parte, marcas, onMarcas }: { parte: ParteRoteiro; marcas: MarcasExame; onMarcas: (m: MarcasExame) => void }) {
  const curta = parte.linhas.every((l) => !l.numeros && l.opcoes.length >= 1 && l.opcoes.length <= 2 && l.opcoes.every((o) => o.length <= 3))
  const grupos = [...new Set(parte.linhas.map((l) => l.grupo ?? ''))]
  const chips = (l: ParteRoteiro['linhas'][number]) => {
    const chave = chaveDaLinha(parte, l)
    const sel = marcas[chave] ?? []
    const valor = (id: string) => marcas[`${chave}#${id}`]?.[0] ?? ''
    // caixinhas de número (sinais vitais, dimensões, extensão): só entram se preenchidas
    const numeros = (l.numeros ?? []).map((n) => (
      <span key={n.id} className="inline-flex items-center gap-1 text-[13px]">
        {n.antes && <span className="text-apagado">{n.antes}</span>}
        <input {...SEM_CORRETOR} inputMode="decimal" aria-label={`${l.rotulo}${n.antes ? ` ${n.antes}` : ''}`} value={valor(n.id)}
          onChange={(e) => onMarcas(escreverCampo(marcas, `${chave}#${n.id}`, e.target.value))}
          style={{ width: n.largura ?? 40 }} className={`${CAIXA_NUMERO} ${valor(n.id) ? 'border-tinta' : 'border-linha'}`} />
        {n.depois && <span className="text-apagado">{n.depois}</span>}
      </span>
    ))
    const opcoes = l.opcoes.map((o) => (
      <button key={o} type="button" aria-pressed={sel.includes(o)} onClick={() => onMarcas(alternarMarca(marcas, chave, o, l.multipla))}
        className={`${CHIP} ${sel.includes(o) ? 'border-tinta bg-tinta font-semibold text-papel' : 'border-linha bg-branco hover:border-tinta'}`}>
        {o}
      </button>
    ))
    // "Outro" marcado abre uma linha para escrever, logo depois das opções
    const outro = l.outro && sel.includes('Outro') && (
      <input key="outro" {...SEM_CORRETOR} autoFocus={!valor('outro')} aria-label={`${l.rotulo}: outro`} placeholder="qual?" value={valor('outro')}
        onChange={(e) => onMarcas(escreverCampo(marcas, `${chave}#outro`, e.target.value))}
        className={`${CAIXA_NUMERO} w-40 text-left`} />
    )
    return [...numeros, ...opcoes, outro]
  }
  return (
    <div className="grid gap-y-[3px]">
      {grupos.map((g) => (
        <Fragment key={g}>
          {g && <p className="mt-0.5 text-[11.5px] font-bold tracking-[.08em] text-apagado uppercase">{g}</p>}
          <div className={curta ? 'grid grid-cols-3 gap-x-3 gap-y-[3px]' : 'grid gap-y-[3px]'}>
            {parte.linhas.filter((l) => (l.grupo ?? '') === g).map((l) => (
              <div key={l.id} role="group" aria-label={l.rotulo} className={curta ? 'flex items-center justify-between gap-1' : 'grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2'}>
                <span className={`text-[13px] whitespace-nowrap ${curta ? 'truncate' : 'pt-px font-semibold text-apagado'}`}>{l.rotulo}</span>
                <div className="flex flex-wrap items-center gap-[3px]">{chips(l)}</div>
              </div>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
