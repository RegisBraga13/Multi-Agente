// "Preencher na consulta": a consulta só começa com a Identificação (a página inicial do formulário).
// Se o paciente chegou sem preencher, o médico preenche aqui, no computador, e a consulta abre.
// O resto do formulário fica em branco e aparece em Perguntas, na anamnese.
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { CamposIdentificacao } from '../medico/campos-identificacao'
import { validarDadosPessoais, type DadosPessoais } from '../medico/regras'
import { identificacaoDaChegada } from '../modulo/pedidos'
import { ErroServidor, gravarIdentificacao, type PedidoNaAgenda } from '../servidor/agenda'

type Props = { esp: Especialidade; pedido: PedidoNaAgenda; onPronto: (p: PedidoNaAgenda) => void }

export function IdentificacaoNaChegada({ esp, pedido, onPronto }: Props) {
  const [dados, setDados] = useState<DadosPessoais>(() => identificacaoDaChegada(pedido))
  const [erros, setErros] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)

  function muda<K extends keyof DadosPessoais>(campo: K, valor: DadosPessoais[K]) {
    const novo = { ...dados, [campo]: valor }
    setDados(novo)
    if (tentou) setErros(validarDadosPessoais(novo, new Date()))
  }

  async function abrir(ev: FormEvent) {
    ev.preventDefault()
    setTentou(true)
    const e = validarDadosPessoais(dados, new Date())
    setErros(e)
    if (Object.keys(e).length || !dados.sexo) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#identificacao-chegada [aria-invalid="true"]')?.focus())
      return
    }
    setEnviando(true)
    setErroEnvio(null)
    try {
      onPronto(await gravarIdentificacao(pedido.id, { ...dados, sexo: dados.sexo }))
    } catch (erro) {
      setErroEnvio(erro instanceof ErroServidor ? erro.message : 'Não foi possível salvar. Tente de novo.')
      setEnviando(false)
    }
  }

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto w-full max-w-6xl px-4 pt-2.5 sm:px-6">
        <Link to={`/modulo/${esp.slug}`} className="no-underline" aria-label={`${esp.raiz}IA, início`}><NomeModulo esp={esp} className="text-[26px]" /></Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-8 sm:px-6">
        <form id="identificacao-chegada" noValidate onSubmit={abrir}
          className="border border-linha bg-branco p-4 shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)] sm:px-8 sm:py-5" style={{ borderTop: '4px solid var(--esp)' }}>
          <p className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase">
            Identificação <span className="ml-1 bg-(--esp) px-2 py-0.5 text-[11px] tracking-[.1em] text-papel">Obrigatório</span>
          </p>
          <h1 className="mt-2 text-[24px] leading-tight font-bold">Antes de abrir a consulta</h1>
          <p className="mt-2 border-l-4 border-(--esp) bg-suave px-4 py-2.5 text-[14.5px]">
            {pedido.nome.trim().split(/\s+/)[0]} escolheu preencher na consulta. Preencha a Identificação; o resto do formulário aparece em Perguntas, na anamnese.
          </p>
          <div className="mt-4"><CamposIdentificacao dados={dados} erros={erros} muda={muda} /></div>
          {erroEnvio && <p role="alert" className="mt-4 text-[14.5px] font-semibold text-alerta">{erroEnvio}</p>}
          <div className="mt-5 flex items-center gap-4 border-t border-linha pt-4 text-[14.5px] font-semibold">
            <Link to={`/modulo/${esp.slug}#agenda`} className="text-apagado underline hover:text-tinta">Voltar à agenda</Link>
            <span className="flex-1" />
            <button type="submit" disabled={enviando} className="bg-(--esp) px-7 py-3 text-[16px] font-bold text-papel transition hover:-translate-y-0.5 disabled:opacity-60">
              {enviando ? 'Salvando…' : 'Abrir consulta'}
            </button>
          </div>
        </form>
      </main>
      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>
    </div>
  )
}
