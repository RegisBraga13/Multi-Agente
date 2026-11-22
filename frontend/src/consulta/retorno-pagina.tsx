// Retorno na página 5, ao lado dos anexos: "Retorno: Não | Sim". "Sim" abre a agenda para escolher dia e horário
// (com o paciente, ainda no consultório). É só rascunho: nada é gravado até Finalizar (ver retorno.ts).
import { useState } from 'react'
import { AgendaMedico } from '../medico/agenda'
import type { Agenda, Modalidade } from '../medico/tipos'
import { escolher, horarioEscolhido, textoDoRetorno, type RascunhoRetorno } from './retorno'
import { ROTULO } from './ui'

type Props = {
  valor: RascunhoRetorno
  onMudar: (r: RascunhoRetorno) => void
  /** os dias e horários, com os já ocupados marcados */
  agenda: Agenda
  atendeOnline: boolean
  /** a consulta foi finalizada: só leitura */
  fixo?: boolean
}

export function EscolhaRetorno({ valor, onMudar, agenda, atendeOnline, fixo = false }: Props) {
  const [aberta, setAberta] = useState(false)
  const [modalidade, setModalidade] = useState<Modalidade>('presencial')
  const sim = valor.escolha === 'sim'
  const marcado = sim ? valor.marcado : null

  const escolherSimNao = (e: 'sim' | 'nao') => {
    onMudar(escolher(valor, e))
    setAberta(e === 'sim' && !(sim && valor.marcado))
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-[1.5px] border-linha bg-branco px-3 py-2">
      <p className={`${ROTULO} mr-1`}>Retorno</p>
      <div role="group" aria-label="Marcar retorno" className="grid grid-cols-2 border-[1.5px] border-tinta">
        {(['nao', 'sim'] as const).map((e) => (
          <button key={e} type="button" disabled={fixo} aria-pressed={e === 'sim' ? sim : !sim} onClick={() => escolherSimNao(e)}
            className={`px-3 py-1 text-[14px] font-semibold transition ${(e === 'sim') === sim ? 'bg-tinta text-papel' : 'hover:bg-suave'}`}>
            {e === 'sim' ? 'Sim' : 'Não'}
          </button>
        ))}
      </div>
      {sim && (
        <button type="button" disabled={fixo} onClick={() => setAberta(true)} className="text-[14px] font-semibold underline underline-offset-4">
          {marcado ? textoDoRetorno(marcado) : 'Escolher dia e horário'}
        </button>
      )}
      {aberta && sim && (
        <div role="dialog" aria-label="Agenda do retorno" className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 p-4">
          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto bg-papel p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className={ROTULO}>Escolha o dia e o horário do retorno</p>
              <button type="button" onClick={() => setAberta(false)} className="text-[14px] font-semibold underline underline-offset-4">Fechar</button>
            </div>
            <AgendaMedico
              agenda={agenda}
              modalidade={modalidade}
              atendeOnline={atendeOnline}
              onModalidade={setModalidade}
              selecionado={marcado && marcado.modalidade === modalidade ? marcado : null}
              onSelecionar={(data, inicio) => { onMudar(horarioEscolhido(valor, { data, inicio, modalidade })); setAberta(false) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
