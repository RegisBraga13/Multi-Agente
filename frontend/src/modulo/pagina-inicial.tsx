import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { dataLocal, MEDICO_EXEMPLO } from '../medico/exemplo'
import { dataPorExtenso, idade, somarDias } from './dia'
import type { Atendimento } from './tipos'
import { useAgora, vistaDoDia } from './vista'

export function PaginaInicialModulo() {
  const { slug = '' } = useParams()
  const esp = buscarEspecialidade(slug)
  if (!esp || esp.status !== 'disponivel') return <NaoEncontrada />
  return <Pagina esp={esp} />
}

// colunas da linha no PC: horário · paciente · tipo · modalidade · formulário
// (no tablet em pé as colunas apertam para o nome não quebrar)
const COLUNAS = 'grid grid-cols-[50px_minmax(0,1fr)] items-baseline gap-x-3 md:grid-cols-[50px_minmax(0,1fr)_84px_82px_118px] md:items-center md:gap-y-0 lg:grid-cols-[64px_minmax(0,1fr)_96px_100px_132px] lg:gap-4'

function Pagina({ esp }: { esp: Especialidade }) {
  const agora = useAgora()
  const [dia, setDia] = useState(() => dataLocal(new Date()))
  const [aviso, setAviso] = useState<string | null>(null)
  const medico = MEDICO_EXEMPLO

  const { hoje, lista, proximo, atendidos } = useMemo(() => vistaDoDia(dia, agora), [dia, agora])

  useEffect(() => {
    document.title = `${esp.raiz}IA · Agenda`
  }, [esp])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="min-h-screen bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="border-b border-linha bg-branco" style={{ borderTop: '4px solid var(--esp)' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <NomeModulo esp={esp} className="text-[28px] leading-none" />
          <span className="text-[15px] text-apagado">{medico.tratamento} {medico.nome}</span>
          <nav aria-label="Dia da agenda" className="ml-auto flex items-center gap-1">
            {dia !== hoje && (
              <button type="button" onClick={() => setDia(hoje)} className="mr-2 border-[1.5px] border-linha px-3 py-1.5 text-[14px] font-semibold hover:border-tinta">
                Hoje
              </button>
            )}
            <button type="button" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior" className="px-2.5 py-1 text-[22px] leading-none hover:text-(--esp)">‹</button>
            <span className="min-w-[200px] text-center text-[16px] font-semibold" aria-live="polite">{dataPorExtenso(dia)}</span>
            <button type="button" onClick={() => setDia(somarDias(dia, 1))} aria-label="Dia seguinte" className="px-2.5 py-1 text-[22px] leading-none hover:text-(--esp)">›</button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-[clamp(24px,3vw,30px)] leading-tight font-semibold">{dia === hoje ? 'Pacientes de hoje' : 'Pacientes do dia'}</h1>
          {lista.length > 0 && (
            <p className="text-[15px] text-apagado">
              {lista.length} {lista.length === 1 ? 'paciente' : 'pacientes'}
              {atendidos > 0 && ` · ${atendidos} ${atendidos === 1 ? 'atendido' : 'atendidos'}`}
            </p>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="border border-linha bg-branco px-5 py-8 text-center text-[17px] text-apagado">Nenhum paciente neste dia.</p>
        ) : (
          <ol className="border border-linha bg-branco" aria-label="Agenda do dia">
            {lista.map((x) => (
              <Linha
                key={x.id}
                at={x}
                proximo={x.id === proximo}
                agora={agora}
                onAbrir={() => setAviso('O atendimento é a próxima etapa do módulo.')}
                onProntuario={() => setAviso('O prontuário é uma das próximas etapas do módulo.')}
              />
            ))}
          </ol>
        )}
      </main>

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        {aviso && <p className="bg-tinta px-5 py-3 text-[15px] font-medium text-papel shadow-lg">{aviso}</p>}
      </div>
    </div>
  )
}

function Linha({ at, proximo, agora, onAbrir, onProntuario }: {
  at: Atendimento; proximo: boolean; agora: Date; onAbrir: () => void; onProntuario: () => void
}) {
  const fundo = proximo ? 'bg-[color-mix(in_oklab,var(--esp)_7%,white)]' : ''
  return (
    <li
      className={`flex items-center border-b border-linha last:border-b-0 ${fundo} ${at.atendido ? 'opacity-55' : ''}`}
      style={{ borderLeft: `4px solid ${proximo ? 'var(--esp)' : 'transparent'}` }}
    >
      <button type="button" onClick={onAbrir} className={`min-w-0 flex-1 px-4 py-2.5 text-left transition hover:bg-suave/60 ${COLUNAS}`}>
        <span className="text-[17px] font-semibold tabular-nums">{at.inicio}</span>
        <span className="text-[16px] md:truncate md:whitespace-nowrap">
          <span className="font-semibold">{at.paciente.nome}</span>
          <span className="whitespace-nowrap text-apagado">, {idade(at.paciente.nascimento, agora)} a</span>
          {proximo && <span className="ml-2 text-[14px] font-bold text-(--esp)">Próximo</span>}
        </span>
        <span className="col-start-2 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
          <Etiqueta tipo={at.tipo} />
          <span className="text-[15px]">{at.modalidade === 'online' ? 'Online' : 'Presencial'}</span>
          <span className="text-[15px] text-apagado md:text-[14px] lg:text-[15px]">
            {at.atendido ? 'Atendido' : at.formulario === 'preenchido' ? '✓ Formulário' : '○ Sem formulário'}
          </span>
        </span>
      </button>
      <span className="shrink-0 pr-4 text-right md:w-[100px] lg:w-[112px]">
        {at.temHistorico && (
          <button type="button" onClick={onProntuario} className="text-[15px] font-semibold underline decoration-linha underline-offset-4 hover:text-(--esp) hover:decoration-(--esp)">
            Prontuário
          </button>
        )}
      </span>
    </li>
  )
}

function Etiqueta({ tipo }: { tipo: Atendimento['tipo'] }) {
  return tipo === 'consulta' ? (
    <span className="inline-block w-fit border-[1.5px] border-(--esp) bg-(--esp) px-2.5 py-0.5 text-[14px] font-bold text-papel">Consulta</span>
  ) : (
    <span className="inline-block w-fit border-[1.5px] border-(--esp) px-2.5 py-0.5 text-[14px] font-bold text-(--esp)">Retorno</span>
  )
}
