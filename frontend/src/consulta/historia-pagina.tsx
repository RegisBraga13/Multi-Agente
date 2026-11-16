// Página 2: história clínica. A IA "escreve ao vivo" o rascunho, seção por seção, no ritmo da landing
// (3 letras a cada 33 ms, cursor piscando). Numa atualização, só as seções que mudaram são reescritas.
import { useEffect, useRef, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import type { SecaoHistoria } from './historia'
import type { Situacao } from './tipos'
import { SEM_CORRETOR } from './campo-linha'
import { useEscrita } from './escrita'
import { BotaoOficializar, Cartao } from './ui'

// cores e medidas do cartão da história na landing (fundo verde-acinzentado, rótulos escuros, texto corrido)
const ROTULO_SECAO = 'text-[10.5px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const TEXTO = 'text-[14.5px] leading-[1.4] text-tinta'

/** Simulação do ditado: uma frase nova a cada 3 s, no fim da seção onde está o cursor. */
const FRASES_DITADAS = ['Nega outras queixas.', 'Orientado sobre os achados do exame.', 'Sem outras alterações relatadas.']
const SEGUNDOS_POR_FRASE = 3

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
  /** falso quando esta versão já foi escrita (voltando de outra etapa): mostra pronta */
  animar: boolean
  onEscrito: () => void
  situacao: Situacao
  podeSalvar: boolean
  onMudar: (i: number, texto: string) => void
  /** aceitar (troca pelo texto da IA) ou manter o do médico */
  onDecidir: (i: number, aceitar: boolean) => void
  onSalvar: () => void
}

export function PaginaHistoria({ secoes, textos, mudou, sugestoes, primeira, animar, onEscrito, situacao, podeSalvar, onMudar, onDecidir, onSalvar }: Props) {
  // só as seções que mudaram são escritas, na ordem; k = posição na fila, n = letras já escritas
  const [fila] = useState(() => secoes.map((_, i) => i).filter((i) => mudou[i]))
  const [textosFila] = useState(() => fila.map((i) => secoes[i].texto))
  const pos = useEscrita(textosFila, animar, onEscrito)
  const { escrevendo } = pos
  const atual = escrevendo ? fila[pos.k] : -1
  /** o médico mexeu no texto que a IA escreveu */
  const mexidos = textos.map((t, i) => t !== secoes[i].texto)
  const salvo = situacao === 'oficializado'
  const pendentes = sugestoes.filter(Boolean).length
  /** o aviso de sugestões pendentes só aparece depois de tentar salvar */
  const [tentou, setTentou] = useState(false)

  const mudar = (i: number, v: string) => onMudar(i, v)

  // o médico acrescenta por voz: o ditado entra no fim da seção onde ele clicou por último (começa na HDA)
  const [ditando, setDitando] = useState(false)
  const [onde, setOnde] = useState(2)
  const proximaFrase = useRef(0)
  const ultimo = useRef({ textos, onde, onMudar })
  useEffect(() => { ultimo.current = { textos, onde, onMudar } })
  useEffect(() => {
    if (!ditando) return
    const t = setInterval(() => {
      if (proximaFrase.current >= FRASES_DITADAS.length) { setDitando(false); return }
      const { textos: xs, onde: i, onMudar: mudarSecao } = ultimo.current
      mudarSecao(i, `${xs[i].trimEnd()} ${FRASES_DITADAS[proximaFrase.current++]}`)
    }, SEGUNDOS_POR_FRASE * 1000)
    return () => clearInterval(t)
  }, [ditando])

  const atualizadas = mudou.filter(Boolean).length
  const aviso = escrevendo
    ? (primeira ? 'A IA está montando a história com a anamnese e o exame físico salvos…' : 'A IA está atualizando só o que mudou…')
    : primeira ? 'Montada só com a anamnese e o exame físico salvos. Revise, edite e salve.'
    : atualizadas + pendentes === 0 ? 'Nada mudou na história com a última alteração.'
    : [atualizadas && `${atualizadas} ${atualizadas === 1 ? 'seção atualizada' : 'seções atualizadas'}`, pendentes && `${pendentes} ${pendentes === 1 ? 'sugestão' : 'sugestões'} ao lado do seu texto`].filter(Boolean).join(' · ') + '. O resto ficou como estava.'

  return (
    <Cartao
      titulo="História clínica"
      fundo="bg-historia"
      linha="border-historia-borda"
      cabecalho={
        <div className="flex flex-1 items-center gap-3">
          <button type="button" disabled={escrevendo} onClick={() => setDitando((d) => !d)} aria-pressed={ditando}
            className="flex items-center gap-2 bg-tinta px-3 py-1.5 text-[14px] font-bold text-papel disabled:opacity-40">
            <span className={`text-[11px] ${ditando ? 'animate-pulse text-alerta-clinico' : ''}`}>●</span>
            {ditando ? 'Pausar' : 'Ditar'}
          </button>
          <p className="flex-1 text-center text-[13.5px] text-tinta">{ditando ? `Ditando em ${secoes[onde].rotulo}…` : aviso}</p>
        </div>
      }
      legenda="Parte só da anamnese e do exame físico salvos"
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
      {/* como na landing: um quadro só, texto corrido, seções uma embaixo da outra (editor; sem tracejado) */}
      <div className="flex flex-col gap-1.5 border-[1.5px] border-historia-borda px-4 py-2.5" aria-busy={escrevendo}>
        {secoes.map((s, i) => {
          const naFila = fila.indexOf(i)
          const esperando = escrevendo && naFila > pos.k // ainda vai ser escrita
          const digitando = i === atual
          return (
            <div key={s.rotulo} className={esperando && primeira ? 'invisible' : ''}>
              <p className={ROTULO_SECAO}>
                {s.rotulo}
                {!primeira && mudou[i] && !mexidos[i] && !digitando && !esperando && <span className="ml-2 border border-historia-rotulo px-1 py-px text-[9.5px] tracking-[0.08em]">Atualizado</span>}
              </p>
              {digitando || esperando ? (
                // durante a escrita: o resto do texto fica invisível, reservando o espaço (nada "pula")
                <p className={`${TEXTO} whitespace-pre-line`} aria-hidden>
                  <span>{digitando ? s.texto.slice(0, pos.n) : ''}</span>
                  {digitando && <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-tinta align-[-2px]" />}
                  <span className="invisible">{digitando ? s.texto.slice(pos.n) : s.texto}</span>
                </p>
              ) : (
                <div className={sugestoes[i] ? 'grid grid-cols-2 gap-3' : ''}>
                  {/* o texto é editável ali mesmo, como um documento */}
                  <TextoCrescente
                    {...SEM_CORRETOR}
                    value={textos[i]}
                    onChange={(e) => mudar(i, e.target.value)}
                    aria-label={s.rotulo}
                    onFocus={() => setOnde(i)}
                    className={`${TEXTO} -mx-1 block w-[calc(100%+0.5rem)] bg-transparent px-1 hover:bg-branco/35 focus:bg-branco/60 focus:outline-none`}
                  />
                  {sugestoes[i] && (
                    // seção que você tinha editado: a IA não sobrescreve, sugere ao lado
                    <div className="flex flex-col border-[1.5px] border-historia-borda bg-branco/60 px-2.5 py-1 text-[14px] leading-snug" aria-label={`Sugestão da IA para ${s.rotulo}`}>
                      <p className="text-[10px] font-bold tracking-[0.12em] text-historia-rotulo uppercase">Sugestão da IA</p>
                      <p className="flex-1 whitespace-pre-line">{sugestoes[i]}</p>
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
