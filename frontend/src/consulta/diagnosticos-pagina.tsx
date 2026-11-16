// Página 3: diagnósticos diferenciais. A IA escreve as hipóteses no ritmo da história (só a partir da
// história salva); o médico toca para confirmar, descarta, acrescenta o seu. Como na landing.
import { useRef, useState } from 'react'
import { CampoLinha, SEM_CORRETOR } from './campo-linha'
import type { Decisao, ItemDD, NaoPerder } from './diagnosticos'
import { useEscrita } from './escrita'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao, ROTULO } from './ui'

const CURTO: Record<string, string> = {
  'Queixa principal': 'Queixa', 'História da doença atual': 'HDA', 'Antecedentes e alertas': 'Antecedentes', 'Exames complementares': 'Exames',
}
const BOTAO_PEQ = 'px-2 py-0.5 text-[12.5px] font-bold'

type Props = {
  itens: ItemDD[]
  naoPerder: NaoPerder | null
  naoPerderAvaliado: boolean
  primeira: boolean
  /** falso quando esta versão já foi escrita (voltando de outra etapa) */
  animar: boolean
  onEscrito: () => void
  situacao: Situacao
  podeSalvar: boolean
  /** o que impede salvar (aparece só depois de tentar) */
  pendencia: string | null
  onDecidir: (id: string, d: Decisao) => void
  /** sugestão ao lado de uma decisão: manter (some o aviso) ou rever/retirar */
  onAviso: (id: string, manter: boolean) => void
  onAdicionar: (nome: string, cid: string) => void
  onAvaliarNaoPerder: () => void
  onSalvar: () => void
}

