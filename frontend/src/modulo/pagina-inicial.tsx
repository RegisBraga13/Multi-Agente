import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { estiloAlergia } from '../alergia'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { dataLocal, MEDICO_EXEMPLO } from '../medico/exemplo'
import { dataPorExtenso, idade, janelaDeHoje, saudacao, somarDias, vistaDoModulo } from './dia'
import type { Atendimento } from './tipos'
import { abrirJanelaProntuario } from '../prontuario/registro'
import { reiniciarPaciente } from '../prontuario/chave'
import { MARIANA } from './exemplo'
import { retornoParaAbrir, useAgora, vistaDoDia } from './vista'
import { linkWhatsapp } from '../medico/duvidas'
import { formatarWhatsapp } from '../medico/regras'
import type { Medico } from '../medico/tipos'
import { cancelarPedido, confirmarPedido, marcarLinkEnviado, pedidosDaAgenda, retornosDaAgenda, type PedidoNaAgenda, type RetornoNaAgenda } from '../servidor/agenda'
import { lembrarHoje, mensagemDaConfirmacao, mensagemDoAviso, mensagemDoFormulario, mensagemDoLembrete } from './pedidos'

/** Quantos pacientes o cartão "Hoje" mostra, para a página caber numa tela (~690 px). */
const MAX_HOJE = 5

