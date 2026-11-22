// Consulta ao CID-10 no painel Anexos (todas as especialidades): o médico acha o código e o digita no diagnóstico.
import { useEffect, useMemo, useRef, useState } from 'react'
import { SEM_CORRETOR } from './campo-linha'
import { buscarCid, carregarCid, type Cid } from './cid10'
import { ROTULO } from './ui'

export function BuscaCid() {
  const [tabela, setTabela] = useState<Cid[] | null>(null)
  const [termo, setTermo] = useState('')
  useEffect(() => { carregarCid().then(setTabela, () => setTabela([])) }, [])
  const achados = useMemo(() => (tabela ? buscarCid(tabela, termo) : []), [tabela, termo])
  const buscou = termo.trim().length >= 2
  const secao = useRef<HTMLElement>(null)
  // o painel rola sozinho até os resultados (a busca fica abaixo da lista de documentos)
  useEffect(() => { if (achados.length > 0) secao.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }) }, [achados.length])
  return (
    <section ref={secao} className="mt-5" aria-label="Consulta ao CID-10">
      <p className={ROTULO}>CID-10</p>
      <p className="mt-1 text-[14.5px] text-apagado">Não lembra o código? Busque pelo nome ou pelo código e digite no diagnóstico.</p>
      <input
        {...SEM_CORRETOR}
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Ex.: psoríase, acne, L40"
        aria-label="Buscar no CID-10"
        className="mt-2 block w-full border-[1.5px] border-linha bg-branco px-3 py-2 text-[15px] focus:border-tinta focus:outline-none"
      />
      {tabela === null && <p className="mt-2 text-[13.5px] text-apagado">Carregando a tabela…</p>}
      {tabela !== null && buscou && achados.length === 0 && <p className="mt-2 text-[13.5px] text-apagado">Nenhum resultado.</p>}
      {achados.length > 0 && (
        <ul className="mt-2 max-h-[260px] divide-y divide-linha overflow-y-auto border-[1.5px] border-linha bg-branco" aria-label="Resultados do CID-10">
          {achados.map(([codigo, nome]) => (
            <li key={codigo} className="flex gap-3 px-3 py-1.5 text-[14.5px]">
              <span className="w-[58px] shrink-0 font-bold tabular-nums">{codigo}</span>
              <span className="min-w-0 flex-1">{nome}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
