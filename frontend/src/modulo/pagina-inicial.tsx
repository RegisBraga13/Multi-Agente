import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { dataLocal, MEDICO_EXEMPLO } from '../medico/exemplo'
import { dataPorExtenso, idade, janelaDeHoje, saudacao, somarDias, vistaDoModulo } from './dia'
import type { Atendimento } from './tipos'
import { useAgora, vistaDoDia } from './vista'

/** Quantos pacientes o cartão "Hoje" mostra, para a página caber numa tela (~690 px). */
const MAX_HOJE = 5

export function PaginaInicialModulo() {
  const { slug = '' } = useParams()
  const esp = buscarEspecialidade(slug)
  if (!esp || esp.status !== 'disponivel') return <NaoEncontrada />
  return <Pagina esp={esp} />
}

const assinarHash = (avisar: () => void) => {
  window.addEventListener('hashchange', avisar)
  return () => window.removeEventListener('hashchange', avisar)
}

function Pagina({ esp }: { esp: Especialidade }) {
  const vista = vistaDoModulo(useSyncExternalStore(assinarHash, () => window.location.hash))
  const agora = useAgora()
  const [dia, setDia] = useState(() => dataLocal(new Date()))
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const medico = MEDICO_EXEMPLO

  const deHoje = useMemo(() => vistaDoDia(dataLocal(agora), agora), [agora])
  const doDia = useMemo(() => vistaDoDia(dia, agora), [dia, agora])
  const atual = vista === 'agenda' ? doDia : deHoje
  const escolhido = atual.lista.find((x) => x.id === selecionado) ?? null

  useEffect(() => {
    document.title = `${esp.raiz}IA · ${vista === 'agenda' ? 'Agenda' : 'Início'}`
  }, [esp, vista])

  // trocar de página ou de dia fecha a ficha aberta
  useEffect(() => setSelecionado(null), [vista, dia])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const painel = escolhido ? (
    <PainelFicha at={escolhido} agora={agora} onFechar={() => setSelecionado(null)} onProntuario={() => setAviso('O prontuário é uma das próximas etapas do módulo.')} />
  ) : (
    <CartaoFichas prontas={atual.fichasProntas} faltam={atual.semFicha} />
  )

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="min-h-screen bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 sm:px-6">
        <a href="#" className="flex items-baseline gap-2.5 no-underline" aria-label={`${esp.raiz}IA, início`}>
          <Marca className="text-[20px]" />
          <NomeModulo esp={esp} className="text-[24px]" />
        </a>
        <span className="ml-auto grid size-10 place-items-center bg-tinta text-[14px] font-bold text-papel" title={`${medico.tratamento} ${medico.nome}`} aria-hidden="true">
          {iniciais(medico.nome)}
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-3 pb-8 sm:px-6">
        {vista === 'inicio' ? (
          <>
            <p className="text-[12px] font-bold tracking-[0.12em] text-apagado uppercase">
              {dataPorExtenso(deHoje.hoje)} · {deHoje.lista.length} {deHoje.lista.length === 1 ? 'paciente' : 'pacientes'}
            </p>
            <h1 className="mt-1 text-[clamp(30px,4vw,44px)] leading-[1.1] font-semibold">
              {saudacao(agora)}, {medico.tratamento} {medico.nome}
            </h1>
            <Cartoes onEscolher={(o) => setAviso(`${o} é a próxima etapa do módulo.`)} />
            <Grade lado={painel}>
              <ListaDeHoje vista={deHoje} selecionado={selecionado} onSelecionar={setSelecionado} />
            </Grade>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a href="#" className="text-[15px] font-semibold underline decoration-linha underline-offset-4 hover:text-(--esp)">← Início</a>
              <h1 className="text-[clamp(26px,3vw,34px)] leading-tight font-semibold">Agenda</h1>
              <nav aria-label="Dia da agenda" className="ml-auto flex items-center gap-1">
                {!doDia.ehHoje && (
                  <button type="button" onClick={() => setDia(deHoje.hoje)} className="mr-2 border-[1.5px] border-linha bg-branco px-3 py-1.5 text-[14px] font-semibold hover:border-tinta">Hoje</button>
                )}
                <button type="button" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="px-2.5 py-1 text-[22px] leading-none hover:text-(--esp)">‹</button>
                <span className="min-w-[200px] text-center text-[16px] font-semibold" aria-live="polite">{dataPorExtenso(dia)}</span>
                <button type="button" onClick={() => setDia(somarDias(dia, 1))} aria-label="Dia seguinte" className="px-2.5 py-1 text-[22px] leading-none hover:text-(--esp)">›</button>
              </nav>
            </div>
            <Grade lado={painel}>
              <ListaDoDia vista={doDia} selecionado={selecionado} onSelecionar={setSelecionado} />
            </Grade>
          </>
        )}
      </main>

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        {aviso && <p className="bg-tinta px-5 py-3 text-[15px] font-medium text-papel shadow-lg">{aviso}</p>}
      </div>
    </div>
  )
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/** Lista à esquerda, painel à direita; os dois com a mesma altura (alinhados no topo e na base). */
function Grade({ lado, children }: { lado: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_300px]">
      {children}
      {lado}
    </div>
  )
}

