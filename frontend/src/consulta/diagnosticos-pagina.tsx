// Página 3: diagnósticos diferenciais. A IA escreve 3 hipóteses no ritmo da história (só a partir da
// história salva); o "+" traz mais uma por vez (até 3); o médico confirma, descarta, acrescenta o seu.
// Embasamento: mouse em cima de uma hipótese ainda não decidida mostra as linhas +/− logo abaixo (por cima,
// sem empurrar); no toque (iPad/celular), o 1º toque mostra e o 2º confirma. Decidida, não abre mais.
// À direita, "Para relembrar": o que pesa na conduta, com V/F (o médico só troca a marca).
import { useRef, useState } from 'react'
import { CampoLinha, SEM_CORRETOR } from './campo-linha'
import type { Decisao, ItemDD } from './diagnosticos'
import { useEscrita } from './escrita'
import type { Marca, ItemResumo } from './resumo'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao, ROTULO } from './ui'

const CURTO: Record<string, string> = {
  'Queixa principal': 'Queixa', 'História da doença atual': 'HDA', 'Antecedentes e alertas': 'Antecedentes', 'Exames complementares': 'Exames',
}
const BOTAO_PEQ = 'px-2 py-0.5 text-[12.5px] font-bold'

type Props = {
  itens: ItemDD[]
  /** quantas hipóteses a IA ainda tem para o "+" */
  naReserva: number
  resumo: ItemResumo[]
  /** classes da tarja de alergia (vermelha cheia; contornada quando a cor da especialidade é parecida) */
  alergia: string
  primeira: boolean
  /** retorno: as hipóteses vêm só da evolução de hoje */
  retorno?: boolean
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
  onMais: () => void
  onMarcar: (id: string, m: Marca) => void
  onSalvar: () => void
}

