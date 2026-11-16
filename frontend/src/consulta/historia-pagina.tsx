// Página 2: história clínica. A IA "escreve ao vivo" o rascunho, seção por seção, no ritmo da landing
// (3 letras a cada 33 ms, cursor piscando). Numa atualização, só as seções que mudaram são reescritas.
import { useEffect, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import type { SecaoHistoria } from './historia'
import type { Situacao } from './tipos'
import { SEM_CORRETOR } from './campo-linha'
import { BotaoOficializar, Cartao } from './ui'

/** Ritmo da landing (index.html, iniciaHist): 3 caracteres a cada 33 ms. */
const LETRAS_POR_PASSO = 3
const MS_POR_PASSO = 33

const ROTULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-(--esp) uppercase'
const CAIXA = 'block w-full border-[1.5px] bg-branco px-2.5 py-1 text-[14.5px] leading-snug'

type Props = {
  /** o que a IA gerou nesta versão (rótulo + texto) */
  secoes: SecaoHistoria[]
  /** o texto atual de cada seção (gerado ou editado pelo médico) */
  textos: string[]
  /** seções que a IA (re)escreveu nesta versão; as demais ficam como estavam */
  mudou: boolean[]
  /** sugestão da IA para seção que o médico tinha editado (o texto dele fica; ele decide) */
  sugestoes: (string | null)[]
  /** primeira montagem (tudo novo) ou atualização */
  primeira: boolean
  situacao: Situacao
  podeSalvar: boolean
  onMudar: (i: number, texto: string) => void
  /** aceitar (troca pelo texto da IA) ou manter o do médico */
  onDecidir: (i: number, aceitar: boolean) => void
  onSalvar: () => void
}

export function PaginaHistoria({ secoes, textos, mudou, sugestoes, primeira, situacao, podeSalvar, onMudar, onDecidir, onSalvar }: Props) {
  const reduz = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // só as seções que mudaram são escritas, na ordem; k = posição na fila, n = letras já escritas
  const [fila] = useState(() => secoes.map((_, i) => i).filter((i) => mudou[i]))
  const [pos, setPos] = useState(() => ({ k: reduz ? fila.length : 0, n: 0 }))
  const [mexidos, setMexidos] = useState<boolean[]>(() => secoes.map(() => false))
  const escrevendo = pos.k < fila.length
  const atual = escrevendo ? fila[pos.k] : -1
  const salvo = situacao === 'oficializado'
  const pendentes = sugestoes.filter(Boolean).length
  /** o aviso de sugestões pendentes só aparece depois de tentar salvar */
  const [tentou, setTentou] = useState(false)

  useEffect(() => {
    if (!escrevendo) return
    const t = setTimeout(() => {
      setPos(({ k, n }) => (n + LETRAS_POR_PASSO >= secoes[fila[k]].texto.length ? { k: k + 1, n: 0 } : { k, n: n + LETRAS_POR_PASSO }))
    }, MS_POR_PASSO)
    return () => clearTimeout(t)
  }, [pos, escrevendo, secoes, fila])

  const mudar = (i: number, v: string) => {
    setMexidos((xs) => xs.map((x, j) => (j === i ? true : x)))
    onMudar(i, v)
  }

  const atualizadas = mudou.filter(Boolean).length
  const aviso = escrevendo
    ? (primeira ? 'A IA está montando a história com a anamnese e o exame físico salvos…' : 'A IA está atualizando só o que mudou…')
    : primeira ? 'Montada só com a anamnese e o exame físico salvos. Revise, edite e salve.'
    : atualizadas + pendentes === 0 ? 'Nada mudou na história com a última alteração.'
    : [atualizadas && `${atualizadas} ${atualizadas === 1 ? 'seção atualizada' : 'seções atualizadas'}`, pendentes && `${pendentes} ${pendentes === 1 ? 'sugestão' : 'sugestões'} ao lado do seu texto`].filter(Boolean).join(' · ') + '. O resto ficou como estava.'

  return (
    <Cartao
      titulo="História clínica"
      cabecalho={<p className="flex-1 text-center text-[13.5px] text-apagado">{aviso}</p>}
      rodape={
        <BotaoOficializar
          rotulo="Salvar história"
          oficializado={salvo}
          bloqueado={escrevendo || !podeSalvar}
          motivo={tentou && pendentes > 0 ? `Falta decidir ${pendentes} ${pendentes === 1 ? 'sugestão' : 'sugestões'}` : undefined}
          onClick={() => (pendentes > 0 ? setTentou(true) : onSalvar())}
        />
      }
    >
      <div className="grid gap-x-5 gap-y-2.5 lg:grid-cols-2" aria-busy={escrevendo}>
        {secoes.map((s, i) => {
          const naFila = fila.indexOf(i)
          const esperando = escrevendo && naFila > pos.k // ainda vai ser escrita
          const digitando = i === atual
          const novo = mudou[i] && !mexidos[i] && !salvo
          return (
            <div key={s.rotulo} className={esperando && primeira ? 'invisible' : ''}>
              <p className={ROTULO_SECAO}>
                {s.rotulo}
                {!primeira && mudou[i] && !mexidos[i] && !digitando && !esperando && <span className="ml-2 border border-(--esp) px-1 py-px text-[10px] tracking-[0.08em]">Atualizado</span>}
              </p>
              {digitando || esperando ? (
                // durante a escrita: o resto do texto fica invisível, reservando o espaço (nada "pula")
                <p className={`${CAIXA} mt-0.5 border-dashed border-(--esp-medio) whitespace-pre-line`} aria-hidden>
                  <span>{digitando ? s.texto.slice(0, pos.n) : ''}</span>
                  {digitando && <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-(--esp) align-[-2px]" />}
                  <span className="invisible">{digitando ? s.texto.slice(pos.n) : s.texto}</span>
                </p>
              ) : (
                <div className={sugestoes[i] ? 'mt-0.5 grid grid-cols-2 gap-2' : 'mt-0.5'}>
                  <TextoCrescente
                    {...SEM_CORRETOR}
                    value={textos[i]}
                    onChange={(e) => mudar(i, e.target.value)}
                    aria-label={s.rotulo}
                    className={`${CAIXA} focus:border-tinta focus:outline-none ${novo ? 'border-dashed border-(--esp-medio)' : 'border-linha'}`}
                  />
                  {sugestoes[i] && (
                    // seção que você tinha editado: a IA não sobrescreve, sugere ao lado
                    <div className="flex flex-col border-[1.5px] border-dashed border-(--esp-medio) bg-(--esp-claro) px-2.5 py-1 text-[14px] leading-snug" aria-label={`Sugestão da IA para ${s.rotulo}`}>
                      <p className="text-[10px] font-bold tracking-[0.12em] text-(--esp) uppercase">Sugestão da IA</p>
                      <p className="flex-1">{sugestoes[i]}</p>
                      <p className="mt-1 flex gap-1.5">
                        <button type="button" onClick={() => onDecidir(i, true)} className="bg-tinta px-2 py-0.5 text-[12.5px] font-bold text-papel">Aceitar</button>
                        <button type="button" onClick={() => onDecidir(i, false)} className="border border-tinta px-2 py-0.5 text-[12.5px] font-bold hover:bg-branco">Manter o meu</button>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Cartao>
  )
}
