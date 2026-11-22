// Adendo: o médico clica, abre uma janela, escreve e sai; o servidor registra o texto com data e hora.
// A entrada finalizada não muda: o adendo aparece sob ela. Só entradas vindas do servidor recebem adendo.
import { useState } from 'react'
import { ErroServidor } from '../servidor/agenda'
import { adicionarAdendo } from '../servidor/consulta'
import { adendoValido } from './juntar'
import type { Adendo } from './registro'

const TITULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'

/** Os adendos já registrados, sob a entrada. */
export function Adendos({ adendos }: { adendos: Adendo[] }) {
  if (!adendos.length) return null
  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-historia-borda pt-2">
      {adendos.map((a, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <p className={TITULO_SECAO}>Adendo · {a.quando}</p>
          <p className="text-[14.5px] leading-[1.45] whitespace-pre-wrap text-tinta">{a.texto}</p>
        </div>
      ))}
    </div>
  )
}

/** Botão "Adendo" da entrada + a janela de escrita. `aoSalvar` recarrega a lista depois de registrado. */
export function BotaoAdendo({ consultaId, aoSalvar }: { consultaId: string; aoSalvar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const sair = () => { setAberto(false); setTexto(''); setErro('') }
  const salvar = async () => {
    if (!adendoValido(texto) || enviando) return
    setEnviando(true); setErro('')
    try {
      await adicionarAdendo(consultaId, texto.trim())
      sair(); aoSalvar()
    } catch (e) {
      setErro(e instanceof ErroServidor ? e.message : 'Não foi possível salvar o adendo. Tente de novo.')
    } finally { setEnviando(false) }
  }

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="border-[1.5px] border-tinta px-3 py-1 text-[13.5px] font-bold hover:bg-tinta hover:text-papel">Adendo</button>
      {aberto && (
        <div role="dialog" aria-label="Adendo" className="fixed inset-0 z-20 flex items-center justify-center bg-tinta/70 p-6">
          <div className="flex w-full max-w-xl flex-col gap-2 border border-historia-borda bg-historia px-5 py-4">
            <h3 className="text-[16px] font-bold">Adendo</h3>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto do adendo" rows={6} autoFocus
              className="border-[1.5px] border-linha bg-branco px-3 py-2 text-[15px] focus:border-tinta focus:outline-none" />
            {erro && <p role="alert" className="text-[13.5px] font-bold text-red-700">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={sair} className="border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold hover:bg-tinta hover:text-papel">Sair</button>
              <button type="button" onClick={salvar} disabled={!adendoValido(texto) || enviando} className="bg-tinta px-4 py-1 text-[14px] font-bold text-papel disabled:opacity-40">Salvar adendo</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
