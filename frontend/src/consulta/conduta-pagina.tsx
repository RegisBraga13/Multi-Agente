// Página 4: conduta e tratamento. À esquerda, os grupos fechados (só o título, como as hipóteses do DD):
// clique no título abre as opções que a IA sugeriu, por cima dos grupos de baixo (sem empurrar); o médico
// escolhe e clica de novo no título para fechar. Ao fechar, a seção aparece no quadro da direita
// ("Conduta gerada automaticamente"), escrita ao vivo, e o médico pode editar o texto ali mesmo.
// Parte só dos diagnósticos salvos + "Para relembrar".
import { useEffect, useRef, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import { CampoLinha, SEM_CORRETOR } from './campo-linha'
import { GRUPOS_CONDUTA, KIT_ROTINA, LINHAS_MULTIPLAS, OUTRO, type Conduta } from './conduta'
import { textoDaFaixa, textoDaRetirada } from './conduta-servidor'
import type { ItemResumo } from './resumo'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao } from './ui'

const ROTULO_GRUPO = 'text-[10.5px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const TEXTO = 'text-[14.5px] leading-[1.4] text-tinta'
// ritmo da landing: 3 letras a cada 33 ms
const LETRAS = 3
const MS = 33

type Props = {
  conduta: Conduta
  /** "Para relembrar" salvo nos diagnósticos (as alergias aparecem no topo, como na landing) */
  resumo: ItemResumo[]
  alergia: string
  especialidade: string
  primeira: boolean
  situacao: Situacao
  podeSalvar: boolean
  pendencia: string | null
  onEscolher: (linha: string, opcao: string) => void
  /** texto do campo "Outro" da linha */
  onOutro: (linha: string, texto: string) => void
  onRevelar: (i: number) => void
  onEditar: (i: number, texto: string) => void
  onSalvar: () => void
  /** consulta real: faixa vermelha de urgência (a ação de emergência é fixa, vem do servidor) */
  urgencia?: { nivel: 'prioritaria' | 'imediata'; acoes: string[] } | null
  /** consulta real: opções que o servidor retirou por contraindicação, com o motivo */
  retiradas?: { rotulo: string; motivo: string }[]
}

