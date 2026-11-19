import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { AgendaMedico } from './agenda'
import { horariosOcupados, type HorarioOcupado } from '../servidor/agenda'
import { buscarMedico, gerarAgenda, horarioExiste, marcarOcupados } from './exemplo'
import { ComoFunciona, Duvidas } from './informacoes'
import { FormularioPaciente } from './formulario-paciente'
import { PainelAgendamento } from './painel-agendamento'
import type { RascunhoPedido } from './regras'
import type { Medico, Modalidade } from './tipos'
import { useTelaPequena } from './use-tela-pequena'
import { useVista, type Vista } from './use-vista'

const RASCUNHO_VAZIO: RascunhoPedido = {
  modalidade: 'presencial', data: null, inicio: null, nome: '', whatsapp: '', atendimento: null, convenio: '', transcricao: null, forma: null,
}

export function PaginaMedico() {
  const { slug = '' } = useParams()
  const medico = buscarMedico(slug)
  if (!medico) return <NaoEncontrada />
  return <Pagina medico={medico} />
}

function Pagina({ medico }: { medico: Medico }) {
  const esp = buscarEspecialidade(medico.especialidade)
  const base = useMemo(() => gerarAgenda(new Date()), [])
  // horários já pedidos por outros pacientes (servidor); sem conexão, a agenda aparece como está
  const [ocupados, setOcupados] = useState<HorarioOcupado[]>([])
  const agenda = useMemo(() => marcarOcupados(base, ocupados), [base, ocupados])
  const recarregarOcupados = useCallback(() => {
    const dias = [...base.presencial, ...base.online].map((d) => d.data).sort()
    if (!dias.length) return
    horariosOcupados(medico.slug, dias[0], dias[dias.length - 1]).then(setOcupados, () => {})
  }, [base, medico.slug])
  useEffect(() => {
    recarregarOcupados()
    const t = setInterval(recarregarOcupados, 30_000)
    return () => clearInterval(t)
  }, [recarregarOcupados])
  const [rascunho, setRascunho] = useState<RascunhoPedido>(RASCUNHO_VAZIO)
  const [preenchendo, setPreenchendo] = useState(false)
  // link do formulário do pedido enviado (o formulário na página grava nele)
  const [token, setToken] = useState<string | null>(null)
  const vista = useVista()

  // trocar de página leva ao topo e põe o foco no título da página nova (para quem usa leitor de tela).
  // As seções não têm o mesmo nome do endereço (#duvidas…), senão o navegador rolaria até elas e esconderia o cabeçalho.
  const primeiraVista = useRef(true)
  useEffect(() => {
    if (primeiraVista.current) { primeiraVista.current = false; return }
    window.scrollTo(0, 0)
    document.getElementById(TITULO_DA_VISTA[vista])?.focus({ preventScroll: true })
  }, [vista])

  useEffect(() => {
    document.title = `${medico.tratamento} ${medico.nome} · ${esp?.nome ?? ''}`
  }, [medico, esp])

  function trocarModalidade(m: Modalidade) {
    setRascunho((r) => {
      const continua = r.data && r.inicio && horarioExiste(agenda, m, r.data, r.inicio)
      return { ...r, modalidade: m, data: continua ? r.data : null, inicio: continua ? r.inicio : null }
    })
  }

  // fechar o painel devolve o paciente à agenda; nome e WhatsApp digitados continuam guardados
  const fecharPainel = useCallback(() => setRascunho((r) => ({ ...r, data: null, inicio: null })), [])

  const selecionado = rascunho.data && rascunho.inicio ? { data: rascunho.data, inicio: rascunho.inicio } : null

  // Janela modal: só o painel no celular, que cobre a página; o resto fica inerte por baixo.
  // O formulário abre dentro da própria página, no lugar da agenda.
  const telaPequena = useTelaPequena()
  const modal = !preenchendo && telaPequena && !!selecionado
  const tituloAgenda = useRef<HTMLHeadingElement>(null)
  const algoAberto = preenchendo || !!selecionado
  const estavaAberto = useRef(false)
  useEffect(() => {
    // ao fechar painel ou formulário, o foco volta à agenda
    if (estavaAberto.current && !algoAberto) tituloAgenda.current?.focus()
    estavaAberto.current = algoAberto
  }, [algoAberto])

  const painel = selecionado && !preenchendo && (
    <PainelAgendamento
      // trocar o horário reabre o painel no resumo; o que já foi digitado fica no rascunho
      key={`${selecionado.data} ${selecionado.inicio}`}
      modal={telaPequena}
      medico={medico}
      rascunho={rascunho}
      onMudar={setRascunho}
      onFechar={fecharPainel}
      onEnviado={(t) => { setToken(t); recarregarOcupados() }}
      onHorarioTomado={recarregarOcupados}
      onPreencherNaPagina={() => setPreenchendo(true)}
    />
  )

  return (
    <div style={{ '--esp': esp?.cor } as CSSProperties} className="flex min-h-screen flex-col">
      <div inert={modal}>
        <Cabecalho medico={medico} profissional={esp?.profissional ?? ''} vista={vista} />
      </div>

      <main inert={modal} className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
        {/* uma página por vez: a inicial tem só as três opções; cada uma abre a sua página */}
        {vista === 'inicio' && <Inicio />}
        {/* páginas de informação: centralizadas na altura; o atalho "Agendar consulta" fica no topo */}
        {vista === 'como' && <div className="flex flex-1 flex-col justify-center"><ComoFunciona /></div>}
        {vista === 'duvidas' && <div className="flex flex-1 flex-col justify-center"><Duvidas medico={medico} /></div>}

        {vista === 'agenda' && (preenchendo && token ? (
          <FormularioPaciente
            medico={medico}
            token={token}
            pedido={rascunho}
            onConcluir={() => { setPreenchendo(false); fecharPainel() }}
          />
        ) : (
        <section id="secao-agenda" aria-labelledby="h-agenda" className="pt-4 pb-12 sm:pt-5">
          <h2 id="h-agenda" ref={tituloAgenda} tabIndex={-1} className="text-[clamp(24px,2.6vw,32px)] leading-[1.05] font-bold outline-none">Escolha o dia e o horário.</h2>
          {/* agenda e painel com a mesma altura: alinhados no topo e na base */}
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
            <AgendaMedico
              agenda={agenda}
              modalidade={rascunho.modalidade}
              atendeOnline={medico.atendeOnline}
              onModalidade={trocarModalidade}
              selecionado={selecionado}
              onSelecionar={(data, inicio) => setRascunho((r) => ({ ...r, data, inicio }))}
            />
            {selecionado ? (
              // no celular o painel vai para fora da página (que fica inerte); no tablet e PC fica ao lado da agenda
              !telaPequena && painel
            ) : (
              <aside className="hidden border border-dashed border-linha p-6 text-apagado md:block">
                Escolha um horário para começar o agendamento.
              </aside>
            )}
          </div>
        </section>
        ))}
      </main>

      {telaPequena && painel}

      <footer inert={modal} className="border-t border-linha py-8 text-center text-[14px] text-apagado">
        Agendamento com <Marca className="text-[17px]" />
      </footer>
    </div>
  )
}

