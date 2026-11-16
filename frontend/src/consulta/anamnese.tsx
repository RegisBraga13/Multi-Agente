// Página 1, coluna da esquerda: anamnese (gravação + transcrição, ou texto), faltou perguntar e sinais de alerta.
import { useEffect, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import type { Alerta, Fala } from './exemplo'
import type { EstadoConsulta, RespostaAlerta, Situacao } from './tipos'
import { BotaoOficializar, Cartao, Gaveta, ROTULO } from './ui'

/** Quantas falas a transcrição mostra (as mais recentes), para caber numa tela. */
const FALAS_VISIVEIS = 3
/** Simulação: uma fala nova a cada 3 s de gravação. */
const SEGUNDOS_POR_FALA = 3

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
  onOficializar: () => void
}

export function Anamnese({ falas, faltouPerguntar, alertas, respostas, situacao, pendencias, podeGravar, onEditar, onResponder, onOficializar }: Props) {
  const [modo, setModo] = useState<'gravar' | 'escrever'>(podeGravar ? 'gravar' : 'escrever')
  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [notas, setNotas] = useState('')
  const [perguntado, setPerguntado] = useState<string[]>([])
  const [tudo, setTudo] = useState(false)

  useEffect(() => {
    if (!gravando) return
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [gravando])

  const iniciou = gravando || segundos > 0
  const reveladas = iniciou ? falas.slice(0, Math.min(falas.length, 1 + Math.floor(segundos / SEGUNDOS_POR_FALA))) : []
  const recentes = reveladas.slice(-FALAS_VISIVEIS)
  const oficializado = situacao === 'oficializado'

  const alternar = () => {
    if (!gravando && oficializado) onEditar() // gravar de novo muda a anamnese oficializada
    setGravando((g) => !g)
  }

  return (
    <Cartao
      titulo="Anamnese"
      situacao={situacao}
      extra={
        podeGravar && (
          <button type="button" onClick={() => setModo(modo === 'gravar' ? 'escrever' : 'gravar')} className="text-[13px] font-semibold underline decoration-linha underline-offset-4 hover:text-(--esp)">
            {modo === 'gravar' ? 'Escrever' : 'Gravar'}
          </button>
        )
      }
      rodape={
        <BotaoOficializar
          rotulo="Oficializar anamnese"
          oficializado={oficializado}
          motivo={reveladas.length === 0 && !notas.trim() ? 'Grave ou escreva a anamnese' : pendencias > 0 ? `Falta avaliar ${pendencias} ${pendencias === 1 ? 'sinal' : 'sinais'} de alerta` : gravando ? 'Pause a gravação' : undefined}
          onClick={onOficializar}
        />
      }
    >
      {modo === 'gravar' ? (
        <>
          <div className="flex items-center gap-3">
            <button type="button" onClick={alternar} aria-pressed={gravando} className={`flex items-center gap-2 px-3 py-1.5 text-[14px] font-bold ${gravando ? 'bg-alerta-clinico text-branco' : 'bg-tinta text-papel'}`}>
              <span className={`inline-block size-2.5 rounded-full! ${gravando ? 'animate-pulse bg-branco' : 'bg-alerta-clinico'}`} />
              {gravando ? 'Pausar' : iniciou ? 'Continuar' : 'Gravar'}
            </button>
            <span className="font-titulo text-[22px] font-semibold tabular-nums" aria-label="Tempo de gravação">{tempo(segundos)}</span>
            <span className="text-[13px] text-apagado">{gravando ? 'Gravando · consentimento na ficha' : 'Áudio descartado depois de transcrito'}</span>
          </div>
          <div className="mt-2.5 min-h-[132px] space-y-1.5" aria-live="polite">
            {recentes.length === 0 ? (
              <p className="pt-6 text-center text-[14.5px] text-apagado">Toque em Gravar quando começar a conversa.<br />A transcrição aparece aqui, separando médico e paciente.</p>
            ) : (
              recentes.map((f, i) => (
                <p key={reveladas.length - recentes.length + i} className="text-[14.5px] leading-snug">
                  <b className={`mr-1.5 text-[12px] tracking-[0.08em] uppercase ${f.quem === 'Médico' ? 'text-petroleo' : 'text-(--esp)'}`}>{f.quem}</b>
                  {f.texto}
                </p>
              ))
            )}
            {reveladas.length > FALAS_VISIVEIS && (
              <button type="button" onClick={() => setTudo(true)} className="text-[13px] font-semibold underline decoration-linha underline-offset-4 hover:text-(--esp)">
                Ver tudo ({reveladas.length} falas)
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {!podeGravar && <p className="mb-2 text-[13.5px] text-apagado">Sem consentimento de gravação na ficha. Escreva a anamnese.</p>}
          <TextoCrescente
            value={notas}
            onChange={(e) => { setNotas(e.target.value); if (situacao !== 'revisado_medico') onEditar() }}
            placeholder="Queixa, história, antecedentes…"
            aria-label="Anamnese escrita"
            className="max-h-[190px] min-h-[132px] w-full overflow-y-auto! border-[1.5px] border-linha bg-branco px-3 py-2 text-[15px] focus:border-tinta focus:outline-none"
          />
        </>
      )}

      {faltouPerguntar.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={ROTULO}>Faltou perguntar</span>
          {faltouPerguntar.map((q) => {
            const feito = perguntado.includes(q)
            return (
              <button key={q} type="button" onClick={() => setPerguntado((p) => (feito ? p.filter((x) => x !== q) : [...p, q]))} aria-pressed={feito}
                className={`border-[1.5px] px-2 py-0.5 text-[13.5px] ${feito ? 'border-linha text-apagado line-through' : 'border-dashed border-(--esp-medio)'}`}>
                {q}
              </button>
            )
          })}
        </div>
      )}

      {alertas.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className={ROTULO}>Sinais de alerta</p>
          {alertas.map((a) => {
            const r = respostas[a.id]
            return (
              <div key={a.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[14px] ${r ? 'border-[1.5px] border-alerta-clinico text-alerta-clinico' : 'bg-alerta-clinico text-branco'}`}>
                <span className="font-semibold">{a.texto}</span>
                <span className="ml-auto flex gap-1.5">
                  {r ? (
                    <span className="font-semibold">✓ {r === 'avaliado' ? 'Avaliado' : 'Não se aplica'}</span>
                  ) : (
                    (['avaliado', 'nao-se-aplica'] as const).map((op) => (
                      <button key={op} type="button" onClick={() => onResponder(a.id, op)} className="border border-branco px-2 py-0.5 text-[13px] font-semibold hover:bg-branco hover:text-alerta-clinico">
                        {op === 'avaliado' ? 'Avaliado' : 'Não se aplica'}
                      </button>
                    ))
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {tudo && (
        <Gaveta titulo="Transcrição" onFechar={() => setTudo(false)}>
          <ol className="space-y-2.5">
            {reveladas.map((f, i) => (
              <li key={i} className="text-[15px] leading-snug">
                <span className="mr-2 text-[12px] text-apagado tabular-nums">{f.aos}</span>
                <b className={`mr-1.5 text-[12px] tracking-[0.08em] uppercase ${f.quem === 'Médico' ? 'text-petroleo' : 'text-(--esp)'}`}>{f.quem}</b>
                {f.texto}
              </li>
            ))}
          </ol>
        </Gaveta>
      )}
    </Cartao>
  )
}

function tempo(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