const CARTOES = [
  { n: '01', rotulo: 'Nova', titulo: 'Consulta', texto: 'Iniciar uma consulta nova', estilo: 'bg-petroleo text-papel' },
  { n: '02', rotulo: 'Evolução', titulo: 'Retorno', texto: 'Evolução de uma consulta', estilo: 'bg-[color-mix(in_oklab,var(--esp)_55%,var(--color-papel))] text-tinta' },
  { n: '03', rotulo: 'Histórico', titulo: 'Prontuário', texto: 'Abrir o histórico de um paciente', estilo: 'bg-(--esp) text-papel' },
] as const

function Cartoes({ onEscolher }: { onEscolher: (titulo: string) => void }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {CARTOES.map((c) => (
        <button key={c.n} type="button" onClick={() => onEscolher(c.titulo)} className={`flex flex-col px-5 py-3.5 text-left transition hover:-translate-y-0.5 ${c.estilo}`}>
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-85">{c.n} · {c.rotulo}</span>
          <span className="mt-3 font-titulo text-[30px] leading-none font-semibold">{c.titulo}</span>
          <span className="mt-1.5 text-[14px] opacity-90">{c.texto}</span>
        </button>
      ))}
    </div>
  )
}

function CartaoLista({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-linha bg-branco" aria-label={titulo}>
      <div className="flex items-baseline justify-between gap-4 border-b border-linha px-5 py-3">
        <h2 className="text-[22px] font-semibold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

type PropsLista = { selecionado: string | null; onSelecionar: (id: string) => void }

function ListaDeHoje({ vista, selecionado, onSelecionar }: PropsLista & { vista: ReturnType<typeof vistaDoDia> }) {
  const { atendidos, visiveis, restantes } = janelaDeHoje(vista.lista, MAX_HOJE)
  const resumo = [atendidos > 0 && `${atendidos} ${atendidos === 1 ? 'atendido' : 'atendidos'}`, restantes > 0 && `+${restantes} depois`].filter(Boolean).join(' · ')
  return (
    <CartaoLista
      titulo="Hoje"
      extra={
        <span className="flex items-baseline gap-4 text-[14px]">
          {resumo && <span className="text-apagado">{resumo}</span>}
          <a href="#agenda" className="text-[12px] font-bold tracking-[0.1em] uppercase underline underline-offset-4 hover:text-(--esp)">Ver agenda</a>
        </span>
      }
    >
      {visiveis.length === 0 ? (
        <p className="px-5 py-8 text-center text-[16px] text-apagado">
          {vista.lista.length === 0 ? 'Nenhum paciente hoje.' : 'Todos os pacientes de hoje foram atendidos.'}
        </p>
      ) : (
        <Linhas lista={visiveis} proximo={vista.proximo} selecionado={selecionado} onSelecionar={onSelecionar} />
      )}
    </CartaoLista>
  )
}

function ListaDoDia({ vista, selecionado, onSelecionar }: PropsLista & { vista: ReturnType<typeof vistaDoDia> }) {
  const n = vista.lista.length
  return (
    <CartaoLista titulo={vista.ehHoje ? 'Hoje' : 'Pacientes do dia'} extra={n > 0 && <span className="text-[14px] text-apagado">{n} {n === 1 ? 'paciente' : 'pacientes'}{vista.atendidos > 0 && ` · ${vista.atendidos} ${vista.atendidos === 1 ? 'atendido' : 'atendidos'}`}</span>}>
      {n === 0 ? (
        <p className="px-5 py-8 text-center text-[16px] text-apagado">Nenhum paciente neste dia.</p>
      ) : (
        <Linhas compacta lista={vista.lista} proximo={vista.proximo} selecionado={selecionado} onSelecionar={onSelecionar} />
      )}
    </CartaoLista>
  )
}

/** `compacta`: a agenda do dia inteiro, com linhas mais baixas para caber numa tela. */
function Linhas({ lista, proximo, selecionado, onSelecionar, compacta = false }: PropsLista & { lista: Atendimento[]; proximo: string | null; compacta?: boolean }) {
  // realce: o paciente aberto; sem nenhum aberto, o próximo
  const realce = selecionado ?? proximo
  return (
    <ol>
      {lista.map((x) => (
        <li key={x.id} className="border-b border-linha last:border-b-0">
          <button
            type="button"
            onClick={() => onSelecionar(x.id)}
            aria-pressed={x.id === selecionado}
            className={`grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-4 px-5 ${compacta ? 'py-[5px]' : 'py-2'} text-left transition hover:bg-suave/60 ${x.id === realce ? 'bg-[color-mix(in_oklab,var(--esp)_14%,white)] hover:bg-[color-mix(in_oklab,var(--esp)_18%,white)]' : ''} ${x.atendido ? 'text-apagado' : ''}`}
          >
            <span className="text-[17px] font-bold tabular-nums">{x.inicio}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[16px] font-semibold">{x.paciente.nome}</span>
                {x.id === proximo && <span className="shrink-0 bg-tinta px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-papel uppercase">Próximo</span>}
              </span>
              <span className="block truncate text-[13.5px] leading-snug text-apagado">
                {x.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · {x.modalidade === 'online' ? 'Online' : 'Presencial'} · {x.pagamento}
              </span>
            </span>
            {x.atendido ? <span className="text-[13px]">Atendido</span> : <EtiquetaFicha situacao={x.ficha.situacao} />}
          </button>
        </li>
      ))}
    </ol>
  )
}

function EtiquetaFicha({ situacao }: { situacao: Atendimento['ficha']['situacao'] }) {
  if (situacao === 'pronta') return <span className="w-[104px] border-[1.5px] border-petroleo py-0.5 text-center text-[12.5px] font-semibold text-petroleo">Ficha pronta</span>
  return (
    <span className="w-[104px] border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--esp)_45%,white)] py-0.5 text-center text-[12.5px] font-medium text-[color-mix(in_oklab,var(--esp)_75%,black)]">
      {situacao === 'link-enviado' ? 'Link enviado' : 'Sem ficha'}
    </span>
  )
}

function CartaoFichas({ prontas, faltam }: { prontas: number; faltam: number }) {
  return (
    <aside className="self-start bg-escuro px-5 py-5 text-sobre-escuro" aria-label="Fichas de pré-consulta">
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase">Fichas de pré-consulta</p>
      <p className="mt-2 font-titulo text-[56px] leading-none font-semibold text-papel">{prontas}</p>
      <p className="mt-2 text-[14px] text-escuro-apagado">
        {prontas === 1 ? 'pronta' : 'prontas'} para o dia{faltam > 0 && ` · ${faltam} ainda sem ficha`}
      </p>
    </aside>
  )
}

const ROTULO = 'text-[11px] font-bold tracking-[0.14em] text-apagado uppercase'

function PainelFicha({ at, agora, onFechar, onProntuario }: { at: Atendimento; agora: Date; onFechar: () => void; onProntuario: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 767px)').matches) titulo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [at.id])
  const f = at.ficha
  return (
    <aside className="relative border border-linha bg-branco px-5 py-4" aria-label="Ficha do paciente">
      <button type="button" onClick={onFechar} aria-label="Fechar ficha" className="absolute top-2 right-2 px-2 text-[22px] leading-none text-apagado hover:text-tinta">×</button>
      <p className={ROTULO}>{f.situacao === 'pronta' ? `Ficha recebida · ${f.recebidaAs}` : `Paciente das ${at.inicio}`}</p>
      <h2 ref={titulo} tabIndex={-1} className="mt-1 pr-6 text-[22px] leading-tight font-semibold outline-none">{at.paciente.nome}</h2>
      <p className="mt-0.5 text-[14px] text-apagado">{idade(at.paciente.nascimento, agora)} anos · {at.pagamento}</p>

      {f.situacao === 'pronta' ? (
        <div className="mt-3 space-y-2.5 text-[14.5px] leading-snug">
          {f.alergias.length > 0 ? (
            f.alergias.map((a) => (
              <div key={a.substancia} className="border-[1.5px] border-alerta px-3 py-1.5">
                <p className="text-[11px] font-bold tracking-[0.14em] text-alerta uppercase">Alergia</p>
                <p><b className="text-[16px] text-alerta">{a.substancia}</b> <span className="text-alerta">· {a.reacao}</span></p>
              </div>
            ))
          ) : (
            <p><span className={ROTULO}>Alergias</span> <span className="ml-1">nenhuma informada</span></p>
          )}
          <Bloco rotulo="Queixa">{f.queixa}</Bloco>
          {f.emUso.length > 0 && <Bloco rotulo="Em uso">{f.emUso.join(' · ')}</Bloco>}
          {f.antecedentes.length > 0 && <Bloco rotulo="Antecedentes">{f.antecedentes.join(' · ')}</Bloco>}
          <p className="border-t border-linha pt-2 text-[14px]">Transcrição: <b>{f.transcricao}</b></p>
        </div>
      ) : (
        <p className="mt-3 text-[14.5px]">
          {f.situacao === 'link-enviado' ? 'O link da ficha foi enviado. O paciente ainda não preencheu.' : 'Este paciente ainda não tem ficha da pré-consulta.'}
        </p>
      )}

      {at.temHistorico && (
        <button type="button" onClick={onProntuario} className="mt-3 text-[14px] font-semibold underline decoration-linha underline-offset-4 hover:text-(--esp) hover:decoration-(--esp)">
          Prontuário
        </button>
      )}
    </aside>
  )
}

function Bloco({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <p className={ROTULO}>{rotulo}</p>
      <p>{children}</p>
    </div>
  )
}
