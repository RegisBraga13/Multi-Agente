import { useEffect, useRef, useState, type FormEvent } from 'react'
import { buscarEspecialidade } from '../especialidades'
import { Campo } from './campo'
import { CamposIdentificacao } from './campos-identificacao'
import { btnSecundario, classeEntrada } from './estilos'
import { enviarFormulario, ErroServidor, lerComoBase64 } from '../servidor/agenda'
import { blocoRespondido, blocosDoFormulario, faltaResponder, type Bloco } from './blocos'
import { GrupoOpcoes } from './opcoes'
import { TextoCrescente } from './texto-crescente'
import { alternarOpcao, chaveDaLinha, partesPreConsulta, perguntaTrabalho, perguntaVisivel, type Pergunta, type RespostasPreConsulta } from './pre-consulta'
import { chavesDeDocumentos, ESTADOS_CIVIS, MAX_DOCUMENTOS, formatarWhatsapp, normalizarWhatsapp, validarDadosPessoais, validarFoto, type DadosPessoais, type RascunhoPedido } from './regras'
import { diaComSemana, horaCurta, NOME_MODALIDADE } from './textos'
import type { Medico } from './tipos'

/** `token`: link do formulário deste pedido (as respostas vão para o servidor por ele) */
type Props = { medico: Medico; token: string; pedido: RascunhoPedido; onConcluir(): void }
type Foto = { nome: string; url: string; arquivo: File }

const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
const comoOpcoes = (lista: readonly string[]) => lista.map((t) => ({ valor: t, rotulo: t }))
/** Texto longo, foto e listas grandes de opções ocupam a linha toda; o resto divide a linha no PC. */
const ocupaLinhaToda = (q: Pergunta) =>
  q.linhaToda || q.escala || q.duasColunas || q.tipo === 'texto-longo' || q.tipo === 'foto' || q.tipo === 'arquivos' || (q.opcoes ?? []).join('').length > 28
const semChave = <T,>(r: Record<string, T>, chave: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== chave))

