// Página 2: história clínica. A IA "escreve ao vivo" o rascunho, seção por seção, no ritmo da landing
// (3 letras a cada 33 ms, cursor piscando). Depois o médico revisa, edita e salva.
import { useEffect, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import type { SecaoHistoria } from './historia'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao } from './ui'

/** Ritmo da landing (index.html, iniciaHist): 3 caracteres a cada 33 ms. */
const LETRAS_POR_PASSO = 3
const MS_POR_PASSO = 33

const ROTULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-(--esp) uppercase'
const CAIXA = 'block w-full border-[1.5px] bg-branco px-2.5 py-1 text-[14.5px] leading-snug'

type Props = {
  secoes: SecaoHistoria[]
  situacao: Situacao
  onEditar: () => void
  onSalvar: () => void
}

export function PaginaHistoria({ secoes, situacao, onEditar, onSalvar }: Props) {
  const reduz = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // posição da escrita: seção atual e quantas letras dela já apareceram
  const [pos, setPos] = useState(() => (reduz ? { i: secoes.length, n: 0 } : { i: 0, n: 0 }))
  const [textos, setTextos] = useState(() => secoes.map((s) => s.texto))
  const [mexidos, setMexidos] = useState<boolean[]>(() => secoes.map(() => false))
  const escrevendo = pos.i < secoes.length
  const salvo = situacao === 'oficializado'

  useEffect(() => {
    if (!escrevendo) return
    const t = setTimeout(() => {
      setPos(({ i, n }) => {
        const tam = secoes[i].texto.length
        return n + LETRAS_POR_PASSO >= tam ? { i: i + 1, n: 0 } : { i, n: n + LETRAS_POR_PASSO }
      })
    }, MS_POR_PASSO)
    return () => clearTimeout(t)
  }, [pos, escrevendo, secoes])

  const mudar = (i: number, v: string) => {
    setTextos((xs) => xs.map((x, j) => (j === i ? v : x)))
    setMexidos((xs) => xs.map((x, j) => (j === i ? true : x)))
    if (situacao !== 'revisado_medico') onEditar()
  }

  return (
    <Cartao
      titulo="História clínica"
      cabecalho={
        <p className="flex-1 text-center text-[13.5px] text-apagado">
          {escrevendo ? 'A IA está montando a história com a anamnese e o exame físico salvos…' : 'Montada só com a anamnese e o exame físico salvos. Revise, edite e salve.'}
        </p>
      }
      rodape={<BotaoOficializar rotulo="Salvar história" oficializado={salvo} bloqueado={escrevendo} onClick={onSalvar} />}
    >
      <div className="grid gap-x-5 gap-y-2.5 lg:grid-cols-2" aria-busy={escrevendo}>
        {secoes.map((s, i) => {
          const visivel = i < pos.i || i === pos.i
          const pronto = i < pos.i
          return (
            <div key={s.rotulo} className={visivel ? '' : 'invisible'}>
              <p className={ROTULO_SECAO}>{s.rotulo}</p>
              {pronto ? (
                <TextoCrescente
                  value={textos[i]}
                  onChange={(e) => mudar(i, e.target.value)}
                  aria-label={s.rotulo}
                  className={`${CAIXA} mt-0.5 focus:border-tinta focus:outline-none ${mexidos[i] || salvo ? 'border-linha' : 'border-dashed border-(--esp-medio)'}`}
                />
              ) : (
                // durante a escrita: o resto do texto fica invisível, reservando o espaço (nada "pula")
                <p className={`${CAIXA} mt-0.5 border-dashed border-(--esp-medio) whitespace-pre-line`} aria-hidden>
                  <span>{s.texto.slice(0, pos.n)}</span>
                  {i === pos.i && <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-(--esp) align-[-2px]" />}
                  <span className="invisible">{s.texto.slice(pos.n)}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Cartao>
  )
}
