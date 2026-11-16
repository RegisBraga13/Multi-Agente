// Consulta (Módulo A): estrutura comum das 4 páginas — topo com o paciente, navegador das etapas,
// Anexos — e a página da etapa atual. Só visual, dados de exemplo; o estado vive na memória da página.
import { useCallback, useEffect, useMemo, useReducer, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import { Anamnese } from './anamnese'
import { ETAPAS, editar, ehEtapa, inicial, nomeSituacao, oficializar, pendenciasAnamnese, podeOficializar, podeGravar, responderAlerta, situacaoDaEtapa } from './etapas'
import { Exame } from './exame'
import { buscarAtendimento, conteudoDaConsulta } from './exemplo'
import type { Bloco, EstadoConsulta, EtapaId, RespostaAlerta } from './tipos'
import { Cartao, EtiquetaSituacao, Gaveta, ROTULO } from './ui'

export function PaginaConsulta() {
  const { slug = '', atendimento = '', etapa } = useParams()
  const esp = buscarEspecialidade(slug)
  // o dia da consulta é o do endereço; o "agora" só decide quem já foi atendido
  const at = useMemo(() => buscarAtendimento(atendimento, new Date()), [atendimento])
  if (!esp || esp.status !== 'disponivel' || !at || !ehEtapa(etapa)) return <NaoEncontrada />
  return <Consulta key={at.id} esp={esp} at={at} etapa={etapa} />
}

type Acao = { tipo: 'oficializar' | 'editar'; bloco: Bloco } | { tipo: 'alerta'; id: string; r: RespostaAlerta }

function reduzir(e: EstadoConsulta, a: Acao): EstadoConsulta {
  if (a.tipo === 'alerta') return responderAlerta(e, a.id, a.r)
  return a.tipo === 'oficializar' ? oficializar(e, a.bloco) : editar(e, a.bloco)
}

function Consulta({ esp, at, etapa }: { esp: Especialidade; at: Atendimento; etapa: EtapaId }) {
  const conteudo = useMemo(() => conteudoDaConsulta(at, esp.slug), [at, esp.slug])
  const [estado, despachar] = useReducer(reduzir, conteudo.alertas.map((a) => a.id), inicial)
  const [anexos, setAnexos] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const navegar = useNavigate()
  const base = `/modulo/${esp.slug}/consulta/${at.id}`
  const atual = ETAPAS.find((x) => x.id === etapa)!

  useEffect(() => { document.title = `${esp.raiz}IA · ${atual.rotulo} · ${at.paciente.nome}` }, [esp, atual, at])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])
  const fecharAnexos = useCallback(() => setAnexos(false), [])

  const f = at.ficha
  const alergias = f.situacao === 'pronta' ? f.alergias : []
  const fazer = (tipo: 'oficializar' | 'editar', bloco: Bloco) => despachar({ tipo, bloco })

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto w-full max-w-6xl px-4 pt-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to={`/modulo/${esp.slug}`} className="no-underline" aria-label={`${esp.raiz}IA, início`}><NomeModulo esp={esp} className="text-[26px]" /></Link>
          <p className="text-[15px]">
            <b className="text-[17px]">{at.paciente.nome}</b>
            <span className="text-apagado"> · {idade(at.paciente.nascimento, new Date())} anos · {at.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · {at.modalidade === 'online' ? 'Online' : 'Presencial'}</span>
          </p>
          {alergias.map((a) => (
            <span key={a.substancia} className="bg-alerta-clinico px-2.5 py-1 text-[13px] text-branco">
              <b className="mr-1.5 text-[11px] tracking-[0.14em] uppercase">Alergia</b><b>{a.substancia}</b>
            </span>
          ))}
          <button type="button" onClick={() => setAnexos(true)} className="ml-auto border-[1.5px] border-tinta px-3 py-1 text-[14px] font-semibold hover:bg-tinta hover:text-papel">
            Anexos
          </button>
        </div>

        <nav aria-label="Etapas da consulta" className="mt-2.5 grid grid-cols-2 gap-1.5 lg:flex">
          {ETAPAS.map((x, i) => {
            const s = situacaoDaEtapa(estado, x.id)
            const aqui = x.id === etapa
            return (
              <Link key={x.id} to={`${base}/${x.id}`} aria-current={aqui ? 'page' : undefined}
                className={`flex min-w-0 items-baseline gap-2 px-3 py-1.5 no-underline transition lg:flex-auto ${aqui ? 'bg-(--esp) text-papel' : 'border border-linha bg-branco hover:bg-(--esp-claro)'}`}>
                <span className="font-titulo text-[20px] leading-none font-semibold">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-baseline lg:justify-between lg:gap-2">
                  <span className="truncate text-[15px] font-semibold">{x.rotulo}</span>
                  <span className={`shrink-0 truncate text-[12px] ${aqui ? 'opacity-85' : s === 'desatualizado' ? 'font-semibold text-alerta-clinico' : 'text-apagado'}`}>
                    {s === 'oficializado' ? '✓ ' : ''}{nomeSituacao(s, true)}
                  </span>
                </span>
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3 sm:px-6">
        {/* a página 1 fica montada (escondida) nas outras etapas: gravação, notas e campos não se perdem */}
        <div className={`grid gap-4 lg:grid-cols-2 ${etapa === 'anamnese-exame' ? '' : 'hidden'}`}>
            <Anamnese
              falas={conteudo.falas}
              faltouPerguntar={conteudo.faltouPerguntar}
              alertas={conteudo.alertas}
              respostas={estado.alertas}
              situacao={estado.blocos.anamnese.estado}
              pendencias={pendenciasAnamnese(estado)}
              podeGravar={podeGravar(f)}
              onEditar={() => fazer('editar', 'anamnese')}
              onResponder={(id, r) => despachar({ tipo: 'alerta', id, r })}
              onOficializar={() => fazer('oficializar', 'anamnese')}
            />
            <Exame
              campos={conteudo.exame}
              fotos={conteudo.fotos}
              fotoExemplo={at.paciente.nome === 'Mariana Costa' ? '/img/acne-exemplo.jpg' : null}
              complementares={conteudo.complementares}
              situacao={estado.blocos.exame.estado}
              onEditar={() => fazer('editar', 'exame')}
              onOficializar={() => fazer('oficializar', 'exame')}
              onAviso={setAviso}
            />
        </div>
        {etapa !== 'anamnese-exame' && (
          <EtapaSeguinte etapa={etapa} estado={estado} onOficializar={(b) => fazer('oficializar', b)} onIr={(id) => navegar(`${base}/${id}`)} />
        )}
      </main>

      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>

      {anexos && <PainelAnexos condutaPronta={estado.blocos.conduta.estado === 'oficializado' && situacaoDaEtapa(estado, 'conduta') === 'oficializado'} onFechar={fecharAnexos} onAviso={setAviso} />}

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {aviso && <p className="bg-tinta px-5 py-3 text-[15px] font-medium text-papel shadow-lg">{aviso}</p>}
      </div>
    </div>
  )
}

const TEXTO_ETAPA: Record<Exclude<EtapaId, 'anamnese-exame'>, { bloco: Bloco; antes: EtapaId; bloqueio: string; ia: string }> = {
  historia: { bloco: 'historia', antes: 'anamnese-exame', bloqueio: 'Oficialize a anamnese e o exame para a IA montar a história clínica.', ia: 'A IA monta a história só com a anamnese e o exame oficializados. Você revisa, edita e oficializa.' },
  diagnosticos: { bloco: 'diagnosticos', antes: 'historia', bloqueio: 'Oficialize a história clínica para a IA sugerir os diagnósticos diferenciais.', ia: 'A IA sugere hipóteses só a partir da história oficializada. Você decide o diagnóstico.' },
  conduta: { bloco: 'conduta', antes: 'diagnosticos', bloqueio: 'Oficialize os diagnósticos para a IA sugerir conduta e tratamento.', ia: 'A IA sugere a conduta só a partir dos diagnósticos oficializados, com a fonte de cada item. Ao fim, Finalizar consulta.' },
}

/** Páginas 2–4: ainda não construídas. Mostram a regra da etapa e permitem simular a oficialização. */
function EtapaSeguinte({ etapa, estado, onOficializar, onIr }: { etapa: Exclude<EtapaId, 'anamnese-exame'>; estado: EstadoConsulta; onOficializar: (b: Bloco) => void; onIr: (id: EtapaId) => void }) {
  const t = TEXTO_ETAPA[etapa]
  const s = situacaoDaEtapa(estado, etapa)
  const rotulo = ETAPAS.find((x) => x.id === etapa)!.rotulo
  const anterior = ETAPAS.find((x) => x.id === t.antes)!
  return (
    <div className="mx-auto mt-[8vh] max-w-[620px]">
      <Cartao titulo={rotulo} situacao={s}>
        {s === 'bloqueado' ? (
          <>
            <p className="text-[16px]">{t.bloqueio}</p>
            <button type="button" onClick={() => onIr(anterior.id)} className="mt-4 bg-petroleo px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
              Ir para {anterior.rotulo}
            </button>
          </>
        ) : (
          <>
            {s === 'desatualizado' && <p className="mb-2 text-[15px] font-semibold text-alerta-clinico">A etapa anterior mudou depois da oficialização. Revise antes de seguir.</p>}
            <p className="text-[16px]">{t.ia}</p>
            <p className={`${ROTULO} mt-4`}>Esta página é a próxima entrega</p>
            <div className="mt-3 flex items-center gap-3">
              {s === 'oficializado' ? <EtiquetaSituacao s="oficializado" /> : !podeOficializar(estado, t.bloco) ? (
                <>
                  <span className="text-[14px] text-apagado">Oficialize de novo a etapa anterior.</span>
                  <button type="button" onClick={() => onIr(anterior.id)} className="border-[1.5px] border-tinta px-3 py-1.5 text-[14px] font-semibold hover:bg-tinta hover:text-papel">Ir para {anterior.rotulo}</button>
                </>
              ) : (
                <button type="button" onClick={() => onOficializar(t.bloco)} className="bg-(--esp) px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
                  Oficializar (simulação)
                </button>
              )}
            </div>
          </>
        )}
      </Cartao>
    </div>
  )
}

const DOCUMENTOS = ['Receita', 'Orientações', 'Atestado', 'Pedido de exames', 'Encaminhamento', 'Laudo']

function PainelAnexos({ condutaPronta, onFechar, onAviso }: { condutaPronta: boolean; onFechar: () => void; onAviso: (t: string) => void }) {
  return (
    <Gaveta titulo="Anexos" onFechar={onFechar}>
      <p className="text-[14.5px] text-apagado">
        {condutaPronta ? 'Preenchidos a partir da conduta oficializada. Revise, assine e envie.' : 'Ficam prontos para revisar depois da conduta oficializada. Um atestado pode ser feito a qualquer momento.'}
      </p>
      <ul className="mt-3 divide-y divide-linha border-y border-linha bg-branco">
        {DOCUMENTOS.map((d) => {
          const livre = condutaPronta || d === 'Atestado'
          return (
            <li key={d} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[16px] font-semibold">{d}</span>
              {livre ? (
                <button type="button" onClick={() => onAviso('Os anexos chegam numa próxima etapa.')} className="border-[1.5px] border-tinta px-3 py-1 text-[13.5px] font-semibold hover:bg-tinta hover:text-papel">Abrir</button>
              ) : (
                <span className="text-[13px] text-apagado">depois da conduta</span>
              )}
            </li>
          )
        })}
      </ul>
    </Gaveta>
  )
}
