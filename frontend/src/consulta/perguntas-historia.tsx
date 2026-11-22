// Fim da página da História: perguntas de segurança escritas para este paciente (Sim ou Não) e o aviso de urgência.
// A história não é reescrita ao responder; sem resposta, a pergunta não vai para o prontuário.
import { useState } from 'react'
import type { PerguntaServidor, SinalDoCatalogo } from '../servidor/consulta'
import { perguntaDoCatalogo, rotuloDoBloco, type AvisoUrgencia } from './historia-servidor'

const ROTULO_SECAO = 'text-[10.5px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const RESPOSTAS = [{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }] as const
/** com mais perguntas que isto, o bloco rola dentro do cartão (o número de perguntas é livre) */
const VISIVEIS = 5

type Props = {
  perguntas: PerguntaServidor[]
  urgencias: AvisoUrgencia[]
  catalogo: SinalDoCatalogo[]
  carregando: boolean
  falhou: boolean
  onResponder: (id: string, r: 'sim' | 'nao') => void
  onAdicionar: (p: PerguntaServidor) => void
  onTentarDeNovo: () => void
}

export function PerguntasHistoria({ perguntas, urgencias, catalogo, carregando, falhou, onResponder, onAdicionar, onTentarDeNovo }: Props) {
  const [aberto, setAberto] = useState(false)
  const estado = rotuloDoBloco({ carregando, falhou, n: perguntas.length })
  const faltam = catalogo.filter((s) => !perguntas.some((p) => p.sinalId === s.id))
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {urgencias.map((u) => (
        <p key={u.id} role="alert" className="bg-alerta-clinico px-3 py-1.5 text-[14px] leading-snug font-semibold text-papel">
          Urgência: {u.texto}. {u.acao[0]}{u.prazo ? ` (${u.prazo})` : ''}
        </p>
      ))}
      <div className="flex items-center justify-between">
        <p className={ROTULO_SECAO}>Perguntas</p>
        {catalogo.length > 0 && (
          <button type="button" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} className="border-[1.5px] border-tinta px-2 py-0.5 text-[12.5px] font-semibold hover:bg-tinta hover:text-papel">
            Ver mais perguntas
          </button>
        )}
      </div>
      {estado && (
        <p className="text-[13.5px] text-tinta">
          {estado}
          {falhou && <button type="button" onClick={onTentarDeNovo} className="ml-2 border-[1.5px] border-tinta px-2 py-0.5 text-[12.5px] font-semibold hover:bg-tinta hover:text-papel">Tentar de novo</button>}
        </p>
      )}
      {aberto && (
        <ul className="max-h-[132px] overflow-y-auto border-[1.5px] border-historia-borda bg-branco/60" aria-label="Mais perguntas">
          {faltam.length === 0 && <li className="px-3 py-1.5 text-[13.5px] text-tinta">Todas já estão nas perguntas.</li>}
          {faltam.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onAdicionar(perguntaDoCatalogo(s))} className="block w-full px-3 py-1 text-left text-[13.5px] hover:bg-suave">{s.texto}</button>
            </li>
          ))}
        </ul>
      )}
      {perguntas.length > 0 && (
        <div className={`flex flex-col gap-1 ${perguntas.length > VISIVEIS ? 'max-h-[188px] overflow-y-auto' : ''}`}>
          {perguntas.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-[1.5px] border-linha bg-branco py-0.5 pr-1 pl-3 text-[14px] text-alerta-clinico">
              <span title={p.texto} className="min-w-0 flex-1 truncate">{p.texto}</span>
              <span className="flex shrink-0 gap-1">
                {RESPOSTAS.map((op) => (
                  <button key={op.id} type="button" onClick={() => onResponder(p.id, op.id)} aria-pressed={p.resposta === op.id}
                    className={`px-2.5 py-1 text-[13.5px] leading-none font-bold ${p.resposta === op.id ? 'bg-tinta text-papel' : 'text-tinta hover:bg-suave'}`}>
                    {op.nome}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] text-apagado">Sim ou Não; sem resposta, a pergunta não vai para o prontuário.</p>
    </div>
  )
}