export function PaginaDiagnosticos(p: Props) {
  const { itens, primeira, situacao } = p
  // só as hipóteses que a IA (re)escreveu são escritas, na ordem
  const [fila] = useState(() => itens.filter((x) => x.mudou).map((x) => x.hip.id))
  const [nomesFila] = useState(() => fila.map((id) => itens.find((x) => x.hip.id === id)!.hip.nome))
  const pos = useEscrita(nomesFila, p.animar, p.onEscrito)
  const { escrevendo } = pos
  const salvo = situacao === 'oficializado'
  const [tentou, setTentou] = useState(false)
  const [trecho, setTrecho] = useState<string | null>(null) // trecho da história à mostra (um por vez)
  const [aberta, setAberta] = useState<string | null>(null) // hipótese com o embasamento à mostra (uma por vez)
  const abrir = (id: string | null) => { setAberta(id); setTrecho(null) }

  const daIA = itens.filter((x) => !x.propria)
  const avisos = itens.filter((x) => x.aviso).length
  // o que a IA fez nesta versão (fixo; as sugestões pendentes contam ao vivo)
  const [inicio] = useState(() => ({ atualizadas: itens.filter((x) => x.mudou).length, avisos }))
  const partes = [
    inicio.atualizadas && `${inicio.atualizadas} ${inicio.atualizadas === 1 ? 'hipótese atualizada' : 'hipóteses atualizadas'} com a história nova`,
    avisos && `${avisos} ${avisos === 1 ? 'sugestão' : 'sugestões'} ao lado da sua decisão`,
  ].filter(Boolean)
  const aviso = escrevendo
    ? (primeira ? `A IA está sugerindo hipóteses com ${p.retorno ? 'a evolução de hoje' : 'a história clínica salva'}…` : 'A IA está atualizando só o que mudou…')
    : daIA.length === 0 ? (p.retorno ? 'A IA não encontrou pistas na evolução de hoje. Acrescente o seu diagnóstico.' : 'A IA não tem hipóteses de exemplo para este paciente. Acrescente o seu diagnóstico.')
    : primeira ? `Sugeridas só com ${p.retorno ? 'a evolução de hoje' : 'a história clínica salva'}. Você decide o diagnóstico.`
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
      legenda="Mouse em cima = embasamento · Clique = confirmar · × = descartar · + = mais uma da IA · V/F = sim/não"
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
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[1.15fr_1fr]" aria-busy={escrevendo} onKeyDown={(e) => { if (e.key === 'Escape') { setTrecho(null); setAberta(null) } }}>
        <div className="flex min-w-0 flex-col gap-2">
          <p className={ROTULO}>Hipóteses · toque para confirmar</p>
          {itens.map((x) => (
            <LinhaHipotese key={x.hip.id} x={x} fase={fase(x.hip.id)} n={pos.n} primeira={primeira} onDecidir={p.onDecidir} onAviso={p.onAviso}
              aberta={aberta === x.hip.id} onAbrir={abrir} trecho={trecho} onTrecho={setTrecho} />
          ))}
          {!escrevendo && (
            <div className="flex flex-wrap gap-2">
              {p.naReserva > 0 && (
                <button type="button" onClick={p.onMais}
                  className="flex min-h-[46px] flex-1 items-center gap-3 border-[1.5px] border-dashed border-(--esp-medio) px-3 text-left text-[16px] whitespace-nowrap hover:border-(--esp)">
                  <span className="grid size-[18px] place-items-center border-[1.5px] border-dashed border-(--esp) text-[15px] leading-none text-(--esp)">+</span>
                  Mais uma hipótese da IA
                  <span className="ml-auto text-[13px] font-bold text-apagado" title="Ainda pode chamar">{p.naReserva}</span>
                </button>
              )}
              <Adicionar onAdicionar={p.onAdicionar} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          {/* o que pesa na conduta, da história salva: tudo vai para a conduta com a marca */}
          <div className={`border-[1.5px] border-(--esp-medio) bg-(--esp-claro) px-3 pt-1.5 pb-2 transition-opacity ${escrevendo ? 'opacity-0' : ''}`}>
            <p className={ROTULO}>Para relembrar · da história salva</p>
            <ul className="mt-1 space-y-1">
              {p.resumo.map((x) => (
                <LinhaResumo key={x.id} x={x} alergia={p.alergia} aberto={trecho === `r-${x.id}`}
                  onTrecho={() => setTrecho(trecho === `r-${x.id}` ? null : `r-${x.id}`)} onMarcar={p.onMarcar} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Cartao>
  )
}

type PropsLinha = {
  x: ItemDD; fase: 'pronta' | 'digitando' | 'esperando'; n: number; primeira: boolean; onDecidir: Props['onDecidir']; onAviso: Props['onAviso']
  /** embasamento desta hipótese à mostra */
  aberta: boolean; onAbrir: (id: string | null) => void
  /** trecho da história à mostra (id `${hipótese}-${linha}`) */
  trecho: string | null; onTrecho: (id: string | null) => void
}

function LinhaHipotese({ x, fase, n, primeira, onDecidir, onAviso, aberta, onAbrir, trecho, onTrecho }: PropsLinha) {
  const { hip, decisao } = x
  // embasamento só antes de decidir (e só da IA, com linhas na história salva)
  const podeAbrir = fase === 'pronta' && decisao === 'pendente' && !x.propria && hip.evidencias.length > 0 && x.aviso?.tipo !== 'saiu'
  const mostra = aberta && podeAbrir
  /** o último clique veio de toque (iPad/celular): 1º toque mostra o embasamento, 2º confirma */
  const toque = useRef(false)
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
      <div className="relative"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse' && podeAbrir) onAbrir(hip.id) }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse' && aberta) onAbrir(null) }}>
      <div className={`flex min-h-[46px] items-stretch border-[1.5px] transition-colors ${estilo}`}>
        <button type="button" disabled={!pronta} aria-pressed={ok} aria-expanded={podeAbrir ? mostra : undefined}
          onPointerDown={(e) => { toque.current = e.pointerType !== 'mouse' }}
          onFocus={() => { if (podeAbrir && !toque.current) onAbrir(hip.id) }}
          onClick={() => {
            if (toque.current && podeAbrir && !aberta) return onAbrir(hip.id)
            onAbrir(null)
            onDecidir(hip.id, ok ? 'pendente' : 'confirmada')
          }}
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
      {mostra && (
        // só as linhas +/− (o nome já está na hipótese); abre por cima das de baixo, sem empurrar.
        // Aberta pelo mouse, deixa o mouse passar (não tapa o "+" nem a hipótese de baixo); pelo toque, as fontes são tocáveis.
        <ul role="note" aria-label={`Embasamento de ${hip.nome}`}
          className={`absolute top-full right-0 left-0 z-20 ${toque.current ? '' : 'pointer-events-none'} border-[1.5px] border-t-0 border-dashed border-(--esp-medio) bg-branco px-3 py-1.5 text-[14px] leading-snug shadow-md`}>
          {hip.evidencias.map((e, j) => {
            const id = `${hip.id}-${j}`
            const vendo = trecho === id
            return (
              <li key={id}>
                <span className={`inline-block w-4 font-bold ${e.lado === 'favor' ? 'text-(--esp)' : 'text-apagado'}`} aria-label={e.lado === 'favor' ? 'A favor' : 'Contra'}>{e.lado === 'favor' ? '+' : '−'}</span>
                {e.texto}
                <button type="button" onClick={() => onTrecho(vendo ? null : id)} aria-expanded={vendo}
                  className="ml-1.5 border border-linha px-1 text-[11px] text-apagado hover:border-tinta hover:text-tinta">
                  {CURTO[e.secao] ?? e.secao}
                </button>
                {vendo && <span className="block pl-4 text-[13px] text-tinta italic">“{e.trecho}” <span className="not-italic text-apagado">· {e.secao}</span></span>}
              </li>
            )
          })}
        </ul>
      )}
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

/** Item do "Para relembrar": texto, fonte na história (toque mostra a frase) e V/F. Alergia com V = tarja vermelha. */
function LinhaResumo({ x, alergia, aberto, onTrecho, onMarcar }: { x: ItemResumo; alergia: string; aberto: boolean; onTrecho: () => void; onMarcar: Props['onMarcar'] }) {
  const tarja = x.tipo === 'alergia' && x.marca === 'v'
  const cheia = tarja && alergia.includes('bg-alerta-clinico')
  const naoInformado = x.marcaIA === null
  const fundo = tarja ? alergia : naoInformado ? 'border-[1.5px] border-linha bg-branco text-alerta-clinico' : 'bg-branco'
  return (
    <li className={`relative flex min-h-[30px] items-center gap-2 pr-1 pl-2.5 text-[14px] ${fundo}`}>
      <span title={x.texto} className={`min-w-0 truncate ${x.tipo === 'alergia' ? 'font-semibold' : ''}`}>{x.texto}</span>
      {x.secao && (
        <button type="button" onClick={onTrecho} aria-expanded={aberto}
          className={`shrink-0 border px-1 text-[11px] ${cheia ? 'border-branco/60 text-branco hover:border-branco' : 'border-linha text-apagado hover:border-tinta hover:text-tinta'}`}>
          {CURTO[x.secao] ?? x.secao}
        </button>
      )}
      <span className="ml-auto flex shrink-0 gap-1">
        {!naoInformado && (['v', 'f'] as const).map((m) => {
          const marcado = x.marca === m
          const estilo = marcado ? (cheia ? 'bg-branco text-tinta' : 'bg-tinta text-papel') : cheia ? 'text-branco hover:bg-branco/20' : 'text-tinta hover:bg-suave'
          return (
            <button key={m} type="button" aria-pressed={marcado} aria-label={`${x.texto}: ${m === 'v' ? 'sim' : 'não'}`} onClick={() => { if (!marcado) onMarcar(x.id, m) }}
              className={`size-6 text-[14px] leading-none font-bold ${estilo}`}>
              {m.toUpperCase()}
            </button>
          )
        })}
      </span>
      {aberto && x.trecho && (
        <span role="note" className="absolute top-full left-2.5 z-10 mt-0.5 block max-w-[min(440px,calc(100%-1rem))] border-[1.5px] border-(--esp-medio) bg-branco px-2.5 py-1 text-[13px] font-normal text-tinta italic shadow-md">
          “{x.trecho}” <span className="not-italic text-apagado">· {x.secao}</span>
        </span>
      )}
    </li>
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
      className="flex min-h-[46px] flex-1 items-center gap-3 border-[1.5px] border-dashed border-linha px-3 text-[16px] whitespace-nowrap text-apagado hover:border-tinta hover:text-tinta">
      <span className="grid size-[18px] place-items-center border-[1.5px] border-dashed border-current text-[15px] leading-none">+</span>
      Adicionar outro diagnóstico
    </button>
  )
  const caixa = 'border-0 border-b-[1.5px] border-dashed border-apagado bg-transparent px-0.5 py-0.5 text-[16px] leading-snug focus:border-tinta focus:outline-none'
  return (
    <div className="flex min-h-[46px] basis-full flex-wrap items-center gap-x-3 gap-y-1 border-[1.5px] border-tinta bg-branco px-3 py-1"
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