/** Formulário do paciente, aberto dentro da página logo depois do pedido enviado. */
export function FormularioPaciente({ medico, token, pedido, onConcluir }: Props) {
  const whatsapp = normalizarWhatsapp(pedido.whatsapp)
  const [dados, setDados] = useState<DadosPessoais>({
    nomeCompleto: pedido.nome, nomeSocial: '', nascimento: '', sexo: '', whatsapp: pedido.whatsapp, email: '', cidade: '', uf: '',
    estadoCivil: '', profissao: '', trabalhoExposto: '',
  })
  const partes = partesPreConsulta(medico.especialidade)
  const especialidade = buscarEspecialidade(medico.especialidade)?.nome
  const [pre, setPre] = useState<RespostasPreConsulta>({})
  const [errosPre, setErrosPre] = useState<Record<string, string>>({})
  const [erros, setErros] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [tentou, setTentou] = useState(false)
  const [fotos, setFotos] = useState<Record<string, Foto>>({})
  const [errosFoto, setErrosFoto] = useState<Record<string, string>>({})
  const [pronto, setPronto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const blocos = blocosDoFormulario(partes)
  const [etapa, setEtapa] = useState(0)
  const tituloBloco = useRef<HTMLHeadingElement>(null)
  const primeiraEtapa = useRef(true)
  const titulo = useRef<HTMLHeadingElement>(null)

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
  const mudaPre = (id: string, valor: string | string[]) => {
    setPre((p) => ({ ...p, [id]: valor }))
    setErrosPre((e) => semChave(e, id))
  }

  function escolherFoto(id: string, arquivo: File | undefined) {
    const antiga = fotos[id]
    if (antiga) URL.revokeObjectURL(antiga.url)
    const outras = semChave(fotos, id)
    const outrosErros = semChave(errosFoto, id)
    const erro = arquivo && validarFoto(arquivo)
    setFotos(arquivo && !erro ? { ...outras, [id]: { nome: arquivo.name, url: URL.createObjectURL(arquivo), arquivo } } : outras)
    setErrosFoto(erro ? { ...outrosErros, [id]: erro } : outrosErros)
  }

  /** receitas, exames, laudos: troca a lista inteira de uma vez (até MAX_DOCUMENTOS) */
  function escolherDocumentos(id: string, lista: File[], soFotos = false) {
    const atuais = Object.keys(fotos).filter((k) => k.startsWith(`${id}_`))
    atuais.forEach((k) => URL.revokeObjectURL(fotos[k].url))
    const outras = Object.fromEntries(Object.entries(fotos).filter(([k]) => !k.startsWith(`${id}_`)))
    const erro = lista.length > MAX_DOCUMENTOS ? `Envie até ${MAX_DOCUMENTOS} arquivos.` : lista.map((f) => validarFoto(f, !soFotos)).find(Boolean) ?? null
    const validos = erro ? [] : lista
    const novos = Object.fromEntries(chavesDeDocumentos(id, validos.length).map((k, i) => [k, { nome: validos[i].name, url: URL.createObjectURL(validos[i]), arquivo: validos[i] }]))
    setFotos({ ...outras, ...novos })
    setErrosFoto(erro ? { ...semChave(errosFoto, id), [id]: erro } : semChave(errosFoto, id))
  }

  function campoPergunta(q: Pergunta, compacto = false) {
    const valor = pre[q.id]
    if (q.tipo === 'escolha' && q.lista) {
      return (
        <Campo key={q.id} rotulo={q.rotulo} ajuda={q.ajuda}>
          {(p) => (
            <select {...p} value={typeof valor === 'string' ? valor : ''} onChange={(e) => mudaPre(q.id, e.target.value)} className={`${classeEntrada(p)} w-auto max-w-full`}>
              <option value="">Escolha</option>
              {(q.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </Campo>
      )
    }
    if (q.tipo === 'escolha' && q.escala) {
      const nota = typeof valor === 'string' ? valor : ''
      return (
        <fieldset key={q.id}>
          <legend className="mb-1.5 text-[14px] font-semibold">{q.rotulo}</legend>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12.5px] text-apagado" aria-hidden>sem dor</span>
            {(q.opcoes ?? []).map((o) => (
              <label key={o} className={`grid h-9 w-9 cursor-pointer place-items-center border-[1.5px] text-[15px] transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--esp) ${nota === o ? 'border-(--esp) bg-(--esp) font-bold text-papel' : 'border-linha bg-papel hover:border-tinta'}`}>
                <input type="radio" name={q.id} value={o} checked={nota === o} onChange={() => mudaPre(q.id, o)} className="sr-only" />
                {o}
              </label>
            ))}
            <span className="text-[12.5px] text-apagado" aria-hidden>pior dor</span>
          </div>
        </fieldset>
      )
    }
    if (q.tipo === 'escolha' || q.tipo === 'varias') {
      const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : []
      const linha = pre[chaveDaLinha(q.id)]
      return (
        <div key={q.id} className="grid gap-1.5">
          <GrupoOpcoes rotulo={q.rotulo} ajuda={q.ajuda} modo={q.tipo === 'escolha' ? 'uma' : 'varias'} duasColunas={q.duasColunas} compacto={compacto}
            opcoes={comoOpcoes(q.opcoes ?? [])} marcadas={marcadas}
            onAlternar={(o) => mudaPre(q.id, q.tipo === 'escolha' ? o : alternarOpcao(marcadas, o, q.exclusiva))}
            aoLado={q.abreLinha ? {
              valor: q.abreLinha,
              // uma linha que cresce para baixo enquanto escreve
              campo: <TextoCrescente aria-label={`${q.abreLinha}: ${q.placeholder ?? 'escreva'}`} placeholder={q.placeholder} autoFocus
                value={typeof linha === 'string' ? linha : ''} onChange={(e) => mudaPre(chaveDaLinha(q.id), e.target.value)}
                className="block w-full border-[1.5px] border-(--esp) bg-branco px-2 py-[3px] text-[14px] leading-tight outline-none" />,
            } : undefined} />
          {q.dica && marcadas.includes(q.dica.opcao) && <p className="text-[13px] font-semibold text-(--esp)">{q.dica.texto}</p>}
        </div>
      )
    }
    if (q.tipo === 'arquivos') {
      const escolhidos = Object.entries(fotos).filter(([k]) => k.startsWith(`${q.id}_`))
      return (
        <div key={q.id} className="grid gap-2">
          <Campo rotulo={q.rotulo} erro={errosFoto[q.id]} ajuda={q.ajuda}>
            {(p) => (
              <input {...p} type="file" multiple accept={q.soFotos ? 'image/*' : 'image/*,application/pdf'} onChange={(e) => escolherDocumentos(q.id, Array.from(e.target.files ?? []), q.soFotos)}
                className="block w-full text-[15px] file:mr-4 file:border-[1.5px] file:border-tinta file:bg-transparent file:px-4 file:py-2.5 file:font-semibold" />
            )}
          </Campo>
          {escolhidos.length > 0 && (
            <ul className="text-[14px] text-apagado">
              {escolhidos.map(([k, f]) => <li key={k}>✓ {f.nome}</li>)}
            </ul>
          )}
        </div>
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
    const rotulo = q.obrigatoria ? `${q.rotulo} (obrigatória)` : q.rotulo
    if (q.semResposta) {
      // um toque responde "não tenho"; tocar de novo volta a deixar escrever
      const nao = texto === q.semResposta
      return (
        <Campo key={q.id} rotulo={rotulo} ajuda={q.ajuda} erro={errosPre[q.id]}>
          {(p) => (
            <div className="flex flex-wrap gap-2">
              {!nao && <input {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={`${classeEntrada(p)} min-w-[12rem] flex-1`} />}
              <button type="button" aria-pressed={nao} onClick={() => mudaPre(q.id, nao ? '' : q.semResposta!)}
                className={`flex-none border-[1.5px] px-4 py-2.5 text-[15px] font-semibold transition ${nao ? 'border-(--esp) bg-(--esp) text-papel' : 'border-tinta hover:bg-suave'}`}>
                {nao ? `✓ ${q.semResposta}` : q.semResposta}
              </button>
            </div>
          )}
        </Campo>
      )
    }
    return (
      <Campo key={q.id} rotulo={rotulo} ajuda={q.ajuda} erro={errosPre[q.id]} rotuloOculto={q.semRotulo}>
        {(p) => q.tipo === 'texto-longo'
          ? <TextoCrescente {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />
          : <input {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />}
      </Campo>
    )
  }

  // um bloco por vez; o último passo é a revisão
  const ultimo = blocos.length // índice da revisão
  const bloco = blocos[etapa] as Bloco | undefined
  const estado = { dados, respostas: pre, fotos: Object.keys(fotos), hoje: new Date() }
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

  /** Marca as perguntas obrigatórias sem resposta do bloco; devolve true se não falta nada. */
  function conferirObrigatorias(b: Bloco): boolean {
    const falta = faltaResponder(b, estado)
    if (!falta.length) return true
    setErrosPre((e) => ({ ...e, ...Object.fromEntries(falta.map((id) => [id, 'Escreva qual alergia ou toque em “Não tenho alergia”.'])) }))
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#formulario-paciente [aria-invalid="true"]')?.focus())
    return false
  }

  async function enviar() {
    setEnviando(true)
    setErroEnvio(null)
    try {
      const fotosBase64 = Object.fromEntries(
        await Promise.all(Object.entries(fotos).map(async ([id, f]) => [id, await lerComoBase64(f.arquivo)] as const)),
      )
      // só as perguntas que aparecem para este paciente e foram respondidas
      // a linha do "Outro" (ou de "Após algum evento") só vai se a opção continua marcada
      const linhaAberta = (q: Pergunta) => { const v = pre[q.id]; return !!q.abreLinha && (Array.isArray(v) ? v.includes(q.abreLinha) : v === q.abreLinha) }
      const visiveis = new Set(partes.flatMap((pt) => pt.perguntas.filter((q) => perguntaVisivel(q, dados.sexo, pre))
        .flatMap((q) => (linhaAberta(q) ? [q.id, chaveDaLinha(q.id)] : [q.id]))))
      const respostas = Object.fromEntries(Object.entries(pre).filter(([id, v]) => visiveis.has(id) && (Array.isArray(v) ? v.length > 0 : v.trim())))
      await enviarFormulario(token, { dados: { ...dados, sexo: dados.sexo || 'I' }, respostas, fotos: fotosBase64 })
      setPronto(true)
    } catch (erro) {
      setErroEnvio(erro instanceof ErroServidor ? erro.message : 'Não foi possível enviar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  function avancar(ev: FormEvent) {
    ev.preventDefault()
    // na identificação, todos os erros aparecem juntos
    const identOk = etapa !== 0 || validarIdentificacao()
    const obrigOk = !bloco || conferirObrigatorias(bloco)
    if (!identOk || !obrigOk) return
    if (etapa < ultimo) return setEtapa(etapa + 1)
    if (!validarIdentificacao()) return setEtapa(0)
    // quem pulou para a revisão sem responder uma obrigatória volta ao bloco dela
    const pendente = blocos.findIndex((b) => faltaResponder(b, estado).length > 0)
    if (pendente >= 0) {
      conferirObrigatorias(blocos[pendente])
      return setEtapa(pendente)
    }
    if (!enviando) void enviar()
  }

  function conteudoDoBloco(b: Bloco) {
    if ('parte' in b) {
      return (
        <>
          {b.parte.colunas ? (
            // parte em duas colunas no PC (cabe numa tela); no celular, uma pergunta abaixo da outra
            <div className={`grid gap-3.5 sm:gap-x-6 ${b.parte.compacta ? "sm:grid-cols-[5fr_6fr]" : "sm:grid-cols-2"}`}>
              {b.parte.colunas.map((ids, i) => (
                <div key={i} className="grid content-start gap-3.5">
                  {ids.map((id) => b.parte.perguntas.find((q) => q.id === id)).filter((q): q is Pergunta => !!q && perguntaVisivel(q, dados.sexo, pre)).map((q) => (
                    <div key={q.id}>{campoPergunta(q, b.parte.compacta)}</div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            // no PC, perguntas curtas lado a lado; as longas ocupam a linha toda
            <div className="grid gap-3.5 sm:grid-flow-row-dense sm:grid-cols-[3fr_2fr] sm:gap-x-5">
              {b.parte.perguntas.filter((q) => perguntaVisivel(q, dados.sexo, pre)).map((q) => (
                <div key={q.id} className={ocupaLinhaToda(q) ? 'sm:col-span-2' : ''}>{campoPergunta(q)}</div>
              ))}
            </div>
          )}
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
          <GrupoOpcoes rotulo={perguntaTrabalho(partes).rotulo} modo="uma" opcoes={SIM_NAO}
            marcadas={[dados.trabalhoExposto]} onAlternar={(v) => muda('trabalhoExposto', v as DadosPessoais['trabalhoExposto'])} />
        </div>
      )
    }
    return <CamposIdentificacao dados={dados} erros={erros} muda={muda} />
  }

  return (
    <section aria-labelledby="h-form" className="scroll-mt-4 pt-3 pb-4">
      {!pronto && etapa === 0 && whatsapp && pedido.data && (
        <div role="status" className="mx-auto mb-3 max-w-3xl border-l-4 border-(--esp) bg-branco px-5 py-2 text-[14.5px] leading-snug">
          <b>✓ Agendado</b> · {diaComSemana(pedido.data)} · {horaCurta(pedido.inicio ?? '')} · {NOME_MODALIDADE[pedido.modalidade]}
          <span className="text-apagado"> · confirmação no WhatsApp {formatarWhatsapp(whatsapp)}</span>
        </div>
      )}
      <div className="mx-auto max-w-3xl">
        <div className="border border-linha bg-branco p-4 shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)] sm:px-8 sm:py-5" style={{ borderTop: '4px solid var(--esp)' }}>
          {pronto ? (
            <div role="status">
              <h2 id="h-form" ref={titulo} tabIndex={-1} className="text-[clamp(28px,4vw,38px)] leading-tight font-bold outline-none">Formulário enviado.</h2>
              <p className="mt-3 text-[17px]">
                {medico.tratamento} {medico.nome} já recebeu suas respostas{Object.keys(fotos).length > 0 ? ' e as fotos' : ''}. Obrigado!
              </p>
              <button type="button" className={`${btnSecundario} mt-7`} onClick={onConcluir}>Voltar à página</button>
            </div>
          ) : (
            <form id="formulario-paciente" noValidate onSubmit={avancar}>
              {/* cabeçalho numa linha só: título, parte atual e "Fazer depois"; a barra de progresso logo abaixo */}
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="h-form" ref={titulo} tabIndex={-1} className="text-[20px] leading-tight font-bold outline-none">
                  {especialidade && <><span className="text-(--esp)">{especialidade}</span> · </>}Formulário
                  <span className="ml-2 text-[14px] font-semibold text-apagado">· {bloco ? `Parte ${etapa + 1} de ${blocos.length}` : 'Revisão'}</span>
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
                  {/* mais de 8 partes: duas colunas no PC, para caber numa tela */}
                  <ul className={`mt-4 border-t border-linha ${blocos.length > 8 ? 'sm:grid sm:grid-flow-col sm:grid-cols-2 sm:gap-x-6' : ''}`}
                    style={blocos.length > 8 ? { gridTemplateRows: `repeat(${Math.ceil(blocos.length / 2)}, auto)` } : undefined}>
                    {blocos.map((b, n) => {
                      const falta = faltaResponder(b, estado).length > 0
                      const ok = !falta && blocoRespondido(b, estado)
                      return (
                        <li key={b.id} className="flex items-center gap-3 border-b border-linha py-2 text-[15px]">
                          <span aria-hidden className={`w-5 text-center font-bold ${ok ? 'text-(--esp)' : 'text-apagado'}`}>{ok ? '✓' : '–'}</span>
                          <span className="min-w-0 flex-1">{n + 1}. {b.titulo}</span>
                          <span className={`text-[13px] ${falta ? 'font-semibold text-alerta' : `hidden text-apagado ${blocos.length > 8 ? '' : 'sm:inline'}`}`}>{falta ? 'falta responder' : ok ? 'respondido' : 'não respondido'}</span>
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

              {erroEnvio && <p role="alert" className="mt-4 text-[14.5px] font-semibold text-alerta">{erroEnvio}</p>}

              {/* navegação numa linha só: Voltar à esquerda; Pular e Próximo à direita */}
              <div className="mt-5 flex items-center gap-4 border-t border-linha pt-4 text-[14.5px] font-semibold">
                {etapa > 0 && (
                  <button type="button" onClick={() => setEtapa(etapa - 1)} className="text-apagado underline hover:text-tinta">Voltar</button>
                )}
                <span className="flex-1" />
                {bloco && !bloco.obrigatorio && !('parte' in bloco && bloco.parte.semPular) && (
                  <button type="button" onClick={() => setEtapa(etapa + 1)} className="text-apagado underline hover:text-tinta">Pular</button>
                )}
                <button type="submit" disabled={enviando} className="bg-(--esp) px-7 py-3 text-[16px] font-bold text-papel transition hover:-translate-y-0.5 disabled:opacity-60">
                  {bloco ? 'Próximo' : enviando ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
