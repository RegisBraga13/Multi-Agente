// Página 1, coluna da esquerda: anamnese (gravar e escrever na mesma caixa), perguntas e sinais de alerta.
// Na anamnese só entra o que é transcrito ou escrito. Pergunta clicada = o médico vai perguntar (grava ou escreve a resposta).
// Sinal de alerta: o médico pergunta e marca V ou F; V vai para a história clínica (não para a anamnese).
import { useEffect, useRef, useState } from 'react'
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
  /** salva com o texto atual (a história clínica é montada com ele) */
  onOficializar: (texto: string, perguntas: RespostaPergunta[]) => void
}

export function Anamnese({ falas, perguntas, alertas, respostas, situacao, pendencias, podeGravar, onEditar, onResponder, onOficializar }: Props) {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  /** a anamnese numa caixa só: a transcrição entra no fim do texto, e o médico escreve e corrige ali mesmo */
  const [texto, setTexto] = useState('')
  /** pergunta clicada (riscada = foi feita) → resposta do médico (null = ainda sem Sim/Não) */
  const [perguntado, setPerguntado] = useState<Record<string, 'sim' | 'nao' | null>>({})
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
    setGravando((g) => !g)
  }

  return (
    <Cartao
      titulo="Anamnese"
      cabecalho={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={alternar} disabled={!podeGravar} aria-pressed={gravando} className="flex items-center gap-2 bg-tinta px-3 py-1.5 text-[14px] font-bold text-papel disabled:opacity-40">
            <span className={`inline-block size-2.5 rounded-full! bg-alerta-clinico ${gravando ? 'animate-pulse' : ''}`} />
            {gravando ? 'Pausar' : segundos > 0 ? 'Continuar' : 'Gravar'}
          </button>
          <span className="font-titulo text-[22px] font-semibold tabular-nums" aria-label="Tempo de gravação">{tempo(segundos)}</span>
          {(!podeGravar || gravando) && (
            <span className="truncate text-[13px] text-apagado">{!podeGravar ? 'Sem consentimento de gravação' : 'Gravando · consentimento na ficha'}</span>
          )}
          <button type="button" onClick={() => caixa.current?.focus()} className="border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold hover:bg-tinta hover:text-papel">
            Escrever
          </button>
        </div>
      }
      legenda={alertas.length > 0 && RESPOSTAS.map((x) => `${x.icone} = ${x.nome.toLowerCase()}`).join(" · ")}
      rodape={
        <BotaoOficializar
          rotulo="Salvar anamnese"
          oficializado={oficializado}
          bloqueado={!texto.trim()}
          motivo={!tentou ? undefined : pendencias > 0 ? `${pendencias === 1 ? 'Falta 1 sinal' : `Faltam ${pendencias} sinais`}` : gravando ? 'Pause a gravação' : undefined}
          onClick={() => {
            if (pendencias > 0 || gravando) return setTentou(true)
            setTentou(false)
            // só as perguntas com Sim/Não vão para a história (riscada sem resposta = o médico não quis perguntar)
            onOficializar(texto, perguntas.flatMap((p) => { const r = perguntado[p.texto]; return r ? [{ pergunta: p, resposta: r }] : [] }))
          }}
        />
      }
    >
      {/* a caixa ocupa a altura que sobra no cartão (o cartão desce até perto do rodapé) */}
      <div className="flex min-h-[118px] flex-1 flex-col border-[1.5px] border-linha focus-within:border-tinta lg:min-h-[150px]">
        <textarea
          ref={caixa}
          {...SEM_CORRETOR}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); mudou() }}
          placeholder="Queixa, história, antecedentes…"
          aria-label="Anamnese"
          className="block min-h-0 w-full flex-1 resize-none bg-branco px-3 py-2 text-[14.5px] leading-snug focus:outline-none"
        />
      </div>

      {perguntas.length > 0 && (
        <div className="mt-3">
          <p className={ROTULO}>Perguntas</p>
          <div className="mt-1 flex flex-col items-start gap-1">
            {perguntas.map(({ texto: q }) => {
              const feito = q in perguntado
              const r = perguntado[q]
              return (
                // clicar risca (a pergunta foi feita) e abre Sim/Não; a resposta vai para a história, não para a anamnese
                <div key={q} className="flex max-w-full items-center gap-1.5">
                  <button type="button" aria-pressed={feito}
                    onClick={() => {
                      setPerguntado((p) => { const n = { ...p }; if (feito) delete n[q]; else n[q] = null; return n })
                      if (feito && r) mudou()
                    }}
                    className={`min-w-0 truncate border-[1.5px] px-2 py-0.5 text-left text-[13.5px] ${feito ? 'border-linha text-apagado line-through' : 'border-dashed border-(--esp-medio)'}`}>
                    {q}
                  </button>
                  {feito && (['sim', 'nao'] as const).map((op) => (
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
