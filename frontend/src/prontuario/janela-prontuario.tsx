// Janela do prontuário: abre separada da consulta (outra janela do navegador), só leitura.
// Todas as entradas do paciente, a mais recente no topo. Atualiza sozinha quando uma consulta é salva.
// O texto de cada entrada é montado dos dados gravados (secoesDaEntrada); as fotos aparecem em miniatura.
import { useEffect, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { tabelaDeExames } from '../consulta/exames-tabela'
import { secoesDaEntrada } from '../consulta/prontuario'
import { TabelaDeExames } from '../consulta/tabela-exames'
import { buscarEspecialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { cadastroDoPaciente, entradas, type EntradaProntuario, type FotoRegistro } from './registro'

const TITULO_SECAO = 'text-[11px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'
const TEXTO = 'text-[14.5px] leading-[1.45] text-tinta'
const dataBr = (d: string) => d.split('-').reverse().join('/')

export function JanelaProntuario() {
  const { slug = '', paciente = '' } = useParams()
  const esp = buscarEspecialidade(slug)
  // nome e nascimento vêm do cadastro do paciente (não mudam)
  const cadastro = cadastroDoPaciente(paciente)
  const id = cadastro?.id ?? paciente
  const [lista, setLista] = useState(() => entradas(id))
  // o histórico de exames não aparece sozinho: só é montado quando o médico pede
  const [historico, setHistorico] = useState(false)

  useEffect(() => { if (cadastro) document.title = `Prontuário · ${cadastro.nome}` }, [cadastro])
  // a consulta salva noutra janela: a lista se atualiza
  useEffect(() => {
    const atualizar = () => setLista(entradas(id))
    window.addEventListener('storage', atualizar)
    window.addEventListener('focus', atualizar)
    return () => { window.removeEventListener('storage', atualizar); window.removeEventListener('focus', atualizar) }
  }, [id])

  if (!esp || !cadastro) return <NaoEncontrada />
  const tabela = tabelaDeExames(lista.flatMap((e) => e.dados.exames), [])
  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-3 sm:px-6">
        <NomeModulo esp={esp} className="text-[24px]" />
        <h1 className="text-[22px] font-semibold">Prontuário · {cadastro.nome}<span className="font-normal"> · Nasc. {dataBr(cadastro.nascimento)}</span></h1>
        <span className="ml-auto text-[13px] text-apagado">Só leitura</span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-3 sm:px-6">
        {lista.length === 0 ? (
          <p className="border border-historia-borda bg-historia px-5 py-4 text-[15px]">Sem prontuário anterior. A primeira entrada nasce ao salvar o prontuário no fim da consulta.</p>
        ) : (
          <>
            {tabela && (
              // gerado a pedido, a partir dos exames de cada consulta e retorno: uma coluna por data (regra 13.7)
              <section className="border border-historia-borda bg-historia px-5 py-3" aria-label="Histórico de exames">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[16px] font-bold">Histórico de exames</h2>
                  <button type="button" onClick={() => setHistorico((x) => !x)} aria-expanded={historico} className="border-[1.5px] border-tinta px-3 py-1 text-[13.5px] font-bold hover:bg-tinta hover:text-papel">
                    {historico ? 'Ocultar' : 'Gerar histórico'}
                  </button>
                </div>
                {historico && <TabelaDeExames tabela={tabela} className="mt-2" />}
              </section>
            )}
            {lista.map((e) => <Entrada key={e.id} e={e} />)}
          </>
        )}
      </main>
      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>
    </div>
  )
}

function Entrada({ e }: { e: EntradaProntuario }) {
  const secoes = secoesDaEntrada(e)
  // as fotos vêm logo depois do exame físico (ou, sem ele, depois da anamnese)
  const depoisDe = secoes.some((s) => s.id === 'O') ? 'O' : 'S'
  return (
    <article className="border border-historia-borda bg-historia px-5 py-3" aria-label={e.titulo}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b border-historia-borda pb-1.5">
        <h2 className="text-[16px] font-bold">{e.titulo}</h2>
        <p className="text-[13.5px]">Data: {dataBr(e.data)}  |  Hora: {e.hora}  |  {e.modalidade === 'online' ? 'Online' : 'Presencial'}</p>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {secoes.map((s) => (
          <div key={s.id} className="flex flex-col gap-1">
            {s.titulo && <p className={TITULO_SECAO}>{s.titulo}</p>}
            {s.linhas.map((l) => (
              <p key={l.id} className={`${TEXTO} whitespace-pre-wrap`}>{l.rotulo && <b>• {l.rotulo}: </b>}{l.texto}</p>
            ))}
            {s.id === depoisDe && e.dados.fotos.length > 0 && <Miniaturas fotos={e.dados.fotos} />}
          </div>
        ))}
      </div>
    </article>
  )
}

/** Fotos do exame em miniatura; um clique amplia, outro fecha. */
function Miniaturas({ fotos }: { fotos: FotoRegistro[] }) {
  const [aberta, setAberta] = useState<FotoRegistro | null>(null)
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <b className={TEXTO}>• Fotos:</b>
        {fotos.map((f) => (
          <button key={f.n} type="button" onClick={() => setAberta(f)} aria-label={`Ampliar foto ${f.n}`}
            className="flex size-[56px] items-center justify-center overflow-hidden border border-historia-borda bg-suave text-[13px] font-semibold text-apagado hover:border-tinta">
            {f.src ? <img src={f.src} alt="" className="size-full object-cover" /> : f.n}
          </button>
        ))}
      </div>
      {aberta && (
        <div role="dialog" aria-label={`Foto ${aberta.n}`} onClick={() => setAberta(null)} className="fixed inset-0 z-20 flex items-center justify-center bg-tinta/70 p-6">
          <div className="relative flex max-h-full max-w-full items-center justify-center bg-suave">
            {aberta.src ? <img src={aberta.src} alt={`Foto ${aberta.n} do exame`} className="block max-h-[85vh] max-w-full object-contain" />
              : <span className="flex size-[320px] items-center justify-center font-titulo text-[28px] font-semibold text-apagado">Foto {aberta.n}</span>}
            <button type="button" className="absolute top-1 left-1 bg-tinta/80 px-1.5 py-0.5 text-[11px] font-semibold text-papel">× Fechar</button>
          </div>
        </div>
      )}
    </>
  )
}
