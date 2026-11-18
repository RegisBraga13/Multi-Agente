// Janela do prontuário: abre separada da consulta (outra janela do navegador), só leitura.
// Todas as entradas do paciente, a mais recente no topo. Atualiza sozinha quando uma consulta é salva.
import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { entradas, type EntradaProntuario } from './registro'

const TITULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const TEXTO = 'text-[14.5px] leading-[1.45] text-tinta'
const dataBr = (d: string) => d.split('-').reverse().join('/')

export function JanelaProntuario() {
  const { slug = '', paciente = '' } = useParams()
  const [busca] = useSearchParams()
  const esp = buscarEspecialidade(slug)
  const nome = busca.get('nome') ?? ''
  // nascimento: vem da chave do paciente (não muda)
  const nascimento = /^\d{4}-\d{2}-\d{2}/.test(paciente) ? dataBr(paciente.slice(0, 10)) : ''
  const [lista, setLista] = useState(() => entradas(paciente))

  useEffect(() => { document.title = `Prontuário · ${nome}` }, [nome])
  // a consulta salva noutra janela: a lista se atualiza
  useEffect(() => {
    const atualizar = () => setLista(entradas(paciente))
    window.addEventListener('storage', atualizar)
    window.addEventListener('focus', atualizar)
    return () => { window.removeEventListener('storage', atualizar); window.removeEventListener('focus', atualizar) }
  }, [paciente])

  if (!esp || !paciente) return <NaoEncontrada />
  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-3 sm:px-6">
        <NomeModulo esp={esp} className="text-[24px]" />
        <h1 className="text-[22px] font-semibold">Prontuário · {nome}{nascimento && <span className="font-normal"> · Nasc. {nascimento}</span>}</h1>
        <span className="ml-auto text-[13px] text-apagado">Só leitura</span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-3 sm:px-6">
        {lista.length === 0 ? (
          <p className="border border-historia-borda bg-historia px-5 py-4 text-[15px]">Sem prontuário anterior. A primeira entrada nasce ao salvar o prontuário no fim da consulta.</p>
        ) : lista.map((e) => <Entrada key={`${e.data} ${e.hora}`} e={e} />)}
      </main>
      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>
    </div>
  )
}

function Entrada({ e }: { e: EntradaProntuario }) {
  return (
    <article className="border border-historia-borda bg-historia px-5 py-3" aria-label={e.titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-historia-borda pb-1.5">
        <h2 className="text-[16px] font-bold">{e.titulo}</h2>
        <p className="text-[13.5px]">Data: {dataBr(e.data)}  |  Hora: {e.hora}</p>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {e.secoes.map((s, i) => (
          <div key={i} className="flex flex-col gap-1">
            {s.titulo && <p className={TITULO_SECAO}>{s.titulo}</p>}
            {s.linhas.map((l, j) => (
              <p key={j} className={`${TEXTO} whitespace-pre-wrap`}>{l.rotulo && <b>• {l.rotulo}: </b>}{l.texto}</p>
            ))}
          </div>
        ))}
      </div>
    </article>
  )
}
