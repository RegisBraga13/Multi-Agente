// Consulta (Módulo A): estrutura comum das 4 páginas — topo com o paciente, navegador das etapas,
// Anexos — e a página da etapa atual. Só visual, dados de exemplo; o estado vive na memória da página.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import { Anamnese } from './anamnese'
import { ETAPAS, editar, ehEtapa, inicial, oficializar, pendenciasAnamnese, podeOficializar, podeGravar, responderAlerta, situacaoDaEtapa } from './etapas'
import { Exame } from './exame'
import { atualizarHistoria, montarHistoria, type SecaoHistoria } from './historia'
import { PaginaHistoria } from './historia-pagina'
import { atualizarDiagnosticos, montarDiagnosticos, pendenciasDiagnosticos, primeirosItens, type ItemDD, type NaoPerder } from './diagnosticos'
import { PaginaDiagnosticos } from './diagnosticos-pagina'
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

  // o que foi salvo na página 1: a história é montada só com isso
  const fontes = useRef<{ anamnese: string; exame: { rotulo: string; valor: string }[] }>({ anamnese: '', exame: [] })
  /** geradas = última versão da IA; textos = o que está na tela (com as edições do médico); mudou = seções que a IA reescreveu agora */
  const [historia, setHistoria] = useState<{ versao: number; geradas: SecaoHistoria[]; textos: string[]; mudou: boolean[]; sugestoes: (string | null)[] } | null>(null)

  /** Salvar anamnese ou exame. Quando os dois ficam salvos, a história é montada e a página dela abre. */
  const salvarPagina1 = (bloco: 'anamnese' | 'exame') => {
    const novo = oficializar(estado, bloco)
    despachar({ tipo: 'oficializar', bloco })
    if (!podeOficializar(estado, 'historia') && podeOficializar(novo, 'historia')) {
      const f = fontes.current
      // sinais de alerta da anamnese, com a resposta do médico, entram em "Antecedentes e alertas"
      const sinais = conteudo.alertas.filter((x) => x.tipo === 'sinal').map((x) => ({ texto: x.texto, resposta: novo.alertas[x.id] }))
      const novas = montarHistoria(at, new Date(), f.anamnese, f.exame, conteudo.complementares, { falas: conteudo.falas, sinais })
      // primeira vez: tudo novo; depois: a IA mexe só no que mudou
      setHistoria((h) => h
        ? { versao: h.versao + 1, geradas: novas, ...atualizarHistoria(h.geradas, h.textos, novas) }
        : { versao: 1, geradas: novas, textos: novas.map((s) => s.texto), mudou: novas.map(() => true), sugestoes: novas.map(() => null) })
      navegar(`${base}/historia`)
    }
  }

  /** Diagnósticos: itens = hipóteses da IA + as do médico, cada uma com a decisão dele */
  const [dd, setDd] = useState<{ versao: number; itens: ItemDD[]; naoPerder: NaoPerder | null; naoPerderAvaliado: boolean } | null>(null)
  /** última versão já escrita "ao vivo" de cada página: ao voltar, aparece pronta (não escreve de novo) */
  const [escrita, setEscrita] = useState({ historia: 0, diagnosticos: 0 })
  const escreveu = (pagina: 'historia' | 'diagnosticos', versao: number) =>
    setEscrita((e) => (e[pagina] === versao ? e : { ...e, [pagina]: versao }))

  /** Salvar história. Ao liberar os diagnósticos, a IA sugere (ou atualiza só o que mudou) e a página deles abre. */
  const salvarHistoria = () => {
    const novo = oficializar(estado, 'historia')
    despachar({ tipo: 'oficializar', bloco: 'historia' })
    if (!historia || podeOficializar(estado, 'diagnosticos') || !podeOficializar(novo, 'diagnosticos')) return
    // a IA usa só a história salva: o texto que está na tela, com as edições do médico
    const salva = historia.geradas.map((s, i) => ({ rotulo: s.rotulo, texto: historia.textos[i] }))
    const r = montarDiagnosticos(esp.slug, at.paciente.nome, salva)
    setDd((d) => d
      ? { versao: d.versao + 1, itens: atualizarDiagnosticos(d.itens, r.hipoteses), naoPerder: r.naoPerder, naoPerderAvaliado: d.naoPerderAvaliado && d.naoPerder?.cid === r.naoPerder?.cid }
      : { versao: 1, itens: primeirosItens(r.hipoteses), naoPerder: r.naoPerder, naoPerderAvaliado: false })
    navegar(`${base}/diagnosticos`)
  }

  /** O médico mexeu nos diagnósticos: deixam de estar salvos (e a conduta, se salva, fica desatualizada). */
  const mexerDd = (f: (d: NonNullable<typeof dd>) => NonNullable<typeof dd>) => {
    setDd((d) => d && f(d))
    if (estado.blocos.diagnosticos.estado !== 'revisado_medico') fazer('editar', 'diagnosticos')
  }
  const nosItens = (f: (itens: ItemDD[]) => ItemDD[]) => mexerDd((d) => ({ ...d, itens: f(d.itens) }))

  // etapa atual como título (sem número) + atalhos para as etapas já liberadas
  const navegador = (
    <nav aria-label="Etapas da consulta" className="flex flex-wrap items-center gap-1.5">
      {[...ETAPAS].sort((x, y) => Number(y.id === etapa) - Number(x.id === etapa)).map((x) => {
        const s = situacaoDaEtapa(estado, x.id)
        // etapas seguintes só aparecem quando liberadas (a anterior oficializada)
        if (x.id !== etapa && s === 'bloqueado') return null
        const aqui = x.id === etapa
        const marca = (s === 'oficializado' || s === 'desatualizado') && (
          <span className={`shrink-0 truncate text-[12px] ${s === 'desatualizado' ? 'font-bold' : 'text-apagado'}`}>
            {s === 'oficializado' ? '✓ Salvo' : 'Desatualizado'}
          </span>
        )
        // a etapa atual é o título da página (sem número); as liberadas viram atalhos ao lado
        if (aqui) return (
          <h1 key={x.id} className="flex h-[38px] items-center gap-3 pr-2 text-[24px] font-semibold">{x.rotulo}{marca}</h1>
        )
        return (
          <Link key={x.id} to={`${base}/${x.id}`}
            className="flex h-[38px] min-w-0 items-center gap-3 border border-linha bg-branco px-3 no-underline transition hover:bg-(--esp-claro)">
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="truncate text-[15px] font-semibold">{x.rotulo}</span>
              {marca}
            </span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto w-full max-w-6xl px-4 pt-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:gap-x-5">
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

        {/* na página 1 o navegador fica sobre a coluna da anamnese */}
        {etapa !== 'anamnese-exame' && <div className="mt-2.5">{navegador}</div>}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-3 sm:px-6">
        {/* a página 1 fica montada (escondida) nas outras etapas: gravação, notas e campos não se perdem */}
        <div className={`grid flex-1 gap-4 lg:grid-cols-2 ${etapa === 'anamnese-exame' ? '' : 'hidden'}`}>
          <div className="flex min-w-0 flex-col gap-3 [&>section]:flex-1">
            {navegador}
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
              onOficializar={(texto) => { fontes.current.anamnese = texto; salvarPagina1('anamnese') }}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3 [&>section]:flex-1">
            <h2 className="flex h-[38px] items-center text-[24px] font-semibold">Exame físico e complementar</h2>
            <Exame
              campos={conteudo.exame}
              fotos={conteudo.fotos}
              fotoExemplo={at.paciente.nome === 'Mariana Costa' ? '/img/acne-exemplo.jpg' : null}
              marcas={conteudo.marcas}
              complementares={conteudo.complementares}
              situacao={estado.blocos.exame.estado}
              onEditar={() => fazer('editar', 'exame')}
              onOficializar={(valores) => { fontes.current.exame = valores; salvarPagina1('exame') }}
              onAviso={setAviso}
            />
          </div>
        </div>
        {etapa === 'historia' && historia && situacaoDaEtapa(estado, 'historia') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'historia') === 'desatualizado' && !podeOficializar(estado, 'historia') && (
              <p className="mb-2 text-[14px] font-semibold">A anamnese ou o exame físico mudou. Salve de novo e a IA atualiza só o que mudou na história.</p>
            )}
            <PaginaHistoria
              key={historia.versao}
              animar={escrita.historia < historia.versao}
              onEscrito={() => escreveu('historia', historia.versao)}
              secoes={historia.geradas}
              textos={historia.textos}
              mudou={historia.mudou}
              sugestoes={historia.sugestoes}
              primeira={historia.versao === 1}
              situacao={situacaoDaEtapa(estado, 'historia')}
              podeSalvar={podeOficializar(estado, 'historia')}
              onMudar={(i, texto) => {
                setHistoria((h) => h && { ...h, textos: h.textos.map((x, j) => (j === i ? texto : x)) })
                if (estado.blocos.historia.estado !== 'revisado_medico') fazer('editar', 'historia')
              }}
              onDecidir={(i, aceitar) => {
                setHistoria((h) => h && {
                  ...h,
                  textos: aceitar ? h.textos.map((x, j) => (j === i ? h.sugestoes[i] ?? x : x)) : h.textos,
                  sugestoes: h.sugestoes.map((x, j) => (j === i ? null : x)),
                })
                if (aceitar && estado.blocos.historia.estado !== 'revisado_medico') fazer('editar', 'historia')
              }}
              onSalvar={salvarHistoria}
            />
          </div>
        ) : etapa === 'diagnosticos' && dd && situacaoDaEtapa(estado, 'diagnosticos') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'diagnosticos') === 'desatualizado' && !podeOficializar(estado, 'diagnosticos') && (
              <p className="mb-2 text-[14px] font-semibold">A história clínica mudou. Salve a história de novo e a IA atualiza só o que mudou nas hipóteses.</p>
            )}
            <PaginaDiagnosticos
              key={dd.versao}
              itens={dd.itens}
              naoPerder={dd.naoPerder}
              naoPerderAvaliado={dd.naoPerderAvaliado}
              primeira={dd.versao === 1}
              animar={escrita.diagnosticos < dd.versao}
              onEscrito={() => escreveu('diagnosticos', dd.versao)}
              situacao={situacaoDaEtapa(estado, 'diagnosticos')}
              podeSalvar={podeOficializar(estado, 'diagnosticos')}
              pendencia={pendenciasDiagnosticos(dd.itens, dd.naoPerderAvaliado || !dd.naoPerder)}
              onDecidir={(id, d) => nosItens((xs) => xs.flatMap((x) => (x.hip.id !== id ? [x] : x.propria && d === 'descartada' ? [] : [{ ...x, decisao: d }])))}
              onAviso={(id, manter) => nosItens((xs) => xs.flatMap((x) => {
                if (x.hip.id !== id || !x.aviso) return [x]
                if (manter) return [{ ...x, aviso: null }]
                return x.aviso.tipo === 'saiu' ? [] : [{ ...x, aviso: null, decisao: 'pendente' as const }]
              }))}
              onAdicionar={(nome, cid) => nosItens((xs) => [...xs, { hip: { id: `propria-${Date.now()}`, nome, cid, pct: null, evidencias: [] }, decisao: 'confirmada', propria: true, mudou: false, aviso: null }])}
              onAvaliarNaoPerder={() => mexerDd((d) => ({ ...d, naoPerderAvaliado: !d.naoPerderAvaliado }))}
              onSalvar={() => fazer('oficializar', 'diagnosticos')}
            />
          </div>
        ) : etapa !== 'anamnese-exame' && (
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
  historia: { bloco: 'historia', antes: 'anamnese-exame', bloqueio: 'Salve a anamnese e o exame físico para a IA montar a história clínica.', ia: 'A IA monta a história só com a anamnese e o exame físico salvos. Você revisa, edita e salva.' },
  diagnosticos: { bloco: 'diagnosticos', antes: 'historia', bloqueio: 'Salve a história clínica para a IA sugerir os diagnósticos diferenciais.', ia: 'A IA sugere hipóteses só a partir da história salva. Você decide o diagnóstico.' },
  conduta: { bloco: 'conduta', antes: 'diagnosticos', bloqueio: 'Salve os diagnósticos para a IA sugerir conduta e tratamento.', ia: 'A IA sugere a conduta só a partir dos diagnósticos salvos, com a fonte de cada item. Ao fim, Finalizar consulta.' },
}

