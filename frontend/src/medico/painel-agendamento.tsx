import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { Campo } from './campo'
import { btnPainel, btnPainelSecundario, classeEntrada } from './estilos'
import { ErroServidor, pedirConsulta } from '../servidor/agenda'
import { convenioAtendido, formatarWhatsapp, normalizarWhatsapp, pedidoParaServidor, validarAtendimento, validarContato, validarPedido, type ErrosPedido, type FormaFormulario, type RascunhoPedido } from './regras'
import { NOME_MODALIDADE, rotuloDiaLongo, TEXTO_TRANSCRICAO } from './textos'
import type { Medico } from './tipos'

type Props = {
  /** no celular o painel cobre a página: vira janela modal */
  modal: boolean
  medico: Medico
  rascunho: RascunhoPedido
  onMudar(r: RascunhoPedido): void
  onFechar(): void
  /** o servidor aceitou o pedido; `token` = link do formulário */
  onEnviado(token: string): void
  /** outro paciente ficou com o horário enquanto este preenchia */
  onHorarioTomado(): void
  onPreencherNaPagina(): void
}

type Passo = 1 | 2 | 3 | 4 | 5 | 'enviado'
const TOTAL = 5
const OUTRO = 'Outro'

export function PainelAgendamento({ modal, medico, rascunho, onMudar, onFechar, onEnviado, onHorarioTomado, onPreencherNaPagina }: Props) {
  const [passo, setPasso] = useState<Passo>(1)
  const [erros, setErros] = useState<ErrosPedido>({})
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [confirmouConsulta, setConfirmouConsulta] = useState(rascunho.forma === 'consulta')
  // convênio fora da lista do médico: o paciente digita o nome
  const [outro, setOutro] = useState(!!rascunho.convenio && !convenioAtendido(medico.convenios, rascunho.convenio))
  const titulo = useRef<HTMLHeadingElement>(null)
  const r = rascunho

  // foco no título a cada passo (leitor de tela e teclado acompanham a troca)
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
  }, [passo])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onFechar])

  const muda = (parcial: Partial<RascunhoPedido>) => onMudar({ ...r, ...parcial })

  function escolherForma(f: FormaFormulario) {
    setConfirmouConsulta(false)
    setErros((e) => ({ ...e, forma: undefined }))
    muda({ forma: f })
  }

  async function enviar() {
    const e = validarPedido(r)
    setErros(e)
    setErroEnvio(null)
    if (Object.keys(e).length || enviando) return
    setEnviando(true)
    try {
      const criado = await pedirConsulta(medico.slug, pedidoParaServidor(r))
      onEnviado(criado.tokenFormulario)
    } catch (erro) {
      setErroEnvio(erro instanceof ErroServidor ? erro.message : 'Não foi possível enviar. Tente de novo.')
      if (erro instanceof ErroServidor && erro.status === 409) onHorarioTomado()
      return
    } finally {
      setEnviando(false)
    }
    // quem escolheu preencher na página segue direto para o formulário, que abre na própria página
    if (r.forma === 'pagina') return onPreencherNaPagina()
    setPasso('enviado')
  }

  const whatsapp = normalizarWhatsapp(r.whatsapp)
  const precisaReconsiderar = r.forma === 'consulta' && !confirmouConsulta

  return (
    <section
      aria-labelledby="h-painel"
      role={modal ? 'dialog' : undefined}
      aria-modal={modal || undefined}
      className="fixed inset-0 z-50 overflow-y-auto bg-papel md:relative md:inset-auto md:z-auto md:overflow-visible md:bg-transparent"
    >
      <div className="min-h-full bg-branco p-5 sm:p-6 md:h-full md:px-6 md:py-5 md:min-h-0 md:border md:border-t-4 md:border-linha md:shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)]" style={{ borderTopColor: 'var(--esp)' }}>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[12px] font-bold tracking-[.14em] text-apagado uppercase">
            {passo === 'enviado' ? 'Pedido enviado' : `Passo ${passo} de ${TOTAL}`}
          </span>
          <button type="button" onClick={onFechar} className="text-[14px] font-semibold text-apagado underline hover:text-tinta">
            Fechar
          </button>
        </div>
        {passo !== 'enviado' && (
          <div className="mt-2.5 grid grid-cols-5 gap-1.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="h-1" style={{ background: n <= passo ? 'var(--esp)' : 'var(--color-linha)' }} />
            ))}
          </div>
        )}

        {passo === 1 && (
          <>
            <Titulo ref={titulo}>Seu horário</Titulo>
            <dl className="mt-4 grid gap-2.5 border-y border-linha py-3 text-[15.5px]">
              <Linha rotulo="Dia">{rotuloDiaLongo(r.data!)}</Linha>
              <Linha rotulo="Hora">{r.inicio}</Linha>
              <Linha rotulo="Consulta">
                {NOME_MODALIDADE[r.modalidade]}
                <small className="block text-[14px] text-apagado">
                  {r.modalidade === 'presencial' ? `${medico.endereco} · ${medico.cidade}` : 'Por vídeo. O link chega pelo WhatsApp.'}
                </small>
              </Linha>
            </dl>
            <div className="mt-5 grid gap-2.5">
              <button type="button" className={btnPainel} onClick={() => setPasso(2)}>Continuar</button>
              <button type="button" className={btnPainelSecundario} onClick={onFechar}>Trocar horário</button>
            </div>
          </>
        )}

        {passo === 2 && (
          <form
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault()
              const e = validarContato(r)
              setErros(e)
              if (!Object.keys(e).length) setPasso(3)
            }}
          >
            <Titulo ref={titulo}>Seus contatos</Titulo>
            <p className="mt-1.5 text-[14.5px] text-apagado">É por aqui que o consultório confirma o horário e lembra você da consulta.</p>
            <div className="mt-4 grid gap-3">
              <Campo rotulo="Seu nome" erro={erros.nome}>
                {(p) => <input {...p} autoComplete="name" value={r.nome} onChange={(e) => muda({ nome: e.target.value })} className={classeEntrada(p)} />}
              </Campo>
              <Campo rotulo="WhatsApp (celular com DDD)" erro={erros.whatsapp}>
                {(p) => (
                  <input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" value={r.whatsapp} onChange={(e) => muda({ whatsapp: e.target.value })} className={classeEntrada(p)} />
                )}
              </Campo>
            </div>
            <div className="mt-5 grid gap-2.5">
              <button type="submit" className={btnPainel}>Continuar</button>
              <button type="button" className="mt-1 text-[14px] font-semibold text-apagado underline" onClick={() => setPasso(1)}>Voltar</button>
            </div>
          </form>
        )}

        {passo === 3 && (
          <form
            noValidate
            onSubmit={(ev) => {
              ev.preventDefault()
              const e = validarAtendimento(r)
              setErros(e)
              if (!Object.keys(e).length) setPasso(4)
            }}
          >
            <Titulo ref={titulo}>Particular ou convênio?</Titulo>
            <div className="mt-3.5 grid grid-cols-2 gap-2" role="group" aria-label="Tipo de atendimento">
              {([['particular', 'Particular'], ['convenio', 'Convênio']] as const).map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={r.atendimento === v}
                  onClick={() => { setErros({}); muda({ atendimento: v, convenio: v === 'particular' ? '' : r.convenio }) }}
                  className={`border-[1.5px] px-3 py-2.5 text-[16px] font-bold transition ${r.atendimento === v ? 'border-(--esp) bg-(--esp) text-papel' : 'border-tinta hover:bg-suave'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {erros.atendimento && <p role="alert" className="mt-2 text-[14px] font-semibold text-alerta">{erros.atendimento}</p>}

            {r.atendimento === 'convenio' && (
              <div className="mt-4">
                {/* campo que abre a lista do médico ao clicar; "Outro" deixa digitar */}
                <Campo rotulo="Seu convênio" erro={outro ? undefined : erros.convenio}>
                  {(p) => (
                    <select
                      {...p}
                      value={outro ? OUTRO : r.convenio}
                      onChange={(e) => {
                        const c = e.target.value
                        setErros({})
                        setOutro(c === OUTRO)
                        muda({ convenio: c === OUTRO ? '' : c })
                      }}
                      className={classeEntrada(p)}
                    >
                      <option value="">Escolha</option>
                      {medico.convenios.map((c) => <option key={c}>{c}</option>)}
                      <option value={OUTRO}>Outro (digitar)</option>
                    </select>
                  )}
                </Campo>
                {outro && (
                  <div className="mt-2.5">
                    <Campo rotulo="Nome do convênio" erro={erros.convenio}>
                      {(p) => <input {...p} value={r.convenio} onChange={(e) => muda({ convenio: e.target.value })} className={classeEntrada(p)} />}
                    </Campo>
                    {r.convenio.trim() && !convenioAtendido(medico.convenios, r.convenio) && (
                      <p className="mt-2 border-l-4 border-(--esp) bg-suave px-3 py-2 text-[13.5px] leading-snug">
                        Pode não ser atendido; o consultório confirma.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-2.5">
              <button type="submit" className={btnPainel}>Continuar</button>
              <button type="button" className="mt-1 text-[14px] font-semibold text-apagado underline" onClick={() => setPasso(2)}>Voltar</button>
            </div>
          </form>
        )}

        {passo === 4 && (
          <>
            <Titulo ref={titulo}>Transcrição da consulta</Titulo>
            <p className="mt-2 text-[15px] leading-relaxed">{TEXTO_TRANSCRICAO}</p>
            <div className="mt-5 grid gap-2.5" role="group" aria-label="Você concorda com a transcrição?">
              {([['aceita', 'Concordo'], ['recusada', 'Não concordo']] as const).map(([v, t]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={r.transcricao === v}
                  onClick={() => { muda({ transcricao: v }); setPasso(5) }}
                  className={`w-full border-[1.5px] px-5 py-3 text-[16px] font-bold transition ${
                    r.transcricao === v ? 'border-(--esp) bg-(--esp) text-papel' : 'border-tinta hover:bg-suave'
                  }`}
                >
                  {t}
                </button>
              ))}
              <button type="button" className="mt-1 text-[14px] font-semibold text-apagado underline" onClick={() => setPasso(3)}>Voltar</button>
            </div>
          </>
        )}

        {passo === 5 && (
          <>
            <Titulo ref={titulo}>Formulário da consulta</Titulo>
            <fieldset className="mt-3.5 grid gap-2">
              <legend className="sr-only">Como prefere preencher?</legend>
              <Opcao valor="whatsapp" atual={r.forma} onEscolher={escolherForma} selo="Recomendado" compacto={precisaReconsiderar}
                titulo="Receber no WhatsApp" texto="Responda com calma." />
              <Opcao valor="pagina" atual={r.forma} onEscolher={escolherForma} compacto={precisaReconsiderar}
                titulo="Preencher aqui agora" texto="Leva poucos minutos." />
              <label className={`mt-1 flex cursor-pointer items-center gap-2.5 text-[14.5px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--esp) ${r.forma === 'consulta' ? 'font-semibold text-tinta' : 'text-apagado'}`}>
                <input type="radio" name="forma" value="consulta" checked={r.forma === 'consulta'} onChange={() => escolherForma('consulta')} className="h-4 w-4 accent-(--esp)" />
                Prefiro preencher na consulta
              </label>
            </fieldset>

            {precisaReconsiderar && (
              <div className="mt-2.5 border-l-4 border-(--esp) bg-suave px-3.5 py-2.5">
                <p className="font-semibold">Tem certeza?</p>
                <p className="mt-0.5 text-[13.5px] leading-snug">
                  Com o formulário respondido antes, seu médico já chega conhecendo o seu caso. Pelo WhatsApp leva poucos minutos.
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <button type="button" className="bg-(--esp) px-3 py-2 text-[14.5px] font-bold text-papel" onClick={() => escolherForma('whatsapp')}>Receber no WhatsApp</button>
                  <button type="button" className="border-[1.5px] border-tinta px-3 py-2 text-[14.5px] font-semibold" onClick={() => setConfirmouConsulta(true)}>Manter na consulta</button>
                </div>
              </div>
            )}

            {(erros.forma || erros.transcricao || erros.horario || erros.atendimento || erros.convenio) && (
              <p role="alert" className="mt-4 text-[14.5px] font-semibold text-alerta">{erros.forma ?? erros.transcricao ?? erros.horario ?? erros.atendimento ?? erros.convenio}</p>
            )}

            {erroEnvio && <p role="alert" className="mt-4 text-[14.5px] font-semibold text-alerta">{erroEnvio}</p>}

            {!precisaReconsiderar && (
              <div className="mt-5 grid gap-2.5">
                <button type="button" className={btnPainel} onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
                <button type="button" className="mt-1 text-[14px] font-semibold text-apagado underline" onClick={() => setPasso(4)}>Voltar</button>
              </div>
            )}
          </>
        )}

        {passo === 'enviado' && (
          <div role="status">
            <Titulo ref={titulo}>Pedido enviado</Titulo>
            <p className="mt-2 text-[16px]">
              {rotuloDiaLongo(r.data!)}, às {r.inicio} · {NOME_MODALIDADE[r.modalidade]}
            </p>
            <ul className="mt-5 grid gap-3 border-y border-linha py-4 text-[15.5px]">
              <li className="flex gap-2"><span className="text-(--esp)">✓</span>O consultório confirma o horário no seu WhatsApp, {whatsapp && formatarWhatsapp(whatsapp)}.</li>
              {r.forma === 'whatsapp' && <li className="flex gap-2"><span className="text-(--esp)">✓</span>O formulário chega no mesmo WhatsApp.</li>}
              {r.forma === 'consulta' && <li className="flex gap-2"><span className="text-(--esp)">✓</span>Você responde o formulário no início da consulta.</li>}
            </ul>
            <div className="mt-5 grid gap-2.5">
              <button type="button" className={btnPainelSecundario} onClick={onFechar}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Titulo({ ref, children }: { ref: Ref<HTMLHeadingElement>; children: ReactNode }) {
  return (
    <h2 ref={ref} id="h-painel" tabIndex={-1} className="mt-2.5 text-[clamp(22px,2.4vw,26px)] leading-tight font-bold outline-none">
      {children}
    </h2>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <dt className="text-[12px] font-bold tracking-[.14em] text-apagado uppercase leading-6">{rotulo}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}

type PropsOpcao = {
  valor: FormaFormulario
  atual: FormaFormulario | null
  onEscolher(f: FormaFormulario): void
  titulo: string
  texto: string
  selo?: string
  /** só o título, sem a explicação (enquanto o "Tem certeza?" aparece) */
  compacto?: boolean
}

function Opcao({ valor, atual, onEscolher, titulo, texto, selo, compacto }: PropsOpcao) {
  const sel = atual === valor
  return (
    <label
      className={`flex w-full cursor-pointer items-start gap-3 border-[1.5px] p-3 text-left transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--esp) ${sel ? 'border-(--esp) bg-(--esp)/10' : 'border-linha hover:border-tinta'}`}
    >
      <input type="radio" name="forma" value={valor} checked={sel} onChange={() => onEscolher(valor)} className="sr-only" />
      <span aria-hidden className={`mt-1 grid h-5 w-5 flex-none place-items-center border-[1.5px] ${sel ? 'border-(--esp) bg-(--esp) text-papel' : 'border-apagado'}`}>
        {sel ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-[16px]">{titulo}</b>
          {selo && <span className="bg-(--esp) px-2 py-0.5 text-[11px] font-bold tracking-[.1em] text-papel uppercase">{selo}</span>}
        </span>
        {!compacto && <span className="mt-0.5 block text-[14px] text-apagado">{texto}</span>}
      </span>
    </label>
  )
}
