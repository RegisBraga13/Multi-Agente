// Página 1, coluna da esquerda: anamnese (gravar e escrever na mesma caixa), faltou perguntar e sinais de alerta.
import { useEffect, useRef, useState } from 'react'
import type { Alerta, Fala } from './exemplo'
import type { EstadoConsulta, RespostaAlerta, Situacao } from './tipos'
import { BotaoOficializar, Cartao, ROTULO } from './ui'

/** Simulação: uma fala nova a cada 3 s de gravação. */
const SEGUNDOS_POR_FALA = 3

/** Respostas aos sinais de alerta: ícone no botão, significado na legenda do rodapé. */
const RESPOSTAS = [
  { id: 'avaliado', icone: '☑', nome: 'Avaliado' },
  { id: 'nao-se-aplica', icone: '⊘', nome: 'Não se aplica' },
] as const

type Props = {
  falas: Fala[]
  faltouPerguntar: string[]
  alertas: Alerta[]
  respostas: EstadoConsulta['alertas']
  situacao: Situacao
  pendencias: number
  podeGravar: boolean
  onEditar: () => void
  onResponder: (id: string, r: RespostaAlerta) => void
  /** salva com o texto atual (a história clínica é montada com ele) */
  onOficializar: (texto: string) => void
}

export function Anamnese({ falas, faltouPerguntar, alertas, respostas, situacao, pendencias, podeGravar, onEditar, onResponder, onOficializar }: Props) {
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  /** a anamnese numa caixa só: a transcrição entra no fim do texto, e o médico escreve e corrige ali mesmo */
  const [texto, setTexto] = useState('')
  const [perguntado, setPerguntado] = useState<string[]>([])
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
      legenda={alertas.length > 0 && RESPOSTAS.map((x) => `${x.icone} ${x.nome}`).join(' · ')}
      rodape={
        <BotaoOficializar
          rotulo="Salvar anamnese"
          oficializado={oficializado}
          bloqueado={!texto.trim()}
          motivo={!tentou ? undefined : pendencias > 0 ? `${pendencias === 1 ? 'Falta 1 sinal' : `Faltam ${pendencias} sinais`}` : gravando ? 'Pause a gravação' : undefined}
          onClick={() => {
            if (pendencias > 0 || gravando) return setTentou(true)
            setTentou(false)
            onOficializar(texto)
          }}
        />
      }
    >
      {/* a caixa ocupa a altura que sobra no cartão (o cartão desce até perto do rodapé) */}
      <div className="flex min-h-[150px] flex-1 flex-col border-[1.5px] border-linha focus-within:border-tinta">
        <textarea
          ref={caixa}
          value={texto}
          onChange={(e) => { setTexto(e.target.value); mudou() }}
          placeholder="Queixa, história, antecedentes…"
          aria-label="Anamnese"
          className="block min-h-0 w-full flex-1 resize-none bg-branco px-3 py-2 text-[14.5px] leading-snug focus:outline-none"
        />
      </div>

      {faltouPerguntar.length > 0 && (
        <div className="mt-3">
          <p className={ROTULO}>Faltou perguntar</p>
          <div className="mt-1 flex flex-col items-start gap-1">
            {faltouPerguntar.map((q) => {
              const feito = perguntado.includes(q)
              return (
                <button key={q} type="button" onClick={() => setPerguntado((p) => (feito ? p.filter((x) => x !== q) : [...p, q]))} aria-pressed={feito}
                  className={`border-[1.5px] px-2 py-0.5 text-left text-[13.5px] ${feito ? 'border-linha text-apagado line-through' : 'border-dashed border-(--esp-medio)'}`}>
                  {q}
                </button>
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
                      className={`size-7 text-[17px] leading-none ${r === op.id ? 'bg-tinta text-papel' : 'hover:bg-suave'}`}>
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
