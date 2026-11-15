import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { AgendaMedico } from './agenda'
import { buscarMedico, gerarAgenda, horarioExiste } from './exemplo'
import { ComoFunciona, Duvidas, SobreTranscricao } from './informacoes'
import type { RascunhoPedido } from './regras'
import type { Medico, Modalidade } from './tipos'

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

  useEffect(() => {
    document.title = `${medico.tratamento} ${medico.nome} · ${esp?.nome ?? ''}`
  }, [medico, esp])

  function trocarModalidade(m: Modalidade) {
    setRascunho((r) => {
      const continua = r.data && r.inicio && horarioExiste(agenda, m, r.data, r.inicio)
      return { ...r, modalidade: m, data: continua ? r.data : null, inicio: continua ? r.inicio : null }
    })
  }

  const selecionado = rascunho.data && rascunho.inicio ? { data: rascunho.data, inicio: rascunho.inicio } : null

  return (
    <div style={{ '--esp': esp?.cor } as CSSProperties} className="flex min-h-screen flex-col">
      <Cabecalho medico={medico} profissional={esp?.profissional ?? ''} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section id="agenda" aria-labelledby="h-agenda" className="scroll-mt-4 pt-10 pb-14">
          <p className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase">Agenda</p>
          <h2 id="h-agenda" className="mt-2 text-[clamp(28px,4vw,40px)] leading-[1.05] font-bold">Escolha o dia e o horário.</h2>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
            <AgendaMedico
              agenda={agenda}
              modalidade={rascunho.modalidade}
              atendeOnline={medico.atendeOnline}
              onModalidade={trocarModalidade}
              selecionado={selecionado}
              onSelecionar={(data, inicio) => setRascunho((r) => ({ ...r, data, inicio }))}
            />
            <aside className="hidden border border-dashed border-linha p-6 text-apagado md:block">
              Escolha um horário para começar o agendamento.
            </aside>
          </div>
        </section>

        <div className="flex flex-col gap-16 pb-20">
          <ComoFunciona />
          <SobreTranscricao medico={medico} />
          <Duvidas medico={medico} />
        </div>
      </main>

      <footer className="border-t border-linha py-8 text-center text-[14px] text-apagado">
        Agendamento com <Marca className="text-[17px]" />
      </footer>
    </div>
  )
}

function Cabecalho({ medico, profissional }: { medico: Medico; profissional: string }) {
  const iniciais = medico.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')
  return (
    <header className="border-b border-linha bg-branco" style={{ borderTop: '4px solid var(--esp)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:px-6 sm:py-10">
        {medico.foto ? (
          <img src={medico.foto} alt="" className="h-24 w-24 flex-none object-cover sm:h-28 sm:w-28" />
        ) : (
          <span aria-hidden className="grid h-24 w-24 flex-none place-items-center bg-(--esp) font-titulo text-[38px] font-bold text-papel sm:h-28 sm:w-28">
            {iniciais}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(32px,5vw,48px)] leading-[1.02] font-bold">{medico.tratamento} {medico.nome}</h1>
          <p className="mt-1 text-[14px] font-bold tracking-[.14em] text-(--esp) uppercase">{profissional}</p>
          <p className="mt-3 text-[15px]">
            CRM {medico.crm}-{medico.uf}{medico.rqe ? ` · RQE ${medico.rqe}` : ''}
          </p>
          <p className="mt-1 text-[15px] text-apagado">
            {medico.endereco} · {medico.cidade}{medico.atendeOnline ? ' · Atende online' : ''}
          </p>
        </div>
        <a href="#agenda" className="self-start bg-(--esp) px-6 py-4 text-[17px] font-bold text-papel no-underline transition hover:-translate-y-0.5 sm:self-center">
          Agendar consulta
        </a>
      </div>
    </header>
  )
}