export function PaginaConduta(p: Props) {
  const { conduta: c, primeira } = p
  const rotulos = c.grupos?.map((g) => g.rotulo) ?? GRUPOS_CONDUTA
  const [aberto, setAberto] = useState<number | null>(null)
  const [tentou, setTentou] = useState(false)
  const alergias = p.resumo.filter((x) => x.tipo === 'alergia')

  // escrita ao vivo da seção que acabou de aparecer (ou mudou) à direita
  const [digita, setDigita] = useState<{ i: number; n: number } | null>(null)
  const mostrado = useRef<string[]>(c.revelado.map((r, i) => (r ? c.textos[i] : '')))
  useEffect(() => {
    if (!digita) return
    const t = setTimeout(() => setDigita(digita.n + LETRAS >= c.textos[digita.i].length ? null : { i: digita.i, n: digita.n + LETRAS }), MS)
    return () => clearTimeout(t)
  }, [digita, c.textos])

  /** fecha o grupo aberto: a seção aparece à direita (escrita de novo só se o texto mudou) */
  const fechar = () => {
    if (aberto === null) return
    const i = aberto
    setAberto(null)
    p.onRevelar(i)
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (c.textos[i] && c.textos[i] !== mostrado.current[i] && !reduz) setDigita({ i, n: 0 })
    mostrado.current[i] = c.textos[i]
  }
  const alternar = (i: number) => {
    if (aberto === i) return fechar()
    fechar()
    setAberto(i)
  }

  const aviso = !c.grupos ? 'A IA não tem conduta de exemplo para este diagnóstico. Escreva a sua.'
    : primeira ? 'Opções sugeridas só com os diagnósticos salvos e o "Para relembrar". Abra cada grupo e escolha.'
    : 'Diagnósticos salvos de novo: a sugestão foi refeita; suas escolhas ficaram.'

  return (
    <Cartao
      titulo="Conduta e tratamento"
      fundo="bg-historia"
      linha="border-historia-borda"
      cabecalho={<p className="flex-1 text-center text-[13.5px] text-tinta">{aviso}</p>}
      legenda={c.grupos ? 'Clique no título = abrir/fechar · sistêmico e encaminhamento: mais de um · texto editável' : 'Texto editável'}
      rodape={
        <BotaoOficializar
          rotulo="Salvar conduta"
          oficializado={p.situacao === 'oficializado'}
          bloqueado={digita !== null || aberto !== null || !p.podeSalvar}
          motivo={tentou && p.pendencia ? p.pendencia : undefined}
          onClick={() => (p.pendencia ? setTentou(true) : p.onSalvar())}
        />
      }
    >
      {p.urgencia && (
        <p role="alert" className="mb-2 bg-alerta-clinico px-3 py-1 text-[14px] leading-snug font-semibold text-papel">{textoDaFaixa(p.urgencia)}</p>
      )}
      {p.retiradas?.map((r) => <p key={r.rotulo} className="mb-1 text-[12.5px] text-apagado">{textoDaRetirada(r)}</p>)}
      {/* como na landing: especialidade / conduta · diagnóstico, e a alergia ao lado */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] text-tinta">
          {p.especialidade} / Conduta · <b>{c.diagnostico.nome}</b>
          {c.diagnostico.cid && <span className="ml-1.5 text-[13px] font-bold text-apagado">(CID 10 {c.diagnostico.cid})</span>}
        </p>
        <span className="flex flex-wrap gap-1.5">
          {alergias.map((a) => (
            <span key={a.id} className={`px-2.5 py-0.5 text-[13px] font-semibold ${a.marca === 'v' ? p.alergia : a.marcaIA === null ? 'border-[1.5px] border-linha bg-branco text-alerta-clinico' : 'bg-branco text-tinta'}`}>
              {a.marca === 'f' ? 'Nega alergias' : a.texto}
            </span>
          ))}
        </span>
      </div>

      <div className={`grid flex-1 gap-x-6 gap-y-3 ${c.grupos ? 'lg:grid-cols-[1fr_1.15fr]' : ''}`} onKeyDown={(e) => { if (e.key === 'Escape') fechar() }}>
        {c.grupos && (
          <div className="flex min-w-0 flex-col gap-2">
            {c.grupos.map((g, i) => {
              const abre = aberto === i
              const feito = c.revelado[i]
              const motivos = [...new Set(g.linhas.map((l) => c.motivo[l.id]).filter(Boolean))]
              return (
                <div key={g.id} className={`relative ${abre ? 'z-20' : ''}`}>
                  <button type="button" aria-expanded={abre} onClick={() => alternar(i)}
                    className={`flex min-h-[46px] w-full items-center gap-3 border-[1.5px] px-3 py-1.5 text-left transition-colors ${feito ? 'border-(--esp) bg-(--esp-claro)' : 'border-dashed border-historia-borda bg-branco hover:border-tinta'}`}>
                    <span className={`grid size-[18px] shrink-0 place-items-center border-[1.5px] text-[12px] font-extrabold ${feito ? 'border-(--esp) text-(--esp)' : 'border-apagado'}`}>{feito ? '✓' : ''}</span>
                    <span className="min-w-0 flex-1 text-[16px] font-semibold">{g.rotulo.replace(/^\d+\.\s*/, '')}</span>
                    {motivos.map((m) => <span key={m} title="Do Para relembrar" className="truncate text-[11.5px] text-historia-rotulo">{m}</span>)}
                    <span className="shrink-0 text-[13px] text-apagado" aria-hidden>{abre ? '▴' : '▾'}</span>
                  </button>
                  {abre && (
                    // as opções sugeridas pela IA, por cima dos grupos de baixo (sem empurrar); nenhuma vem marcada
                    <div className="absolute top-full right-0 left-0 flex flex-col gap-1.5 border-[1.5px] border-t-0 border-historia-borda bg-branco px-3 py-2 shadow-md">
                      {g.linhas.map((l) => (
                        <div key={l.id} className={l.rotulo ? 'flex items-baseline gap-2' : ''}>
                          {l.rotulo && <span className="w-[112px] shrink-0 text-[12.5px] font-semibold text-historia-rotulo">{l.rotulo}</span>}
                          <div className="flex flex-wrap items-center gap-1">
                            {l.opcoes.map((o) => {
                              const sel = c.escolha[l.id]?.includes(o.id) ?? false
                              return (
                                <button key={o.id} type="button" aria-pressed={sel} onClick={() => p.onEscolher(l.id, o.id)}
                                  title={o.id === 'kit' ? KIT_ROTINA.join(', ') : undefined}
                                  className={`border-[1.5px] px-2 py-1 text-[13.5px] leading-tight transition-colors ${sel ? 'border-(--esp) bg-(--esp-medio) font-semibold' : 'border-dashed border-historia-borda bg-branco hover:border-tinta'}`}>
                                  {o.rotulo}
                                </button>
                              )
                            })}
                            {c.escolha[l.id]?.includes(OUTRO) && (
                              // "Outro" marcado: o médico escreve; entra na frase da conduta
                              <CampoLinha autoFocus value={c.outros[l.id] ?? ''} onChange={(e) => p.onOutro(l.id, e.target.value)} onEnter={() => {}}
                                caixa="border-0 border-b-[1.5px] border-dashed border-apagado bg-transparent px-0.5 py-0.5 text-[13.5px] leading-tight focus:border-tinta focus:outline-none"
                                placeholder="Escreva aqui" aria-label={`Outro: ${l.rotulo ?? g.rotulo}`} />
                            )}
                          </div>
                        </div>
                      ))}
                      {g.linhas.map((l) => LINHAS_MULTIPLAS[l.id] && <p key={l.id} className="text-[12px] text-apagado">{LINHAS_MULTIPLAS[l.id]}</p>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[10.5px] font-bold tracking-[0.12em] text-historia-rotulo uppercase">Conduta gerada automaticamente</p>
          <div className="flex flex-1 flex-col gap-1.5 border-[1.5px] border-historia-borda px-4 py-2.5">
            <p className="text-[11.5px] font-bold tracking-[0.06em] uppercase">Conduta — {c.diagnostico.nome}</p>
            {!c.revelado.some(Boolean) && <p className="text-[13.5px] text-apagado">Cada seção aparece aqui ao fechar o grupo.</p>}
            {rotulos.map((rotulo, i) => {
              if (!c.revelado[i]) return null
              return (
                <div key={rotulo}>
                  <p className={ROTULO_GRUPO}>{rotulo}</p>
                  {digita?.i === i ? (
                    // durante a escrita, o resto fica invisível, reservando o espaço (nada "pula")
                    <p className={TEXTO} aria-hidden>
                      <span>{c.textos[i].slice(0, digita.n)}</span>
                      <span className="ml-px inline-block h-[1em] w-0.5 animate-pulse bg-tinta align-[-2px]" />
                      <span className="invisible">{c.textos[i].slice(digita.n)}</span>
                    </p>
                  ) : (
                    <TextoCrescente
                      {...SEM_CORRETOR}
                      value={c.textos[i]}
                      onChange={(e) => p.onEditar(i, e.target.value)}
                      aria-label={rotulo}
                      placeholder={!c.grupos ? 'Escreva aqui' : c.grupos[i]?.linhas.some((l) => l.id === 'sistemico') ? 'Sem tratamento sistêmico' : 'Nada escolhido'}
                      className={`${TEXTO} -mx-1 block w-[calc(100%+0.5rem)] bg-transparent px-1 placeholder:text-apagado hover:bg-branco/35 focus:bg-branco/60 focus:outline-none`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Cartao>
  )
}
