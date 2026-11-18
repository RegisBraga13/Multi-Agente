// Página 6: prontuário da consulta (SOAP). Ao salvar os anexos, a IA escreve ao vivo, no ritmo da
// história clínica (3 letras a cada 33 ms), só com o que foi colhido. O médico edita (escrevendo ou
// ditando — ditado em simulação) ou salva sem editar: a consulta fica finalizada.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import { SEM_CORRETOR } from './campo-linha'
import { useEscrita } from './escrita'
import { chave, type SecaoProntuario } from './prontuario'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao } from './ui'

const TITULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const TEXTO = 'text-[14px] leading-[1.38] text-tinta'

/** Simulação do ditado: uma frase nova a cada 3 s, no fim da linha onde está o cursor. */
const FRASES_DITADAS = ['Orientações sobre o diagnóstico e o tratamento fornecidas.', 'Dúvidas esclarecidas.']
const SEGUNDOS_POR_FRASE = 3

type Props = {
  titulo: string
  cabecalho: string[]
  secoes: SecaoProntuario[]
  textos: Record<string, string>
  /** linhas que a IA (re)escreveu nesta versão */
  mudou: Record<string, boolean>
  primeira: boolean
  animar: boolean
  onEscrito: () => void
  situacao: Situacao
  podeSalvar: boolean
  onMudar: (k: string, texto: string) => void
  onSalvar: () => void
}

export function PaginaProntuario(p: Props) {
  const { secoes, textos } = p
  const todas = secoes.flatMap((s) => s.linhas.map((l) => ({ k: chave(s, l), texto: l.texto })))
  const [fila] = useState(() => todas.filter((x) => p.mudou[x.k]))
  const [textosFila] = useState(() => fila.map((x) => x.texto))
  const pos = useEscrita(textosFila, p.animar, p.onEscrito)
  const { escrevendo } = pos
  const atual = escrevendo ? fila[pos.k].k : null
  const salvo = p.situacao === 'oficializado'

  // ditado (simulação): entra no fim da linha onde o médico clicou por último
  const [ditando, setDitando] = useState(false)
  const [onde, setOnde] = useState(todas[0]?.k ?? '')
  const proxima = useRef(0)
  const ultimo = useRef({ textos, onde, onMudar: p.onMudar })
  useEffect(() => { ultimo.current = { textos, onde, onMudar: p.onMudar } })
  useEffect(() => {
    if (!ditando) return
    const t = setInterval(() => {
      if (proxima.current >= FRASES_DITADAS.length) { setDitando(false); return }
      const { textos: xs, onde: k, onMudar } = ultimo.current
      onMudar(k, `${(xs[k] ?? '').trimEnd()} ${FRASES_DITADAS[proxima.current++]}`)
    }, SEGUNDOS_POR_FRASE * 1000)
    return () => clearInterval(t)
  }, [ditando])

  const aviso = escrevendo
    ? (p.primeira ? 'A IA está escrevendo o prontuário só com o que foi colhido e salvo…' : 'A IA está atualizando só o que mudou…')
    : salvo ? 'Prontuário salvo. Consulta finalizada.'
    : 'Só o que foi colhido na consulta. Edite (escrevendo ou ditando) ou salve sem editar.'
  const rotuloLinha = (k: string) => secoes.flatMap((s) => s.linhas.map((l) => [chave(s, l), l.rotulo])).find(([x]) => x === k)?.[1] ?? ''

  // as seções em ordem, uma embaixo da outra
  const coluna = (ids: SecaoProntuario['id'][]) => secoes.filter((s) => ids.includes(s.id)).map((s) => (
    <div key={s.id} className="flex flex-col gap-1">
      {s.titulo && <p className={TITULO_SECAO}>{s.titulo}</p>}
      {s.linhas.map((l) => {
        const k = chave(s, l)
        const iFila = fila.findIndex((x) => x.k === k)
        const esperando = escrevendo && iFila > pos.k
        const digitando = k === atual
        return (
          <LinhaSoap key={k} rotulo={l.rotulo} invisivel={esperando && p.primeira}>
            {(recuo) => digitando || esperando ? (
              <p className={`${TEXTO} whitespace-pre-line`} style={{ textIndent: recuo }} aria-hidden>
                <span>{digitando ? l.texto.slice(0, pos.n) : ''}</span>
                {digitando && <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-tinta align-[-2px]" />}
                <span className="invisible">{digitando ? l.texto.slice(pos.n) : l.texto}</span>
              </p>
            ) : (
              <TextoCrescente
                key={recuo}
                {...SEM_CORRETOR}
                value={textos[k] ?? ''}
                readOnly={salvo}
                onChange={(e) => p.onMudar(k, e.target.value)}
                onFocus={() => setOnde(k)}
                aria-label={l.rotulo}
                style={{ textIndent: recuo }}
                className={`${TEXTO} -mx-1 block w-[calc(100%+0.5rem)] bg-transparent px-1 hover:bg-branco/35 focus:bg-branco/60 focus:outline-none read-only:hover:bg-transparent`}
              />
            )}
          </LinhaSoap>
        )
      })}
    </div>
  ))

  return (
    <Cartao
      titulo="Prontuário"
      fundo="bg-historia"
      linha="border-historia-borda"
      cabecalho={
        <div className="flex flex-1 items-center gap-3">
          <button type="button" disabled={escrevendo || salvo} onClick={() => setDitando((d) => !d)} aria-pressed={ditando}
            className="flex items-center gap-2 bg-tinta px-3 py-1.5 text-[14px] font-bold text-papel disabled:opacity-40">
            <span className={`text-[11px] ${ditando ? 'animate-pulse text-alerta-clinico' : ''}`}>●</span>
            {ditando ? 'Pausar' : 'Ditar'}
          </button>
          <p className="flex-1 text-center text-[13.5px] text-tinta">{ditando ? `Ditando em ${rotuloLinha(onde)}…` : aviso}</p>
        </div>
      }
      legenda="Só o que foi colhido · campo não colhido não aparece · ditado: simulação"
      rodape={<BotaoOficializar rotulo="Salvar prontuário" oficializado={salvo} bloqueado={escrevendo || !p.podeSalvar} onClick={p.onSalvar} />}
    >
      <div className="flex flex-1 flex-col gap-2 border-[1.5px] border-historia-borda px-4 py-2.5" aria-busy={escrevendo}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-historia-borda pb-1.5">
          <p className="text-[15px] font-bold">{p.titulo}</p>
          {p.cabecalho.map((x) => <p key={x} className="text-[13.5px] whitespace-pre">{x}</p>)}
        </div>
        {/* página inteira, uma coluna: o prontuário sempre aumenta (a regra de uma tela não vale aqui) */}
        <div className="flex flex-1 flex-col gap-2">{coluna(['S', 'O', 'A', 'P'])}</div>
      </div>
    </Cartao>
  )
}

/** "• Rótulo: texto" numa linha só, como no modelo: o rótulo fica por cima do começo do texto (recuo da 1ª linha). */
function LinhaSoap({ rotulo, invisivel, children }: { rotulo: string; invisivel: boolean; children: (recuo: number) => ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [recuo, setRecuo] = useState(0)
  useLayoutEffect(() => { setRecuo(ref.current ? ref.current.offsetWidth + 5 : 0) }, [rotulo])
  return (
    <div className={`relative ${invisivel ? 'invisible' : ''}`}>
      {rotulo && <span ref={ref} className={`${TEXTO} pointer-events-none absolute top-0 left-0 z-10 font-bold`}>• {rotulo}:</span>}
      {children(recuo)}
    </div>
  )
}
