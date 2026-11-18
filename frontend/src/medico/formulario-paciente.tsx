import { useEffect, useRef, useState, type FormEvent } from 'react'
import { UFS } from '../cadastro/validacao'
import { Campo } from './campo'
import { btnPrimario, btnSecundario, classeEntrada } from './estilos'
import { linkWhatsapp } from './duvidas'
import { mensagemFormulario } from './mensagem'
import { blocoRespondido, blocosDoFormulario, type Bloco } from './blocos'
import { GrupoOpcoes } from './opcoes'
import { TextoCrescente } from './texto-crescente'
import { alternarOpcao, partesPreConsulta, perguntaVisivel, type Pergunta, type RespostasPreConsulta } from './pre-consulta'
import { ESTADOS_CIVIS, calcularIdade, formatarWhatsapp, normalizarWhatsapp, validarDadosPessoais, validarFoto, type DadosPessoais, type RascunhoPedido } from './regras'
import { diaComSemana, horaCurta, NOME_MODALIDADE } from './textos'
import type { Medico } from './tipos'

type Props = { medico: Medico; pedido: RascunhoPedido; onConcluir(): void }
type Foto = { nome: string; url: string }

const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
const comoOpcoes = (lista: readonly string[]) => lista.map((t) => ({ valor: t, rotulo: t }))
/** Texto longo, foto e listas grandes de opções ocupam a linha toda; o resto divide a linha no PC. */
const ocupaLinhaToda = (q: Pergunta) =>
  q.tipo === 'texto-longo' || q.tipo === 'foto' || (q.opcoes ?? []).join('').length > 28
const semChave = <T,>(r: Record<string, T>, chave: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== chave))