/** Altura dos três cartões e do cartão de fichas (ficam iguais). */
const ALTURA_CARTAO = 'h-[68px]'

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
  // aviso trazido de outra página (ex.: "Consulta finalizada" ao salvar o prontuário)
  const [aviso, setAviso] = useState<string | null>((useLocation().state as { aviso?: string } | null)?.aviso ?? null)
  const medico = MEDICO_EXEMPLO
  const navegar = useNavigate()

  // pedidos feitos na página do médico (servidor), renovados a cada 10 s; sem servidor, só o exemplo
  const [pedidos, setPedidos] = useState<PedidoNaAgenda[]>([])
  // retornos marcados ao finalizar uma consulta (cartão "Retorno")
  const [retornos, setRetornos] = useState<RetornoNaAgenda[]>([])
  const recarregar = useMemo(() => () => {
    const hoje = dataLocal(new Date())
    pedidosDaAgenda(somarDias(hoje, -7), somarDias(hoje, 45)).then(setPedidos, () => {})
    retornosDaAgenda(somarDias(hoje, -7), somarDias(hoje, 45)).then(setRetornos, () => {})
  }, [])
  useEffect(() => {
    recarregar()
    const t = setInterval(recarregar, 10_000)
    return () => clearInterval(t)
  }, [recarregar])

  const deHoje = useMemo(() => vistaDoDia(dataLocal(agora), agora, pedidos, retornos), [agora, pedidos, retornos])
  const doDia = useMemo(() => vistaDoDia(dia, agora, pedidos, retornos), [dia, agora, pedidos, retornos])
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

  // Conteúdo centralizado na altura. A posição é calculada com a ficha fechada e mantida ao abrir,
  // para o bloco não "pular"; só sobe se a ficha aberta não couber.
  const topo = useRef<HTMLElement>(null)
  const rodape = useRef<HTMLElement>(null)
  const bloco = useRef<HTMLDivElement>(null)
  const guardado = useRef(0)
  const [margem, setMargem] = useState(0)
  const aberto = escolhido !== null
  useLayoutEffect(() => {
    const calcular = () => {
      if (!topo.current || !rodape.current || !bloco.current) return
      const livre = window.innerHeight - topo.current.offsetHeight - rodape.current.offsetHeight - bloco.current.offsetHeight - ESPACO_MAIN
      if (!aberto) guardado.current = Math.max(0, livre / 2)
      setMargem(aberto ? Math.max(0, Math.min(guardado.current, livre)) : guardado.current)
    }
    calcular()
    const obs = new ResizeObserver(calcular)
    if (bloco.current) obs.observe(bloco.current)
    window.addEventListener('resize', calcular)
    return () => { obs.disconnect(); window.removeEventListener('resize', calcular) }
  }, [aberto, vista])

  const painel = escolhido ? (
    <PainelFicha
      classeAlergia={estiloAlergia(esp)} at={escolhido} agora={agora} onFechar={() => setSelecionado(null)} onProntuario={() => abrirJanelaProntuario(esp.slug, escolhido.prontuarioDe ?? escolhido.paciente.id)}
      pedido={pedidos.find((p) => p.id === escolhido.pedido?.id)} medico={medico}
      onLinkEnviado={(id) => { marcarLinkEnviado(id).then(recarregar, () => setAviso('Não foi possível marcar o envio. Tente de novo.')) }}
      onConfirmar={(id) => { confirmarPedido(id).then(recarregar, () => setAviso('Não foi possível confirmar. Tente de novo.')) }}
      onAvisar={(id) => { setSelecionado(null); cancelarPedido(id).then(recarregar, () => setAviso('Não foi possível cancelar. Tente de novo.')) }}
      onAbrirConsulta={() => navegar(`/modulo/${esp.slug}/consulta/${escolhido.id}/anamnese-exame`)}
    />
  ) : (
    <CartaoFichas prontas={atual.fichasProntas} faltam={atual.semFicha} />
  )

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header ref={topo} className="mx-auto w-full max-w-6xl px-4 pt-2.5 sm:px-6">
        <a href="#" className="no-underline" aria-label={`${esp.raiz}IA, início`}>
          <NomeModulo esp={esp} className="text-[26px]" />
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 sm:px-6">
        <div ref={bloco} style={{ marginTop: margem }}>
        {vista === 'inicio' ? (
          <>
            <p className="text-[12px] font-bold tracking-[0.12em] text-apagado uppercase">
              {dataPorExtenso(deHoje.hoje)} · {deHoje.lista.length} {deHoje.lista.length === 1 ? 'paciente' : 'pacientes'}
            </p>
            <h1 className="mt-1 text-[clamp(30px,4vw,44px)] leading-[1.1] font-semibold">
              {saudacao(agora)}, {medico.tratamento} {medico.nome}
            </h1>
            <Cartoes onEscolher={(o) => {
              if (o === 'Retorno') {
                // retorno aberto na ficha; senão, o próximo retorno de hoje: abre na Evolução
                const retorno = retornoParaAbrir(deHoje.lista, selecionado)
                if (retorno) navegar(`/modulo/${esp.slug}/consulta/${retorno}/anamnese-exame`)
                else setAviso('Nenhum retorno a seguir hoje.')
                return
              }
              // prontuários: de quem já terminou uma consulta ou retorno; o médico acessa a qualquer hora
              if (o === 'Prontuário') return navegar(`/modulo/${esp.slug}/prontuarios`)
              if (o !== 'Consulta') return setAviso(`${o} é a próxima etapa do módulo.`)
              // consulta do paciente aberto na ficha; sem nenhum aberto, do próximo
              const id = selecionado ?? deHoje.proximo
              if (id) navegar(`/modulo/${esp.slug}/consulta/${id}/anamnese-exame`)
              else setAviso('Nenhum paciente a seguir hoje.')
            }} />
            <Grade lado={painel}>
              <ListaDeHoje vista={deHoje} selecionado={selecionado} onSelecionar={setSelecionado} />
            </Grade>
          </>
        ) : (
          // agenda do dia inteiro: a troca de dia fica no cabeçalho do próprio cartão (não sobra linha a mais)
          <Grade lado={painel} semMargem>
            <ListaDoDia
              vista={doDia}
              selecionado={selecionado}
              onSelecionar={setSelecionado}
              cabecalho={
                <nav aria-label="Dia da agenda" className="flex items-center gap-1">
                  <button type="button" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="-ml-2 px-2 py-1 text-[22px] leading-none hover:text-(--esp)">‹</button>
                  <h1 className="min-w-[230px] text-center text-[20px] font-semibold" aria-live="polite">{dataPorExtenso(dia)}</h1>
                  <button type="button" onClick={() => setDia(somarDias(dia, 1))} aria-label="Dia seguinte" className="px-2 py-1 text-[22px] leading-none hover:text-(--esp)">›</button>
                  {!doDia.ehHoje && (
                    <button type="button" onClick={() => setDia(deHoje.hoje)} className="ml-2 border-[1.5px] border-linha px-2.5 py-1 text-[13px] font-semibold hover:border-tinta">Hoje</button>
                  )}
                </nav>
              }
            />
          </Grade>
        )}
        </div>
      </main>

      <footer ref={rodape} className="py-3 text-center">
        <Marca className="text-[17px]" />
      </footer>

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        {aviso && <p className="bg-tinta px-5 py-3 text-[15px] font-medium text-papel shadow-lg">{aviso}</p>}
      </div>
    </div>
  )
}

