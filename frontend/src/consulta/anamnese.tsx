// Página 1, coluna da esquerda: anamnese (formulário, gravar e escrever), perguntas e sinais de alerta.
// Formulário: o mesmo que o paciente viu, já respondido; o médico troca de modo quando quiser, sem perder nada.
// Na anamnese só entra o que é transcrito ou escrito. Pergunta clicada = o médico vai perguntar (grava ou escreve a resposta).
// Lembrete do formulário clicado: abre as opções da pergunta (Sim/Não, Todo dia/Às vezes...) ou uma linha para escrever;
// a resposta vai para a história, na seção certa (pedido do autor, 19/11/2026).
// Sinal de alerta: o médico pergunta e marca V ou F; V vai para a história clínica (não para a anamnese).
import { useEffect, useRef, useState } from 'react'
import { alternarOpcao, type Parte, type Pergunta as PerguntaFormulario } from '../medico/pre-consulta'
import type { Respostas } from '../servidor/agenda'
import { FORMULARIO_VAZIO, formularioParaHistoria, juntarFormularioAoTexto, lembretesDoFormulario, textoDoFormulario, type FormularioConsulta } from './formulario-consulta'
import { blocosDaAnamnese } from '../medico/blocos'
import { FormularioMedico } from './formulario-medico'
import type { Alerta, Fala, Pergunta, RespostaPergunta } from './exemplo'
import type { EstadoConsulta, RespostaAlerta, Situacao } from './tipos'
import { SEM_CORRETOR } from './campo-linha'
import { BotaoOficializar, Cartao, ROTULO } from './ui'

/** Simulação: uma fala nova a cada 3 s de gravação. */
const SEGUNDOS_POR_FALA = 3

/** Respostas aos sinais de alerta: letra no botão, significado na legenda do rodapé. */
const RESPOSTAS = [
  { id: 'v', icone: 'V', nome: 'Sim' },
  { id: 'f', icone: 'F', nome: 'Não' },
] as const

type Props = {
  falas: Fala[]
  perguntas: Pergunta[]
  alertas: Alerta[]
  respostas: EstadoConsulta['alertas']
  situacao: Situacao
  pendencias: number
  podeGravar: boolean
  onEditar: () => void
  onResponder: (id: string, r: RespostaAlerta) => void
  /** perguntas do formulário da especialidade */
  partes: Parte[]
  /** o formulário que o paciente enviou (null = não enviou; o médico pode preencher) */
  formulario: FormularioConsulta | null
  /** retorno: a página vira "Evolução" (sem Formulário; o paciente já passou por ele na consulta) */
  retorno?: boolean
  /** consulta retomada do servidor: o texto e as respostas que já estavam salvos */
  textoInicial?: string
  perguntasIniciais?: RespostaPergunta[]
  /** salva com o texto atual (a história clínica é montada com ele) */
  onOficializar: (texto: string, perguntas: RespostaPergunta[], formulario: FormularioConsulta | null) => void
}