/** Páginas 2–4: ainda não construídas. Mostram a regra da etapa e permitem simular a oficialização. */
function EtapaSeguinte({ etapa, estado, onOficializar, onIr }: { etapa: Exclude<EtapaId, 'anamnese-exame'>; estado: EstadoConsulta; onOficializar: (b: Bloco) => void; onIr: (id: EtapaId) => void }) {
  const t = TEXTO_ETAPA[etapa]
  const s = situacaoDaEtapa(estado, etapa)
  const rotulo = ETAPAS.find((x) => x.id === etapa)!.rotulo
  const anterior = ETAPAS.find((x) => x.id === t.antes)!
  return (
    <div className="mx-auto mt-[8vh] max-w-[620px]">
      <Cartao titulo={rotulo}>
        {s === 'bloqueado' ? (
          <>
            <p className="text-[16px]">{t.bloqueio}</p>
            <button type="button" onClick={() => onIr(anterior.id)} className="mt-4 bg-petroleo px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
              Ir para {anterior.rotulo}
            </button>
          </>
        ) : (
          <>
            {s === 'desatualizado' && <p className="mb-2 text-[15px] font-semibold">A etapa anterior mudou depois de salva. Revise antes de seguir.</p>}
            <p className="text-[16px]">{t.ia}</p>
            <p className={`${ROTULO} mt-4`}>Esta página é a próxima entrega</p>
            <div className="mt-3 flex items-center gap-3">
              {s === 'oficializado' ? <EtiquetaSituacao s="oficializado" /> : !podeOficializar(estado, t.bloco) ? (
                <>
                  <span className="text-[14px] text-apagado">Salve de novo a etapa anterior.</span>
                  <button type="button" onClick={() => onIr(anterior.id)} className="border-[1.5px] border-tinta px-3 py-1.5 text-[14px] font-semibold hover:bg-tinta hover:text-papel">Ir para {anterior.rotulo}</button>
                </>
              ) : (
                <button type="button" onClick={() => onOficializar(t.bloco)} className="bg-(--esp) px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
                  Salvar (simulação)
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
        {condutaPronta ? 'Preenchidos a partir da conduta salva. Revise, assine e envie.' : 'Ficam prontos para revisar depois da conduta salva. Um atestado pode ser feito a qualquer momento.'}
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