/** py-3 do <main> (em cima e embaixo). */
const ESPACO_MAIN = 24

/** Lista à esquerda, painel à direita; os dois com a mesma altura (alinhados no topo e na base). */
function Grade({ lado, children, semMargem = false }: { lado: ReactNode; children: ReactNode; semMargem?: boolean }) {
  return (
    <div className={`${semMargem ? '' : 'mt-4'} grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_300px]`}>
      {children}
      {lado}
    </div>
  )
}

const CARTOES = [
  { titulo: 'Consulta', estilo: 'bg-petroleo text-papel' },
  { titulo: 'Retorno', estilo: 'bg-(--esp-medio) text-tinta' },
  { titulo: 'Prontuário', estilo: 'bg-(--esp) text-papel' },
] as const

function Cartoes({ onEscolher }: { onEscolher: (titulo: string) => void }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {CARTOES.map((c) => (
        <button key={c.titulo} type="button" onClick={() => onEscolher(c.titulo)} className={`flex items-center px-6 text-left font-titulo text-[30px] leading-none font-semibold transition hover:-translate-y-0.5 ${ALTURA_CARTAO} ${c.estilo}`}>
          {c.titulo}
        </button>
      ))}
    </div>
  )
}

/** `cabecalho` substitui o título simples (ex.: a troca de dia da agenda). */
function CartaoLista({ titulo, cabecalho, extra, children }: { titulo: string; cabecalho?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="border border-linha bg-branco" aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linha px-5 py-2.5">
        {cabecalho ?? <h2 className="text-[22px] font-semibold">{titulo}</h2>}
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
          {/* demonstração: apaga o prontuário da Mariana e a agenda volta a mostrá-la para a primeira consulta */}
          <button type="button" className="text-[12px] font-bold tracking-[0.1em] uppercase underline underline-offset-4 hover:text-(--esp)"
            onClick={() => { if (window.confirm('Reiniciar a demonstração? O prontuário da Mariana Costa será apagado e o caso recomeça na primeira consulta.')) { reiniciarPaciente(MARIANA); window.location.reload() } }}>
            Reiniciar demonstração
          </button>
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

function ListaDoDia({ vista, selecionado, onSelecionar, cabecalho }: PropsLista & { vista: ReturnType<typeof vistaDoDia>; cabecalho: ReactNode }) {
  const n = vista.lista.length
  return (
    <CartaoLista
      titulo="Agenda do dia"
      cabecalho={cabecalho}
      extra={
        <span className="flex items-baseline gap-4 text-[14px]">
          {n > 0 && <span className="text-apagado">{n} {n === 1 ? 'paciente' : 'pacientes'}{vista.atendidos > 0 && ` · ${vista.atendidos} ${vista.atendidos === 1 ? 'atendido' : 'atendidos'}`}</span>}
          <a href="#" className="text-[12px] font-bold tracking-[0.1em] uppercase underline underline-offset-4 hover:text-(--esp)">Início</a>
        </span>
      }
    >
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
            className={`grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-4 px-5 ${compacta ? 'py-[5px]' : 'py-2'} text-left transition hover:bg-suave/60 ${x.id === realce ? 'bg-(--esp-claro) hover:bg-suave' : ''} ${x.atendido ? 'text-apagado' : ''}`}
          >
            <span className="text-[17px] font-bold tabular-nums">{x.inicio}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[16px] font-semibold">{x.paciente.nome}</span>
                {x.id === proximo && <span className="shrink-0 bg-tinta px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-papel uppercase">Próximo</span>}
                {x.pedido?.novo && <span className="shrink-0 bg-(--esp) px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-papel uppercase">Pedido novo</span>}
                {x.retornoMarcado && <span className="shrink-0 bg-(--esp-medio) px-1.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-tinta uppercase">Retorno</span>}
              </span>
              <span className="block truncate text-[13.5px] leading-snug text-apagado">
                {x.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · {x.modalidade === 'online' ? 'Online' : 'Presencial'}{x.pagamento && ` · ${x.pagamento}`}
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
  if (situacao === 'pronta' || situacao === 'retorno') return <span className="w-[104px] border-[1.5px] border-petroleo py-0.5 text-center text-[12.5px] font-semibold text-petroleo">Ficha pronta</span>
  return (
    <span className="w-[104px] border-[1.5px] border-dashed border-(--esp-medio) py-0.5 text-center text-[12.5px] font-medium text-apagado">
      {situacao === 'link-enviado' ? 'Link enviado' : 'Sem ficha'}
    </span>
  )
}

function CartaoFichas({ prontas, faltam }: { prontas: number; faltam: number }) {
  return (
    <aside className={`flex items-center gap-4 self-start bg-escuro px-5 text-sobre-escuro ${ALTURA_CARTAO}`} aria-label="Fichas de pré-consulta">
      <p className="font-titulo text-[44px] leading-none font-semibold text-papel">{prontas}</p>
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase">Fichas de pré-consulta</p>
        <p className="mt-0.5 text-[13.5px] text-escuro-apagado">
          {prontas === 1 ? 'pronta' : 'prontas'}{faltam > 0 && ` · ${faltam} sem ficha`}
        </p>
      </div>
    </aside>
  )
}

const ROTULO = 'text-[11px] font-bold tracking-[0.14em] text-apagado uppercase'

type PropsPainel = {
  classeAlergia: string; at: Atendimento; agora: Date; onFechar: () => void; onProntuario: () => void
  /** pedido do servidor (só quando o atendimento veio da página do médico) */
  pedido?: PedidoNaAgenda; medico: Medico; onLinkEnviado: (id: string) => void
  /** Confirmar: o pedido deixa de ser novo e o WhatsApp abre com a mensagem de confirmação */
  onConfirmar: (id: string) => void
  /** Avisar: o pedido é cancelado (sai da agenda) e o WhatsApp abre com o aviso */
  onAvisar: (id: string) => void
  /** pedido da página do médico: a consulta abre em qualquer dia (simulação) */
  onAbrirConsulta: () => void
}

/** Endereço que o paciente abre no celular (o computador do consultório pode estar em "localhost"). */
const ENDERECO_PUBLICO = (import.meta.env.VITE_ENDERECO_PUBLICO as string | undefined) || window.location.origin

function PainelFicha({ classeAlergia, at, agora, onFechar, onProntuario, pedido, medico, onLinkEnviado, onConfirmar, onAvisar, onAbrirConsulta }: PropsPainel) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 767px)').matches) titulo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [at.id])
  const f = at.ficha
  const lembrar = !!pedido && lembrarHoje(pedido, dataLocal(agora))
  /** pedido em que o médico tocou Avisar (falta a segunda confirmação) */
  const [avisando, setAvisando] = useState<string | null>(null)
  return (
    <aside className="relative border border-linha bg-branco px-5 py-4" aria-label="Ficha do paciente">
      <button type="button" onClick={onFechar} aria-label="Fechar ficha" className="absolute top-2 right-2 px-2 text-[22px] leading-none text-apagado hover:text-tinta">×</button>
      <p className={ROTULO}>{f.situacao === 'pronta' ? `Ficha recebida · ${f.recebidaAs}` : f.situacao === 'retorno' ? 'Retorno · ficha do prontuário' : at.pedido ? `Pedido recebido · ${at.pedido.chegouAs}` : `Paciente das ${at.inicio}`}</p>
      <h2 ref={titulo} tabIndex={-1} className="mt-1 pr-6 text-[22px] leading-tight font-semibold outline-none">{at.paciente.nome}</h2>
      <p className="mt-0.5 text-[14px] text-apagado">
        {[at.paciente.nascimento && `${idade(at.paciente.nascimento, agora)} anos`, at.pagamento].filter(Boolean).join(' · ')}
        {at.pedido && <> · WhatsApp {formatarWhatsapp(at.pedido.whatsapp)}</>}
      </p>

      {f.situacao === 'pronta' || f.situacao === 'retorno' ? (
        <div className="mt-2.5 space-y-2 text-[14.5px] leading-snug">
          {f.alergias.length > 0 ? (
            f.alergias.map((a) => (
              <div key={a.substancia} className={`px-3 py-1.5 ${classeAlergia}`}>
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase opacity-90">Alergia</p>
                <p><b className="text-[16px]">{a.substancia}</b>{a.reacao && ` · ${a.reacao}`}</p>
              </div>
            ))
          ) : (
            <p><span className={ROTULO}>Alergias</span> <span className="ml-1">nenhuma informada</span></p>
          )}
          {f.queixa && <Bloco rotulo="Queixa">{f.queixa}</Bloco>}
          {f.emUso.length > 0 && <Bloco rotulo="Em uso">{f.emUso.join(' · ')}</Bloco>}
          {f.antecedentes.length > 0 && <Bloco rotulo="Antecedentes">{f.antecedentes.join(' · ')}</Bloco>}
          {f.transcricao && <p className="border-t border-linha pt-2 text-[14px]">Transcrição: <b>{f.transcricao}</b></p>}
        </div>
      ) : (
        <p className="mt-3 text-[14.5px]">
          {f.situacao === 'link-enviado' ? 'O link da ficha foi enviado. O paciente ainda não preencheu.' : 'Este paciente ainda não tem ficha da pré-consulta.'}
        </p>
      )}

      {pedido && (avisando === pedido.id ? (
        // Avisar cancela o horário: pede uma segunda confirmação antes
        <div className="mt-3 border-l-4 border-alerta bg-suave px-3 py-2 text-[14px]">
          <p className="font-semibold">Cancelar este horário e avisar {pedido.nome.trim().split(/\s+/)[0]}?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a
              href={linkWhatsapp(pedido.whatsapp, mensagemDoAviso(pedido, medico, ENDERECO_PUBLICO))}
              target="_blank" rel="noopener noreferrer"
              onClick={() => { setAvisando(null); onAvisar(pedido.id) }}
              className="block bg-alerta px-3 py-2 text-center text-[14.5px] font-bold text-papel no-underline"
            >
              Sim, avisar
            </a>
            <button type="button" onClick={() => setAvisando(null)} className="border-[1.5px] border-tinta px-3 py-2 text-[14.5px] font-semibold hover:bg-tinta hover:text-papel">Não</button>
          </div>
        </div>
      ) : (
        // Confirmar: mensagem pronta de confirmação e a etiqueta "Pedido novo" some.
        // Avisar: o médico não pode atender; o horário é cancelado e volta a ficar livre (regra 6.3).
        <div className={`mt-3 grid gap-2 ${pedido.status === 'novo' ? 'grid-cols-2' : ''}`}>
          {pedido.status === 'novo' && (
            <a
              href={linkWhatsapp(pedido.whatsapp, mensagemDaConfirmacao(pedido, medico))}
              target="_blank" rel="noopener noreferrer"
              onClick={() => onConfirmar(pedido.id)}
              className="block bg-petroleo px-4 py-2.5 text-center text-[15px] font-bold text-papel no-underline transition hover:-translate-y-0.5"
            >
              Confirmar
            </a>
          )}
          <button type="button" onClick={() => setAvisando(pedido.id)}
            className="border-[1.5px] border-alerta px-4 py-2 text-[15px] font-bold text-alerta transition hover:bg-alerta hover:text-papel">
            Avisar
          </button>
        </div>
      ))}

      {pedido && f.situacao !== 'pronta' && (
        // abre o WhatsApp do consultório com a mensagem pronta; quem envia é a pessoa.
        // No dia, para quem escolheu "preencher na consulta": aviso para preencher antes (regra 5.5).
        <a
          href={linkWhatsapp(pedido.whatsapp, lembrar ? mensagemDoLembrete(pedido, medico, ENDERECO_PUBLICO) : mensagemDoFormulario(pedido, medico, ENDERECO_PUBLICO))}
          target="_blank" rel="noopener noreferrer"
          onClick={() => onLinkEnviado(pedido.id)}
          className="mt-3 block bg-(--esp) px-4 py-2.5 text-center text-[15px] font-bold text-papel no-underline transition hover:-translate-y-0.5"
        >
          {lembrar ? 'Lembrar formulário' : f.situacao === 'link-enviado' ? 'Mandar formulário de novo' : 'Mandar formulário'}
        </a>
      )}

      {(pedido || at.retornoMarcado) && (
        <button type="button" onClick={onAbrirConsulta}
          className="mt-2 block w-full border-[1.5px] border-tinta px-4 py-2 text-center text-[15px] font-bold transition hover:bg-tinta hover:text-papel">
          Abrir consulta
        </button>
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