export function Anamnese({ falas, perguntas, alertas, respostas, situacao, pendencias, podeGravar, partes, formulario, retorno = false, textoInicial = '', perguntasIniciais = [], onEditar, onResponder, onOficializar }: Props) {
  const [modo, setModo] = useState<'texto' | 'formulario'>('texto')
  const [form, setForm] = useState<FormularioConsulta>(formulario ?? FORMULARIO_VAZIO)
  const [parte, setParte] = useState(0)
  const [conferidas, setConferidas] = useState<boolean[]>(() => blocosDaAnamnese(partes).map(() => false))
  /** texto do formulário que já está na caixa (null = ainda não salvo) */
  const [textoForm, setTextoForm] = useState<string | null>(null)
  /** o formulário como estava ao ser salvo (a história é escrita a partir dele) */
  const [formSalvo, setFormSalvo] = useState<FormularioConsulta | null>(null)
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  /** a anamnese numa caixa só: a transcrição entra no fim do texto, e o médico escreve e corrige ali mesmo */
  const [texto, setTexto] = useState(textoInicial)
  /** pergunta clicada (riscada = foi feita) → resposta do médico (null = ainda sem Sim/Não) */
  const [perguntado, setPerguntado] = useState<Record<string, 'sim' | 'nao' | null>>(() => Object.fromEntries(perguntasIniciais.map((r) => [r.pergunta.texto, r.resposta])))
  /** o que o médico escreveu nas perguntas abertas (aprofundamento do retorno), pelo texto da pergunta */
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(perguntasIniciais.flatMap((r) => (r.texto ? [[r.pergunta.texto, r.texto]] : []))))
  /** respostas dos lembretes do formulário, pela chave da pergunta */
  const [respLembrete, setRespLembrete] = useState<Respostas>({})
  /** o aviso de sinais pendentes só aparece depois de tentar salvar */
  const [tentou, setTentou] = useState(false)
  const proxima = useRef(0)
  const caixa = useRef<HTMLTextAreaElement>(null)
  const oficializado = situacao === 'oficializado'

  const transcrever = () => {
    if (proxima.current >= falas.length) return
    const f = falas[proxima.current++]
    setTexto((x) => `${x}${x && !x.endsWith('\n') ? '\n' : ''}${f.quem}: ${f.texto}\n`)
  }

  useEffect(() => {
    if (!gravando) return
    let n = 0
    const t = setInterval(() => {
      setSegundos((s) => s + 1)
      if (++n % SEGUNDOS_POR_FALA === 0) transcrever()
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravando])

  // a transcrição nova aparece no fim da caixa
  useEffect(() => {
    if (gravando && caixa.current) caixa.current.scrollTop = caixa.current.scrollHeight
  }, [texto, gravando])

  const mudou = () => { if (situacao !== 'revisado_medico') onEditar() }

  const alternar = () => {
    if (!gravando) { mudou(); transcrever() }
    setModo('texto')
    setGravando((g) => !g)
  }
  const escrever = () => {
    setModo('texto')
    requestAnimationFrame(() => caixa.current?.focus())
  }
  /** Salvar formulário: vira texto no começo da caixa e a tela volta à anamnese (Perguntas, Sinais de alerta) */
  const salvarFormulario = () => {
    const novo = textoDoFormulario(partes, form, new Date())
    setTexto((t) => juntarFormularioAoTexto(t, novo, textoForm))
    setTextoForm(novo)
    setFormSalvo(form)
    setModo('texto')
    mudou()
  }
  // começou a gravar, a escrever ou salvou o formulário: o que o paciente não respondeu vira lembrete em Perguntas (Alergias, sempre)
  const camposLembrete = !retorno && (segundos > 0 || textoForm !== null || texto.trim() !== '') ? lembretesDoFormulario(partes, form) : []
  const lembretes = camposLembrete.map((q) => ({ texto: q.rotulo, sim: '', nao: '', secao: 'hda' as const, lembrete: true }))
  const campoDoLembrete = (rotulo: string) => camposLembrete.find((q) => q.rotulo === rotulo)
  const responderLembrete = (id: string, v: string | string[]) => { setRespLembrete((r) => ({ ...r, [id]: v })); mudou() }

  /** opções da pergunta (uma ou várias) ou uma linha para escrever, do jeito que o paciente viu */
  const respostaLembrete = (q: PerguntaFormulario) => {
    const atual = respLembrete[q.id] ?? form.respostas[q.id] ?? (q.tipo === 'varias' ? [] : '')
    const botao = (ativo: boolean) => `shrink-0 border-[1.5px] px-2 py-0.5 text-[13px] font-bold ${ativo ? 'border-tinta bg-tinta text-papel' : 'border-linha hover:bg-suave'}`
    if (q.opcoes && (q.tipo === 'escolha' || q.tipo === 'varias')) {
      const marcadas = Array.isArray(atual) ? atual : atual ? [atual] : []
      return q.opcoes.map((op) => (
        <button key={op} type="button" aria-pressed={marcadas.includes(op)} className={botao(marcadas.includes(op))}
          onClick={() => responderLembrete(q.id, q.tipo === 'varias' ? alternarOpcao(marcadas, op, q.exclusiva) : marcadas.includes(op) ? '' : op)}>
          {op}
        </button>
      ))
    }
    const valor = Array.isArray(atual) ? atual.join(', ') : atual
    return (
      <>
        <input {...SEM_CORRETOR} value={valor} placeholder={q.placeholder ?? 'Resposta'} aria-label={`Resposta: ${q.rotulo}`}
          onChange={(e) => responderLembrete(q.id, e.target.value)}
          className="min-w-[10rem] flex-1 border-b-[1.5px] border-linha bg-transparent px-1 py-0.5 text-[13.5px] focus:border-tinta focus:outline-none" />
        {q.semResposta && (
          <button type="button" aria-pressed={valor === q.semResposta} className={botao(valor === q.semResposta)} onClick={() => responderLembrete(q.id, q.semResposta!)}>
            {q.semResposta}
          </button>
        )}
      </>
    )
  }
  const principais: Pergunta[] = [...perguntas, ...lembretes.filter((l) => !perguntas.some((p) => p.texto === l.texto))]
  // Sim numa pergunta com aprofundamento (efeito colateral, sinal novo): as perguntas dela aparecem logo abaixo
  const todas = principais.flatMap((p) => [{ ...p, filho: false }, ...(perguntado[p.texto] === 'sim' ? (p.aprofundar ?? []).map((a) => ({ ...a, filho: true })) : [])])
  const botaoModo = (ativo: boolean) =>
    `border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold ${ativo ? 'bg-tinta text-papel' : 'hover:bg-tinta hover:text-papel'}`

  return (
    <Cartao
      titulo={retorno ? 'Evolução' : 'Anamnese'}
      cabecalho={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-3">
          {!retorno && (
            <button type="button" onClick={() => setModo('formulario')} aria-pressed={modo === 'formulario'} className={botaoModo(modo === 'formulario')}>
              Formulário
            </button>
          )}
          <button type="button" onClick={alternar} disabled={!podeGravar} aria-pressed={gravando} className="flex items-center gap-2 bg-tinta px-3 py-1.5 text-[14px] font-bold text-papel disabled:opacity-40">
            <span className={`inline-block size-2.5 rounded-full! bg-alerta-clinico ${gravando ? 'animate-pulse' : ''}`} />
            {gravando ? 'Pausar' : segundos > 0 ? 'Continuar' : 'Gravar'}
          </button>
          <span className="font-titulo text-[22px] font-semibold tabular-nums" aria-label="Tempo de gravação">{tempo(segundos)}</span>
          {(!podeGravar || gravando) && (
            <span className="truncate text-[13px] text-apagado">{!podeGravar ? 'Sem consentimento de gravação' : 'Gravando · consentimento na ficha'}</span>
          )}
          <button type="button" onClick={escrever} aria-pressed={modo === 'texto' && !gravando} className={botaoModo(false)}>
            Escrever
          </button>
        </div>
      }
      legenda={alertas.length > 0 && RESPOSTAS.map((x) => `${x.icone} = ${x.nome.toLowerCase()}`).join(" · ")}
      rodape={
        <BotaoOficializar
          rotulo={retorno ? 'Salvar evolução' : 'Salvar anamnese'}
          oficializado={oficializado}
          bloqueado={!texto.trim()}
          motivo={!tentou ? undefined : pendencias > 0 ? `${pendencias === 1 ? 'Falta 1 sinal' : `Faltam ${pendencias} sinais`}` : gravando ? 'Pause a gravação' : undefined}
          onClick={() => {
            if (pendencias > 0 || gravando) return setTentou(true)
            setTentou(false)
            // só as perguntas com Sim/Não vão para a história (riscada sem resposta = o médico não quis perguntar)
            // lembretes: só os riscados (perguntados) e respondidos
            const lembretesFeitos = Object.fromEntries(camposLembrete.filter((q) => q.rotulo in perguntado && q.id in respLembrete).map((q) => [q.id, respLembrete[q.id]]))
            // as de aprofundamento só entram se a pergunta-mãe foi Sim; as abertas, só com texto escrito
            const doFilho = (a: Pergunta): RespostaPergunta[] => {
              if (!(a.texto in perguntado)) return []
              if (a.aberta) return textos[a.texto]?.trim() ? [{ pergunta: a, resposta: 'sim', texto: textos[a.texto] }] : []
              const r = perguntado[a.texto]
              return r ? [{ pergunta: a, resposta: r }] : []
            }
            onOficializar(texto, perguntas.flatMap((p) => { const r = perguntado[p.texto]; return r && !p.lembrete ? [{ pergunta: p, resposta: r }, ...(r === 'sim' ? (p.aprofundar ?? []).flatMap(doFilho) : [])] : [] }),
              formularioParaHistoria(formSalvo, form.dados, lembretesFeitos))
          }}
        />
      }
    >
      {/* a caixa ocupa a altura que sobra no cartão (o cartão desce até perto do rodapé) */}
      {/* no retorno, com as perguntas de aprofundamento abertas, a caixa encolhe para a página caber numa tela */}
      <div className={`flex flex-1 flex-col border-[1.5px] border-linha focus-within:border-tinta ${retorno ? 'min-h-[90px] lg:min-h-[76px]' : 'min-h-[118px] lg:min-h-[150px]'}`}>
        {modo === 'formulario' && (
          <FormularioMedico partes={partes} valor={form} parte={parte} onParte={setParte} onMudar={(f) => { setForm(f); mudou() }}
            conferidas={conferidas} onConferir={(n) => setConferidas((c) => c.map((x, i) => (i === n ? true : x)))}
            onSalvar={salvarFormulario} salvo={textoForm !== null} />
        )}
        <textarea
          ref={caixa}
          {...SEM_CORRETOR}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); mudou() }}
          placeholder={retorno ? 'Como está desde a consulta anterior: melhora, piora, uso do remédio, efeitos…' : 'Queixa, história, antecedentes…'}
          aria-label={retorno ? 'Evolução' : 'Anamnese'}
          className={`${modo === 'formulario' ? 'hidden' : 'block'} min-h-0 w-full flex-1 resize-none bg-branco px-3 py-2 text-[14.5px] leading-snug focus:outline-none`}
        />
      </div>

      {todas.length > 0 && (
        <div className="mt-3">
          <p className={ROTULO}>Perguntas</p>
          {/* lembretes do formulário lado a lado (cabem numa tela); as da IA, uma por linha com Sim/Não */}
          <div className={`mt-1 flex flex-wrap items-start gap-1 overflow-y-auto ${retorno ? 'max-h-[168px]' : 'max-h-[88px]'}`}>
            {todas.map(({ texto: q, lembrete, aberta, filho }) => {
              const feito = q in perguntado
              const r = perguntado[q]
              const campo = lembrete ? campoDoLembrete(q) : undefined
              return (
                // clicar risca (a pergunta foi feita) e abre Sim/Não; a resposta vai para a história, não para a anamnese
                <div key={q} className={`flex max-w-full flex-wrap items-center gap-1.5 ${(lembrete || filho) && !feito ? '' : 'basis-full'}`}>
                  <button type="button" aria-pressed={feito}
                    onClick={() => {
                      setPerguntado((p) => { const n = { ...p }; if (feito) delete n[q]; else n[q] = null; return n })
                      if (feito && r) mudou()
                    }}
                    className={`min-w-0 truncate border-[1.5px] px-2 py-0.5 text-left text-[13.5px] ${feito ? 'border-linha text-apagado line-through' : 'border-dashed border-(--esp-medio)'}`}>
                    {q}
                  </button>
                  {feito && campo && respostaLembrete(campo)}
                  {feito && aberta && (
                    <input {...SEM_CORRETOR} value={textos[q] ?? ''} aria-label={`Resposta: ${q}`} placeholder="Escreva"
                      onChange={(e) => { setTextos((t) => ({ ...t, [q]: e.target.value })); mudou() }}
                      className="min-w-[10rem] flex-1 border-b-[1.5px] border-linha bg-transparent px-1 py-0.5 text-[13.5px] focus:border-tinta focus:outline-none" />
                  )}
                  {feito && !lembrete && !aberta && (['sim', 'nao'] as const).map((op) => (
                    <button key={op} type="button" aria-pressed={r === op}
                      onClick={() => { setPerguntado((p) => ({ ...p, [q]: r === op ? null : op })); mudou() }}
                      className={`shrink-0 border-[1.5px] px-2 py-0.5 text-[13px] font-bold ${r === op ? 'border-tinta bg-tinta text-papel' : 'border-linha hover:bg-suave'}`}>
                      {op === 'sim' ? 'Sim' : 'Não'}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className={ROTULO}>Sinais de alerta</p>
          {alertas.map((a) => {
            const r = respostas[a.id]
            // cartão branco, letras vermelhas; responder não muda o cartão (só o ícone marca)
            const estilo = 'border-[1.5px] border-linha bg-branco text-alerta-clinico'
            return (
              <div key={a.id} className={`flex items-center gap-3 py-0.5 pr-1 pl-3 text-[14px] ${estilo}`}>
                <span title={a.texto} className={`min-w-0 flex-1 truncate ${a.tipo === 'alergia' ? 'font-semibold' : ''}`}>{a.texto}</span>
                <span className="flex shrink-0 gap-1">
                  {RESPOSTAS.map((op) => (
                    <button key={op.id} type="button" onClick={() => { if (r !== op.id) { onResponder(a.id, op.id); mudou() } }} aria-pressed={r === op.id} aria-label={op.nome} title={op.nome}
                      className={`size-7 text-[15px] font-bold leading-none ${r === op.id ? 'bg-tinta text-papel' : 'text-tinta hover:bg-suave'}`}>
                      {op.icone}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      )}

    </Cartao>
  )
}

function tempo(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
