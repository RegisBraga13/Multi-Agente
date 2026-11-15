import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { AgendaMedico } from './agenda'
import { buscarMedico, gerarAgenda, horarioExiste } from './exemplo'
import { PAGINA } from './estilos'
import { ComoFunciona, Duvidas } from './informacoes'
import { FormularioPaciente } from './formulario-paciente'
import { PainelAgendamento } from './painel-agendamento'
import type { RascunhoPedido } from './regras'
import type { Medico, Modalidade } from './tipos'
import { useTelaPequena } from './use-tela-pequena'

const RASCUNHO_VAZIO: RascunhoPedido = {
  modalidade: 'presencial', data: null, inicio: null, nome: '', whatsapp: '', transcricao: null, forma: null,
}

export function PaginaMedico() {
  const { slug = '' } = useParams()
  const medico = buscarMedico(slug)
  if (!medico) return <NaoEncontrada />
  return <Pagina medico={medico} />
}

function Pagina({ medico }: { medico: Medico }) {
  const esp = buscarEspecialidade(medico.especialidade)
  const agenda = useMemo(() => gerarAgenda(new Date()), [])
  const [rascunho, setRascunho] = useState<RascunhoPedido>(RASCUNHO_VAZIO)
  const [preenchendo, setPreenchendo] = useState(false)

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
      onPreencherNaPagina={() => setPreenchendo(true)}
    />
  )

  return (
    <div style={{ '--esp': esp?.cor } as CSSProperties} className="flex min-h-screen flex-col">
      <div inert={modal}>
        <Cabecalho medico={medico} profissional={esp?.profissional ?? ''} />
      </div>

      <main inert={modal} className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* primeiro o paciente entende como funciona; a agenda fica no final */}
        <ComoFunciona />
        <Duvidas medico={medico} />

        {preenchendo ? (
          <FormularioPaciente
            medico={medico}
            pedido={rascunho}
            onConcluir={() => { setPreenchendo(false); fecharPainel() }}
          />
        ) : (
        <section id="agenda" aria-labelledby="h-agenda" className={`${PAGINA} border-t border-linha`}>
          <h2 id="h-agenda" ref={tituloAgenda} tabIndex={-1} className="text-[clamp(28px,4vw,40px)] leading-[1.05] font-bold outline-none">Escolha o dia e o horário.</h2>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
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
        )}
      </main>

      {telaPequena && painel}

      <footer inert={modal} className="border-t border-linha py-8 text-center text-[14px] text-apagado">
        Agendamento com <Marca className="text-[17px]" />
      </footer>
    </div>
  )
}

const ATALHOS = [
  ['#como-funciona', 'Como funciona'],
  ['#duvidas', 'Dúvidas'],
  ['#agenda', 'Agendar consulta'],
] as const

function Cabecalho({ medico, profissional }: { medico: Medico; profissional: string }) {
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
            <h1 className="text-[clamp(23px,3vw,28px)] leading-[1.1] font-bold">{medico.tratamento} {medico.nome}</h1>
            <p className="mt-0.5 text-[12px] font-bold tracking-[.14em] text-(--esp) uppercase">
              {profissional} <span className="font-semibold tracking-normal normal-case text-tinta">· CRM {medico.crm}-{medico.uf}{medico.rqe ? ` · RQE ${medico.rqe}` : ''}</span>
            </p>
            <p className="mt-0.5 text-[14px] text-apagado">
              {medico.endereco} · {medico.cidade}{medico.atendeOnline ? ' · Atende online' : ''}
            </p>
          </div>
        </div>
        {/* atalhos: quem quer entender antes lê; quem já decidiu vai direto à agenda */}
        <nav aria-label="Nesta página" className="flex-none">
          <ul className="flex flex-wrap gap-2">
            {ATALHOS.map(([href, rotulo]) => (
              <li key={href}>
                <a
                  href={href}
                  className={`block border-[1.5px] px-3.5 py-2 text-[14px] font-semibold no-underline transition ${href === '#agenda' ? 'border-(--esp) bg-(--esp) text-papel hover:-translate-y-0.5' : 'border-linha bg-papel text-tinta hover:border-(--esp) hover:text-(--esp)'}`}
                >
                  {rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