export function PaginaDiagnosticos(p: Props) {
  const { itens, naoPerder, primeira, situacao } = p
  // só as hipóteses que a IA (re)escreveu são escritas, na ordem
  const [fila] = useState(() => itens.filter((x) => x.mudou).map((x) => x.hip.id))
  const [nomesFila] = useState(() => fila.map((id) => itens.find((x) => x.hip.id === id)!.hip.nome))
  const pos = useEscrita(nomesFila, p.animar, p.onEscrito)
  const { escrevendo } = pos
  const salvo = situacao === 'oficializado'
  const [tentou, setTentou] = useState(false)
  const [trecho, setTrecho] = useState<string | null>(null) // trecho da história à mostra (um por vez)

  const daIA = itens.filter((x) => !x.propria)
  const avisos = itens.filter((x) => x.aviso).length
  // o que a IA fez nesta versão (fixo; as sugestões pendentes contam ao vivo)
  const [inicio] = useState(() => ({ atualizadas: itens.filter((x) => x.mudou).length, avisos }))
  const partes = [
    inicio.atualizadas && `${inicio.atualizadas} ${inicio.atualizadas === 1 ? 'hipótese atualizada' : 'hipóteses atualizadas'} com a história nova`,
    avisos && `${avisos} ${avisos === 1 ? 'sugestão' : 'sugestões'} ao lado da sua decisão`,
  ].filter(Boolean)
  const aviso = escrevendo
    ? (primeira ? 'A IA está sugerindo hipóteses com a história clínica salva…' : 'A IA está atualizando só o que mudou…')
    : daIA.length === 0 ? 'A IA não tem hipóteses de exemplo para este paciente. Acrescente o seu diagnóstico.'
    : primeira ? 'Sugeridas só com a história clínica salva. Você decide o diagnóstico.'
    : inicio.atualizadas + inicio.avisos === 0 ? 'Nada mudou nas hipóteses com a última alteração.'
    : partes.length ? partes.join(' · ') + '.' : 'Hipóteses revistas com a história nova.'

  /** situação de escrita de uma hipótese: escrevendo agora, esperando a vez, ou pronta */
  const fase = (id: string) => {
    const i = fila.indexOf(id)
    if (!escrevendo || i < 0 || i < pos.k) return 'pronta' as const
    return i === pos.k ? ('digitando' as const) : ('esperando' as const)
  }

  return (
    <Cartao
      titulo="Diagnósticos diferenciais"
      cabecalho={<p className="flex-1 text-center text-[13.5px] text-apagado">{aviso}</p>}
      legenda="Toque = confirmar · × = descartar · tracejado = sugestão da IA"
      rodape={
        <BotaoOficializar
          rotulo="Salvar diagnósticos"
          oficializado={salvo}
          bloqueado={escrevendo || !p.podeSalvar}
          motivo={tentou && p.pendencia ? p.pendencia : undefined}
          onClick={() => (p.pendencia ? setTentou(true) : p.onSalvar())}
        />
      }
    >
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[1.15fr_1fr]" aria-busy={escrevendo} onKeyDown={(e) => { if (e.key === 'Escape') setTrecho(null) }}>
        <div className="flex min-w-0 flex-col gap-2">
          <p className={ROTULO}>Hipóteses · toque para confirmar</p>
          {itens.map((x) => (
            <LinhaHipotese key={x.hip.id} x={x} fase={fase(x.hip.id)} n={pos.n} primeira={primeira} onDecidir={p.onDecidir} onAviso={p.onAviso} />
          ))}
          {!escrevendo && <Adicionar onAdicionar={p.onAdicionar} />}
        </div>

        <div className="min-w-0">
          {naoPerder && (
            <div className={`mb-2.5 bg-escuro px-4 py-2 text-sobre-escuro transition-opacity ${escrevendo ? 'opacity-0' : ''}`}>
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[15.5px] leading-snug font-semibold">
                  <span className="mr-2 text-[11px] font-bold tracking-[0.14em] text-escuro-apagado uppercase">Não pode perder</span>
                  {naoPerder.nome} <span className="text-[13px] font-bold text-escuro-apagado">(CID 10 {naoPerder.cid})</span>
                </p>
                <button type="button" onClick={p.onAvaliarNaoPerder} aria-pressed={p.naoPerderAvaliado}
                  className={`shrink-0 border-[1.5px] border-sobre-escuro px-2 py-px text-[12.5px] font-bold whitespace-nowrap ${p.naoPerderAvaliado ? 'bg-sobre-escuro text-escuro' : 'hover:bg-sobre-escuro/15'}`}>
                  {p.naoPerderAvaliado ? '✓ Avaliado' : 'Marcar avaliado'}
                </button>
              </div>
              <p className="mt-0.5 text-[13.5px] leading-snug">{naoPerder.porque} {naoPerder.como}</p>
            </div>
          )}
          <p className={ROTULO}>Embasamento · da história salva</p>
          <div className="mt-1.5 space-y-2">
            {daIA.map((x) => {
              const f = fase(x.hip.id)
              return (
                <div key={x.hip.id} className={f === 'pronta' ? '' : 'invisible'}>
                  <p className="text-[14px] font-semibold">{x.hip.nome}{x.aviso?.tipo === 'saiu' && <span className="ml-2 text-[12px] font-normal text-apagado">(não sugerida mais)</span>}</p>
                  {x.aviso?.tipo === 'saiu' ? (
                    // o embasamento antigo já não está na história salva: não é mostrado
                    <p className="text-[13.5px] text-apagado">Sem embasamento na história nova.</p>
                  ) : <ul className="text-[13.5px] leading-snug">
                    {x.hip.evidencias.map((e, j) => {
                      const id = `${x.hip.id}-${j}`
                      const aberto = trecho === id
                      return (
                        <li key={id} className="relative">
                          <span className={`inline-block w-4 font-bold ${e.lado === 'favor' ? 'text-(--esp)' : 'text-apagado'}`} aria-label={e.lado === 'favor' ? 'A favor' : 'Contra'}>{e.lado === 'favor' ? '+' : '−'}</span>
                          {e.texto}
                          <button type="button" onClick={() => setTrecho(aberto ? null : id)} aria-expanded={aberto}
                            className="ml-1.5 border border-linha px-1 text-[11px] text-apagado hover:border-tinta hover:text-tinta">
                            {CURTO[e.secao] ?? e.secao}
                          </button>
                          {/* o trecho abre por cima (não empurra a página); toca de novo ou Esc para fechar */}
                          {aberto && (
                            <span role="note" className="absolute top-full left-4 z-10 mt-0.5 block max-w-[min(440px,calc(100%-1rem))] border-[1.5px] border-(--esp-medio) bg-branco px-2.5 py-1 text-[13px] text-tinta italic shadow-md">
                              “{e.trecho}” <span className="not-italic text-apagado">· {e.secao}</span>
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Cartao>
  )
}

function LinhaHipotese({ x, fase, n, primeira, onDecidir, onAviso }: { x: ItemDD; fase: 'pronta' | 'digitando' | 'esperando'; n: number; primeira: boolean; onDecidir: Props['onDecidir']; onAviso: Props['onAviso'] }) {
  const { hip, decisao } = x
  const pct = hip.pct ?? 0
  const ok = decisao === 'confirmada'
  const fora = decisao === 'descartada'
  const pronta = fase === 'pronta'
  // tracejado = sugestão da IA; cheio = decisão do médico. Intensidade pelo %.
  const estilo = ok ? 'border-(--esp) bg-(--esp) text-papel'
    : fora ? 'border-linha bg-suave text-apagado'
    : x.propria ? 'border-tinta bg-branco'
    : pct >= 60 ? 'border-dashed border-(--esp) bg-(--esp-claro)'
    : pct >= 20 ? 'border-dashed border-(--esp-medio) bg-(--esp-claro)/50'
    : 'border-dashed border-(--esp-medio) bg-branco'
  const tag = !pronta ? null : x.propria ? 'Seu' : !primeira && x.mudou ? 'Atualizado' : null

  return (
    <div className={fase === 'esperando' && primeira ? 'invisible' : ''}>
      <div className={`flex min-h-[46px] items-stretch border-[1.5px] transition-colors ${estilo}`}>
        <button type="button" disabled={!pronta} aria-pressed={ok} onClick={() => onDecidir(hip.id, ok ? 'pendente' : 'confirmada')}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-1.5 text-left">
          <span className={`grid size-[18px] shrink-0 place-items-center border-[1.5px] text-[12px] font-extrabold ${ok ? 'border-papel' : 'border-apagado'}`}>{ok ? '✓' : ''}</span>
          <span className={`min-w-0 flex-1 text-[16px] ${fora ? 'line-through' : ''}`}>
            {fase === 'digitando' ? (
              <>
                {hip.nome.slice(0, n)}
                <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-(--esp) align-[-2px]" />
                <span className="invisible">{hip.nome.slice(n)}</span>
              </>
            ) : <span className={fase === 'esperando' ? 'invisible' : ''}>{hip.nome}</span>}
            {hip.cid && <span className={`ml-1.5 text-[13px] font-bold ${ok ? '' : 'text-apagado'} ${pronta ? '' : 'invisible'}`}>(CID 10 {hip.cid})</span>}
            {tag && <span className={`ml-2 border px-1 py-px align-[2px] text-[10px] font-bold tracking-[0.08em] uppercase ${ok ? 'border-papel' : 'border-(--esp) text-(--esp)'}`}>{tag}</span>}
          </span>
          {hip.pct !== null && <span className={`w-12 shrink-0 text-right text-[22px] font-bold tabular-nums ${pronta ? '' : 'invisible'}`}>{hip.pct}%</span>}
        </button>
        <button type="button" disabled={!pronta} onClick={() => onDecidir(hip.id, fora ? 'pendente' : 'descartada')} aria-pressed={fora}
          aria-label={x.propria ? `Retirar ${hip.nome}` : `Descartar ${hip.nome}`}
          className={`w-10 shrink-0 border-l-[1.5px] text-[22px] leading-none ${ok ? 'border-papel/40' : 'border-linha'} ${fora ? 'text-tinta' : 'opacity-60 hover:opacity-100'}`}>
          ×
        </button>
      </div>
      {x.aviso && (
        // a IA não muda a decisão do médico: sugere rever, ao lado
        <div className="flex flex-wrap items-center gap-2 border-[1.5px] border-t-0 border-dashed border-(--esp-medio) bg-(--esp-claro) px-3 py-1 text-[13px]">
          <span className="text-[10px] font-bold tracking-[0.12em] text-(--esp) uppercase">Sugestão da IA</span>
          <span className="flex-1">
            {x.aviso.tipo === 'saiu' ? 'A IA não sugere mais esta hipótese.' : `A história mudou: ${x.aviso.antes}% → ${hip.pct}%.`}
          </span>
          <button type="button" onClick={() => onAviso(hip.id, true)} className={`border border-tinta ${BOTAO_PEQ} hover:bg-branco`}>Manter</button>
          <button type="button" onClick={() => onAviso(hip.id, false)} className={`bg-tinta ${BOTAO_PEQ} text-papel`}>{x.aviso.tipo === 'saiu' ? 'Retirar' : 'Rever'}</button>
        </div>
      )}
    </div>
  )
}

/** "+ Adicionar outro diagnóstico": vira campos de nome e CID (opcional). Enter passa do nome ao CID e do CID adiciona. */
function Adicionar({ onAdicionar }: { onAdicionar: (nome: string, cid: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [cid, setCid] = useState('')
  const refCid = useRef<HTMLInputElement>(null)
  const adicionar = () => {
    if (!nome.trim()) return
    onAdicionar(nome.trim(), cid.trim().toUpperCase())
    setNome(''); setCid(''); setAberto(false)
  }
  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)}
      className="flex min-h-[46px] items-center gap-3 border-[1.5px] border-dashed border-linha px-3 text-[16px] text-apagado hover:border-tinta hover:text-tinta">
      <span className="grid size-[18px] place-items-center border-[1.5px] border-dashed border-current text-[15px] leading-none">+</span>
      Adicionar outro diagnóstico
    </button>
  )
  const caixa = 'border-0 border-b-[1.5px] border-dashed border-apagado bg-transparent px-0.5 py-0.5 text-[16px] leading-snug focus:border-tinta focus:outline-none'
  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-x-3 gap-y-1 border-[1.5px] border-tinta bg-branco px-3 py-1"
      onKeyDown={(e) => { if (e.key === 'Escape') { setAberto(false); setNome(''); setCid('') } }}>
      <span className="size-[18px] shrink-0 border-[1.5px] border-apagado" />
      <CampoLinha autoFocus value={nome} onChange={(e) => setNome(e.target.value)} caixa={caixa} placeholder="Seu diagnóstico" aria-label="Seu diagnóstico" onEnter={() => refCid.current?.focus()} />
      <span className="text-[13px] font-bold whitespace-nowrap text-apagado">
        (CID 10{' '}
        <input ref={refCid} value={cid} onChange={(e) => setCid(e.target.value)} {...SEM_CORRETOR} placeholder="opcional" aria-label="CID 10 (opcional)"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }}
          className="w-[9ch] border-0 border-b-[1.5px] border-dashed border-apagado bg-transparent text-center text-[13px] font-bold uppercase placeholder:font-normal placeholder:normal-case focus:border-tinta focus:outline-none" />)
      </span>
      <button type="button" onClick={adicionar} disabled={!nome.trim()} className={`ml-auto bg-tinta ${BOTAO_PEQ} text-papel disabled:opacity-40`}>Adicionar</button>
    </div>
  )
}