/** Formulário do paciente, aberto dentro da página logo depois do pedido enviado. */
export function FormularioPaciente({ medico, pedido, onConcluir }: Props) {
  const whatsapp = normalizarWhatsapp(pedido.whatsapp)
  const [dados, setDados] = useState<DadosPessoais>({
    nomeCompleto: pedido.nome, nascimento: '', sexo: '', whatsapp: pedido.whatsapp, email: '', cidade: '', uf: '',
    estadoCivil: '', profissao: '', trabalhoExposto: '',
  })
  const partes = partesPreConsulta(medico.especialidade)
  const [pre, setPre] = useState<RespostasPreConsulta>({})
  const [erros, setErros] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [tentou, setTentou] = useState(false)
  const [fotos, setFotos] = useState<Record<string, Foto>>({})
  const [errosFoto, setErrosFoto] = useState<Record<string, string>>({})
  const [pronto, setPronto] = useState(false)
  const [linkEnvio, setLinkEnvio] = useState('')
  const blocos = blocosDoFormulario(partes)
  const [etapa, setEtapa] = useState(0)
  const tituloBloco = useRef<HTMLHeadingElement>(null)
  const primeiraEtapa = useRef(true)
  const titulo = useRef<HTMLHeadingElement>(null)
  const idade = calcularIdade(dados.nascimento, new Date())

  // ao abrir (e ao concluir), leva a tela e o foco até o formulário
  useEffect(() => {
    titulo.current?.closest('section')?.scrollIntoView({ block: 'start' })
    titulo.current?.focus({ preventScroll: true })
  }, [pronto])
  // libera as miniaturas da memória ao sair
  const fotosAtuais = useRef(fotos)
  fotosAtuais.current = fotos
  useEffect(() => () => Object.values(fotosAtuais.current).forEach((f) => URL.revokeObjectURL(f.url)), [])

  function muda<K extends keyof DadosPessoais>(campo: K, valor: DadosPessoais[K]) {
    const novo = { ...dados, [campo]: valor }
    setDados(novo)
    if (tentou) setErros(validarDadosPessoais(novo, new Date()))
  }
  const mudaPre = (id: string, valor: string | string[]) => setPre((p) => ({ ...p, [id]: valor }))

  function escolherFoto(id: string, arquivo: File | undefined) {
    const antiga = fotos[id]
    if (antiga) URL.revokeObjectURL(antiga.url)
    const outras = semChave(fotos, id)
    const outrosErros = semChave(errosFoto, id)
    const erro = arquivo && validarFoto(arquivo)
    setFotos(arquivo && !erro ? { ...outras, [id]: { nome: arquivo.name, url: URL.createObjectURL(arquivo) } } : outras)
    setErrosFoto(erro ? { ...outrosErros, [id]: erro } : outrosErros)
  }

  function campoPergunta(q: Pergunta) {
    const valor = pre[q.id]
    if (q.tipo === 'escolha' || q.tipo === 'varias') {
      const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : []
      return (
        <GrupoOpcoes key={q.id} rotulo={q.rotulo} ajuda={q.ajuda} modo={q.tipo === 'escolha' ? 'uma' : 'varias'}
          opcoes={comoOpcoes(q.opcoes ?? [])} marcadas={marcadas}
          onAlternar={(o) => mudaPre(q.id, q.tipo === 'escolha' ? o : alternarOpcao(marcadas, o, q.exclusiva))} />
      )
    }
    if (q.tipo === 'foto') {
      const foto = fotos[q.id]
      return (
        <div key={q.id} className="grid gap-3">
          <Campo rotulo={q.rotulo} erro={errosFoto[q.id]} ajuda={q.ajuda}>
            {(p) => (
              <input {...p} type="file" accept="image/*" onChange={(e) => escolherFoto(q.id, e.target.files?.[0])}
                className="block w-full text-[15px] file:mr-4 file:border-[1.5px] file:border-tinta file:bg-transparent file:px-4 file:py-2.5 file:font-semibold" />
            )}
          </Campo>
          {foto && <img src={foto.url} alt={`Foto escolhida: ${foto.nome}`} className="max-h-56 w-auto self-start border border-linha object-contain" />}
        </div>
      )
    }
    const texto = typeof valor === 'string' ? valor : ''
    return (
      <Campo key={q.id} rotulo={q.rotulo} ajuda={q.ajuda}>
        {(p) => q.tipo === 'texto-longo'
          ? <TextoCrescente {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />
          : <input {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />}
      </Campo>
    )
  }

  // um bloco por vez; o último passo é a revisão
  const ultimo = blocos.length // índice da revisão
  useEffect(() => {
    if (primeiraEtapa.current) { primeiraEtapa.current = false; return }
    tituloBloco.current?.closest('section')?.scrollIntoView({ block: 'start' })
    tituloBloco.current?.focus({ preventScroll: true })
  }, [etapa])

  function validarIdentificacao(): boolean {
    setTentou(true)
    const e = validarDadosPessoais(dados, new Date())
    setErros(e)
    if (!Object.keys(e).length) return true
    // espera a tela marcar os campos com erro antes de levar o foco ao primeiro
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#formulario-paciente [aria-invalid="true"]')?.focus())
    return false
  }

  function avancar(ev: FormEvent) {
    ev.preventDefault()
    if (etapa === 0 && !validarIdentificacao()) return
    if (etapa < ultimo) return setEtapa(etapa + 1)
    if (!validarIdentificacao()) return setEtapa(0)
    // teste: o formulário segue pelo WhatsApp do próprio paciente, com a mensagem pronta para o consultório
    const link = linkWhatsapp(medico.whatsappConsultorio, mensagemFormulario({
      medico, pedido, dados, partes, respostas: pre, fotos: Object.keys(fotos).length, hoje: new Date(),
    }))
    setLinkEnvio(link)
    window.open(link, '_blank', 'noopener')
    setPronto(true)
  }

  const bloco = blocos[etapa] as Bloco | undefined
  const estado = { dados, respostas: pre, fotos: Object.keys(fotos), hoje: new Date() }

  function conteudoDoBloco(b: Bloco) {
    if ('parte' in b) {
      return (
        <>
          {/* no PC, perguntas curtas lado a lado; as longas ocupam a linha toda */}
          <div className="grid gap-3.5 sm:grid-flow-row-dense sm:grid-cols-[3fr_2fr] sm:gap-x-5">
            {b.parte.perguntas.filter((q) => perguntaVisivel(q, dados.sexo)).map((q) => (
              <div key={q.id} className={ocupaLinhaToda(q) ? 'sm:col-span-2' : ''}>{campoPergunta(q)}</div>
            ))}
          </div>
          {b.parte.nota && <p className="mt-4 bg-suave px-4 py-3 text-[14px] text-apagado">{b.parte.nota}</p>}
        </>
      )
    }
    if (b.id === 'trabalho') {
      return (
        <div className="grid gap-5">
          <div className="w-[12rem]">
            <Campo rotulo="Estado civil">
              {(p) => (
                <select {...p} value={dados.estadoCivil} onChange={(e) => muda('estadoCivil', e.target.value as DadosPessoais['estadoCivil'])} className={classeEntrada(p)}>
                  <option value="">Escolha</option>
                  {ESTADOS_CIVIS.map((x) => <option key={x.valor} value={x.valor}>{x.rotulo}</option>)}
                </select>
              )}
            </Campo>
          </div>
          <Campo rotulo="Profissão">
            {(p) => <input {...p} autoComplete="organization-title" value={dados.profissao} onChange={(e) => muda('profissao', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
          <GrupoOpcoes rotulo="Trabalha ao ar livre, exposto ao sol ou a produtos químicos?" modo="uma" opcoes={SIM_NAO}
            marcadas={[dados.trabalhoExposto]} onAlternar={(v) => muda('trabalhoExposto', v as DadosPessoais['trabalhoExposto'])} />
        </div>
      )
    }
    // Campos com a largura do que cabem neles: data, sexo, WhatsApp e UF estreitos;
    // nome, e-mail e cidade crescem e ocupam o espaço que sobra na linha.
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-3 sm:gap-x-4">
        <div className="min-w-[13rem] flex-1">
          <Campo rotulo="Nome completo" erro={erros.nomeCompleto}>
            {(p) => <input {...p} autoComplete="name" value={dados.nomeCompleto} onChange={(e) => muda('nomeCompleto', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
        </div>
        <div className="w-[9.5rem]">
          <Campo rotulo="Nascimento" erro={erros.nascimento} ajuda={idade !== null ? `${idade} ${idade === 1 ? 'ano' : 'anos'}` : undefined}>
            {(p) => <input {...p} type="date" autoComplete="bday" value={dados.nascimento} onChange={(e) => muda('nascimento', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
        </div>
        <div className="w-[8rem]">
          <Campo rotulo="Sexo" erro={erros.sexo}>
            {(p) => (
              <select {...p} value={dados.sexo} onChange={(e) => muda('sexo', e.target.value as DadosPessoais['sexo'])} className={classeEntrada(p)}>
                <option value="">Escolha</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
                <option value="outro">Outro</option>
              </select>
            )}
          </Campo>
        </div>
        <div className="w-[10rem]">
          <Campo rotulo="WhatsApp" erro={erros.whatsapp}>
            {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" value={dados.whatsapp} onChange={(e) => muda('whatsapp', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
        </div>
        <div className="min-w-[13rem] flex-1">
          <Campo rotulo="E-mail (opcional)" erro={erros.email}>
            {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={dados.email} onChange={(e) => muda('email', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
        </div>
        {/* Cidade e UF sempre juntas na mesma linha; a cidade cresce */}
        <div className="flex min-w-[15rem] flex-1 gap-3">
          <div className="min-w-0 flex-1">
            <Campo rotulo="Cidade" erro={erros.cidade}>
              {(p) => <input {...p} autoComplete="address-level2" value={dados.cidade} onChange={(e) => muda('cidade', e.target.value)} className={classeEntrada(p)} />}
            </Campo>
          </div>
          <div className="w-[5.5rem] flex-none">
            <Campo rotulo="UF" erro={erros.uf}>
              {(p) => (
                <select {...p} value={dados.uf} onChange={(e) => muda('uf', e.target.value)} className={classeEntrada(p)}>
                  <option value="">—</option>
                  {UFS.map((u) => <option key={u}>{u}</option>)}
                </select>
              )}
            </Campo>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section aria-labelledby="h-form" className="scroll-mt-4 pt-4 pb-14">
      {!pronto && etapa === 0 && whatsapp && pedido.data && (
        <div role="status" className="mx-auto mb-4 max-w-3xl border-l-4 border-(--esp) bg-branco px-5 py-3 text-[15px] leading-snug">
          <b className="block">✓ Solicitação de agendamento registrada</b>
          <span className="block">{diaComSemana(pedido.data)} · {horaCurta(pedido.inicio ?? '')} · {NOME_MODALIDADE[pedido.modalidade]}</span>
          <span className="block text-apagado">Confirmação pelo WhatsApp {formatarWhatsapp(whatsapp)}</span>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <div className="border border-linha bg-branco p-4 shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)] sm:px-8 sm:py-5" style={{ borderTop: '4px solid var(--esp)' }}>
          {pronto ? (
            <div role="status">
              <h2 id="h-form" ref={titulo} tabIndex={-1} className="text-[clamp(28px,4vw,38px)] leading-tight font-bold outline-none">Falta só enviar.</h2>
              <p className="mt-3 text-[17px]">
                O WhatsApp abriu com o formulário pronto. Toque em enviar para {medico.tratamento} {medico.nome} receber antes da consulta.
              </p>
              {Object.keys(fotos).length > 0 && (
                <p className="mt-2 text-[17px]">Depois, mande as fotos na mesma conversa.</p>
              )}
              <a href={linkEnvio} target="_blank" rel="noopener noreferrer" className={`${btnPrimario} mt-7 block text-center no-underline`}>
                Abrir o WhatsApp de novo
              </a>
              <button type="button" className={`${btnSecundario} mt-3`} onClick={onConcluir}>Voltar à página</button>
            </div>
          ) : (
            <form id="formulario-paciente" noValidate onSubmit={avancar}>
              {/* cabeçalho numa linha só: título, parte atual e "Fazer depois"; a barra de progresso logo abaixo */}
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="h-form" ref={titulo} tabIndex={-1} className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase outline-none">
                  Formulário da consulta
                  <span className="ml-2 font-semibold tracking-normal normal-case text-apagado">· {bloco ? `Parte ${etapa + 1} de ${blocos.length}` : 'Revisão'}</span>
                </h2>
                <button type="button" onClick={onConcluir} className="flex-none text-[14px] font-semibold text-apagado underline hover:text-tinta">Fazer depois</button>
              </div>
              <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${blocos.length}, minmax(0, 1fr))` }} aria-hidden>
                {blocos.map((b, n) => (
                  <span key={b.id} className="h-1" style={{ background: n <= etapa ? 'var(--esp)' : 'var(--color-linha)' }} />
                ))}
              </div>

              {etapa === 0 && (
                <p className="mt-4 border-l-4 border-(--esp) bg-suave px-4 py-2.5 text-[14.5px]">
                  Só a identificação é obrigatória. O restante é opcional, mas ajuda seu médico a se preparar.
                </p>
              )}

              {bloco ? (
                <>
                  <h3 ref={tituloBloco} tabIndex={-1} className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 outline-none">
                    <span aria-hidden className="grid h-8 w-8 flex-none place-items-center bg-(--esp)/12 text-[14px] font-bold text-(--esp)">{etapa + 1}</span>
                    <span className="text-[22px] leading-tight font-bold">{bloco.titulo}</span>
                    <span className={`px-2 py-0.5 text-[11px] font-bold tracking-[.1em] uppercase ${bloco.obrigatorio ? 'bg-(--esp) text-papel' : 'bg-suave text-apagado'}`}>
                      {bloco.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    </span>
                  </h3>
                  <div className="mt-4">{conteudoDoBloco(bloco)}</div>
                </>
              ) : (
                <>
                  <h3 ref={tituloBloco} tabIndex={-1} className="mt-4 text-[22px] leading-tight font-bold outline-none">Revise e envie</h3>
                  <ul className="mt-4 border-t border-linha">
                    {blocos.map((b, n) => {
                      const ok = blocoRespondido(b, estado)
                      return (
                        <li key={b.id} className="flex items-center gap-3 border-b border-linha py-2 text-[15px]">
                          <span aria-hidden className={`w-5 text-center font-bold ${ok ? 'text-(--esp)' : 'text-apagado'}`}>{ok ? '✓' : '–'}</span>
                          <span className="min-w-0 flex-1">{n + 1}. {b.titulo}</span>
                          <span className="hidden text-[13px] text-apagado sm:inline">{ok ? 'respondido' : 'não respondido'}</span>
                          <button type="button" onClick={() => setEtapa(n)} className="text-[14px] font-semibold text-(--esp) underline" aria-label={`Editar ${b.titulo}`}>Editar</button>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="mt-5 text-[14px] text-apagado">
                    {medico.tratamento} {medico.nome} confere e completa as respostas com você na consulta.
                  </p>
                </>
              )}

              {/* navegação numa linha só: Voltar à esquerda; Pular e Próximo à direita */}
              <div className="mt-5 flex items-center gap-4 border-t border-linha pt-4 text-[14.5px] font-semibold">
                {etapa > 0 && (
                  <button type="button" onClick={() => setEtapa(etapa - 1)} className="text-apagado underline hover:text-tinta">Voltar</button>
                )}
                <span className="flex-1" />
                {bloco && !bloco.obrigatorio && (
                  <button type="button" onClick={() => setEtapa(etapa + 1)} className="text-apagado underline hover:text-tinta">Pular</button>
                )}
                <button type="submit" className="bg-(--esp) px-7 py-3 text-[16px] font-bold text-papel transition hover:-translate-y-0.5">
                  {bloco ? 'Próximo' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
