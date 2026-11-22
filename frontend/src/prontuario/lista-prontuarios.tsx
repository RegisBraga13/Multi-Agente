// Prontuários: quem já terminou ao menos uma consulta ou retorno tem prontuário. O médico entra aqui a qualquer
// hora (cartão Prontuário da página inicial), busca pelo nome e abre o prontuário da pessoa.
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { prontuariosDoMedico } from '../servidor/consulta'
import { juntarPacientes } from './juntar'
import { pacientesComProntuario, type PacienteComProntuario } from './registro'

const dataBr = (d: string) => d.split('-').reverse().join('/')
const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function ListaProntuarios() {
  const { slug = '' } = useParams()
  const esp = buscarEspecialidade(slug)
  const navegar = useNavigate()
  const [busca, setBusca] = useState('')
  const [locais] = useState(() => pacientesComProntuario())
  const [doServidor, setDoServidor] = useState<PacienteComProntuario[]>([])
  const [aviso, setAviso] = useState('')
  useEffect(() => {
    prontuariosDoMedico().then(setDoServidor, () => setAviso('Não foi possível ler os prontuários do servidor. Aparecem só os registros deste aparelho.'))
  }, [])
  const todos = juntarPacientes(locais, doServidor)
  const vistos = todos.filter((p) => semAcento(p.nome).includes(semAcento(busca.trim())))
  const abrir = (id: string) => navegar(`/modulo/${slug}/prontuario/${id}`)

  if (!esp) return <NaoEncontrada />
  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto flex w-full max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 pt-3 sm:px-6">
        <NomeModulo esp={esp} className="text-[24px]" />
        <h1 className="text-[22px] font-semibold">Prontuários</h1>
        <Link to={`/modulo/${esp.slug}`} className="ml-auto text-[14px] font-bold underline">Voltar</Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
        {/* a busca completa os nomes enquanto digita; Enter ou "Buscar" abre o primeiro da lista */}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (vistos[0]) abrir(vistos[0].id) }}>
          <input
            type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar paciente" placeholder="Digite o nome do paciente" autoComplete="off"
            className="min-w-0 flex-1 border-[1.5px] border-linha bg-branco px-3 py-2 text-[15px] focus:border-tinta focus:outline-none"
          />
          <button type="submit" disabled={!vistos.length} className="bg-tinta px-4 py-2 text-[15px] font-bold text-papel disabled:opacity-40">Buscar</button>
        </form>
        {aviso && <p role="alert" className="border border-historia-borda bg-historia px-5 py-3 text-[14px] font-bold">{aviso}</p>}
        {todos.length === 0 ? (
          <p className="border border-historia-borda bg-historia px-5 py-4 text-[15px]">Nenhum prontuário ainda. O prontuário nasce quando o paciente termina a primeira consulta.</p>
        ) : vistos.length === 0 ? (
          <p className="border border-historia-borda bg-historia px-5 py-4 text-[15px]">Nenhum paciente com esse nome.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {vistos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => abrir(p.id)}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-4 border border-historia-borda bg-historia px-5 py-3 text-left hover:bg-suave">
                  <span className="text-[16px] font-bold"><NomeComBusca nome={p.nome} busca={busca.trim()} /><span className="font-normal"> · Nasc. {dataBr(p.nascimento)}</span></span>
                  <span className="text-[13.5px] text-apagado">{p.entradas} {p.entradas === 1 ? 'entrada' : 'entradas'} · última em {dataBr(p.ultima)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>
    </div>
  )
}

/** O pedaço do nome que bate com o que foi digitado fica sublinhado (mostra como a busca completou). */
function NomeComBusca({ nome, busca }: { nome: string; busca: string }) {
  const i = busca ? semAcento(nome).indexOf(semAcento(busca)) : -1
  if (i < 0) return <>{nome}</>
  return <>{nome.slice(0, i)}<mark className="bg-transparent underline decoration-2">{nome.slice(i, i + busca.length)}</mark>{nome.slice(i + busca.length)}</>
}