const ATALHOS = [
  ['como', 'Como funciona'],
  ['duvidas', 'Dúvidas'],
  ['agenda', 'Agendar consulta'],
] as const

const TITULO_DA_VISTA: Record<Vista, string> = { inicio: 'h-inicio', como: 'h-como', duvidas: 'h-duv', agenda: 'h-agenda' }
const ENDERECO: Record<Exclude<Vista, 'inicio'>, string> = { como: '#como-funciona', duvidas: '#duvidas', agenda: '#agenda' }

const OPCOES = [
  ['como', 'Como funciona', 'Os três passos até a consulta e como a tecnologia ajuda no cuidado.'],
  ['duvidas', 'Dúvidas', 'Respostas para as perguntas mais frequentes.'],
  ['agenda', 'Agendar consulta', 'Escolha o dia e o horário, presencial ou online.'],
] as const

/** Página inicial: só as três opções. */
function Inicio() {
  return (
    <section aria-labelledby="h-inicio" className="flex flex-1 items-center py-8 sm:py-12">
      <h2 id="h-inicio" tabIndex={-1} className="sr-only">O que você procura?</h2>
      <ul className="mx-auto grid w-full max-w-5xl gap-3 md:grid-cols-3 md:gap-4">
        {OPCOES.map(([alvo, titulo, texto]) => {
          const destaque = alvo === 'agenda'
          return (
            <li key={alvo}>
              <a
                href={ENDERECO[alvo]}
                className={`group flex h-full flex-col border-[1.5px] p-6 no-underline transition hover:-translate-y-0.5 sm:p-7 ${destaque ? 'border-(--esp) bg-(--esp) text-papel' : 'border-linha bg-branco text-tinta hover:border-(--esp)'}`}
              >
                <span className="font-titulo text-[clamp(22px,2.4vw,28px)] leading-tight font-bold">{titulo}</span>
                <span className={`mt-2 flex-1 text-[15px] ${destaque ? 'text-papel/85' : 'text-apagado'}`}>{texto}</span>
                <span aria-hidden className={`mt-5 text-[22px] leading-none transition group-hover:translate-x-1 ${destaque ? '' : 'text-(--esp)'}`}>→</span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Cabecalho({ medico, profissional, vista }: { medico: Medico; profissional: string; vista: Vista }) {
  const iniciais = medico.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')
  return (
    <header className="border-b border-linha bg-branco" style={{ borderTop: '4px solid var(--esp)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 items-center gap-4">
          {medico.foto ? (
            <img src={medico.foto} alt="" className="h-14 w-14 flex-none object-cover sm:h-16 sm:w-16" />
          ) : (
            <span aria-hidden className="grid h-14 w-14 flex-none place-items-center bg-(--esp) font-titulo text-[21px] font-bold text-papel sm:h-16 sm:w-16 sm:text-[24px]">
              {iniciais}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[clamp(23px,3vw,28px)] leading-[1.1] font-bold">
              {/* o nome leva de volta ao início */}
              <a href="#inicio" className="text-tinta no-underline hover:text-(--esp)">{medico.tratamento} {medico.nome}</a>
            </h1>
            <p className="mt-0.5 text-[12px] font-bold tracking-[.14em] text-(--esp) uppercase">
              {profissional} <span className="font-semibold tracking-normal normal-case text-tinta">· CRM {medico.crm}-{medico.uf}{medico.rqe ? ` · RQE ${medico.rqe}` : ''}</span>
            </p>
            <p className="mt-0.5 text-[14px] text-apagado">
              {medico.endereco} · {medico.cidade}{medico.atendeOnline ? ' · Atende online' : ''}
            </p>
          </div>
        </div>
        {/* na página inicial as três opções já estão à vista; nas outras, os atalhos levam de uma a outra */}
        {vista !== 'inicio' && <nav aria-label="Nesta página" className="flex-none">
          <ul className="flex flex-wrap gap-2">
            {ATALHOS.map(([alvo, rotulo]) => (
              <li key={alvo}>
                <a
                  href={ENDERECO[alvo]}
                  aria-current={vista === alvo ? 'page' : undefined}
                  className={`block border-[1.5px] px-3.5 py-2 text-[14px] font-semibold no-underline transition ${alvo === 'agenda' ? 'border-(--esp) bg-(--esp) text-papel hover:-translate-y-0.5' : vista === alvo ? 'border-(--esp) bg-papel text-(--esp)' : 'border-linha bg-papel text-tinta hover:border-(--esp) hover:text-(--esp)'}`}
                >
                  {rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>}
      </div>
    </header>
  )
}
