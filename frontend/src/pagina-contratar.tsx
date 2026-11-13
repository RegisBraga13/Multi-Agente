import { useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ESPECIALIDADES, buscarEspecialidade, type Especialidade } from './especialidades'
import { NomeModulo } from './marca'
import { Moldura } from './moldura'
import { servicoCadastro } from './cadastro/servico'
import { SENHA_MINIMA, UFS, forcaSenha, validarCadastro, validarComplemento, type DadosCadastro, type Erros } from './cadastro/validacao'

type ContaGoogle = { nome: string; email: string }

const PASSOS = [
  { titulo: 'Cadastre-se em 2 minutos', texto: 'Nome, e-mail, CRM e a especialidade. Sem cartão de crédito.' },
  { titulo: 'Comece a consulta normalmente', texto: 'Aperte gravar e converse com o paciente como sempre fez.' },
  { titulo: 'Revise, assine e envie', texto: 'A história clínica chega estruturada. Você ajusta, assina e envia.' },
]

export function PaginaContratar() {
  const [params, setParams] = useSearchParams()
  const inicial = buscarEspecialidade(params.get('esp'))
  const [dados, setDados] = useState<DadosCadastro>({
    nome: '', email: '', crm: '', uf: '', senha: '', aceite: false,
    especialidade: inicial?.status === 'disponivel' ? inicial.slug : '',
  })
  const [erros, setErros] = useState<Erros>({})
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState('')
  const [pronto, setPronto] = useState<Especialidade | null>(null)
  const [verSenha, setVerSenha] = useState(false)
  const [google, setGoogle] = useState<ContaGoogle | null>(null)
  const [entrandoGoogle, setEntrandoGoogle] = useState(false)

  const esp = buscarEspecialidade(dados.especialidade)
  const validar = (d: DadosCadastro) => (google ? validarComplemento(d) : validarCadastro(d))

  async function entrarComGoogle() {
    setFalha('')
    setEntrandoGoogle(true)
    try {
      const r = await servicoCadastro.entrarComGoogle()
      if (r.ok) {
        setGoogle({ nome: r.nome, email: r.email })
        setErros({})
        setTentou(false)
      } else if (r.motivo === 'indisponivel') setFalha('Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.')
    } catch {
      setFalha('Não foi possível entrar com o Google agora. Tente de novo ou use e-mail e senha.')
    } finally {
      setEntrandoGoogle(false)
    }
  }

  useEffect(() => {
    document.title = esp ? `Testar ${esp.raiz}IA · especIAlista` : 'Criar conta · especIAlista'
  }, [esp])

  function muda<K extends keyof DadosCadastro>(campo: K, valor: DadosCadastro[K]) {
    const novo = { ...dados, [campo]: valor }
    setDados(novo)
    if (tentou) setErros(validar(novo))
    if (campo === 'especialidade') setParams({ esp: String(valor) }, { replace: true })
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    setTentou(true)
    setFalha('')
    const e = validar(dados)
    setErros(e)
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setEnviando(true)
    try {
      const r = google ? await servicoCadastro.completarCadastro(dados) : await servicoCadastro.criarConta(dados)
      if (r.ok) setPronto(buscarEspecialidade(r.especialidade) ?? null)
      else setFalha({
        email_em_uso: 'Este e-mail já tem conta. Use "Entrar".',
        crm_em_uso: 'Este CRM já está cadastrado. Se não foi você, fale com o suporte.',
        indisponivel: 'Não foi possível criar a conta agora. Tente de novo em instantes.',
      }[r.motivo])
    } catch {
      setFalha('Não foi possível criar a conta agora. Tente de novo em instantes.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Moldura cor={esp?.cor}>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div className="border border-linha bg-branco shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)]" style={{ borderTop: '4px solid var(--esp)' }}>
          {pronto ? <Pronto esp={pronto} /> : (
            <form noValidate onSubmit={enviar} className="p-6 sm:p-10">
              <a href="/" className="mb-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-apagado hover:text-tinta">← Voltar</a>
              <p className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase">Teste grátis · sem cartão</p>
              <h1 className="mt-3 text-[clamp(30px,3.6vw,40px)] leading-tight font-semibold">
                {google ? 'Complete seu cadastro' : 'Crie sua conta de médico'}
              </h1>
              <p className="mt-2 text-apagado">
                {google
                  ? <>Você entrou como <b className="text-tinta">{google.nome}</b> ({google.email}). Falta o CRM e a especialidade.</>
                  : 'Leva cerca de um minuto. O CRM é obrigatório, inclusive no teste.'}
              </p>

              {servicoCadastro.simulado && (
                <p role="note" className="mt-5 border-l-4 border-alerta bg-[#fbe9e6] px-4 py-3 text-[14px]">
                  Versão de desenvolvimento: nada do que você digitar é gravado ou enviado.
                </p>
              )}

              <div className="mt-7 grid gap-5">
                <Campo rotulo="Especialidade" erro={erros.especialidade}>
                  {(p) => (
                    <select {...p} value={dados.especialidade} onChange={(e) => muda('especialidade', e.target.value)} className={entrada(p)}>
                      <option value="">Escolha o módulo</option>
                      {ESPECIALIDADES.map((e) => (
                        <option key={e.slug} value={e.slug} disabled={e.status !== 'disponivel'}>
                          {e.nome}{e.status !== 'disponivel' ? ' (em breve)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                {!google && (
                  <>
                    <Campo rotulo="Nome completo" erro={erros.nome}>
                      {(p) => <input {...p} autoComplete="name" value={dados.nome} onChange={(e) => muda('nome', e.target.value)} className={entrada(p)} />}
                    </Campo>
                    <Campo rotulo="E-mail profissional" erro={erros.email}>
                      {(p) => <input {...p} type="email" autoComplete="email" inputMode="email" value={dados.email} onChange={(e) => muda('email', e.target.value)} className={entrada(p)} />}
                    </Campo>
                  </>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
                  <Campo rotulo="CRM" erro={erros.crm}>
                    {(p) => <input {...p} inputMode="numeric" autoComplete="off" placeholder="Somente números" value={dados.crm} onChange={(e) => muda('crm', e.target.value)} className={entrada(p)} />}
                  </Campo>
                  <Campo rotulo="UF" erro={erros.uf}>
                    {(p) => (
                      <select {...p} value={dados.uf} onChange={(e) => muda('uf', e.target.value)} className={entrada(p)}>
                        <option value="">—</option>
                        {UFS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    )}
                  </Campo>
                </div>
                {!google && (
                  <>
                    <Campo rotulo="Senha" erro={erros.senha} ajuda={`Pelo menos ${SENHA_MINIMA} caracteres, com letras, números ou símbolos.`}>
                      {(p) => (
                        <div className="relative">
                          <input {...p} type={verSenha ? 'text' : 'password'} autoComplete="new-password" value={dados.senha} onChange={(e) => muda('senha', e.target.value)} className={`${entrada(p)} pr-20`} />
                          <button type="button" onClick={() => setVerSenha(!verSenha)} className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] font-semibold text-apagado hover:text-tinta" aria-pressed={verSenha}>
                            {verSenha ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>
                      )}
                    </Campo>
                    <Forca senha={dados.senha} />
                  </>
                )}

                <label className="flex items-start gap-3 text-[14.5px]">
                  <input type="checkbox" checked={dados.aceite} onChange={(e) => muda('aceite', e.target.checked)} aria-invalid={!!erros.aceite} aria-describedby={erros.aceite ? 'erro-aceite' : undefined} className="mt-0.5 h-[18px] w-[18px] accent-(--esp)" />
                  <span>Li e aceito os termos de uso e a política de privacidade, e declaro que sou médico(a) com CRM ativo.</span>
                </label>
                {erros.aceite && <p id="erro-aceite" className="-mt-3 text-[13.5px] text-alerta">{erros.aceite}</p>}
              </div>

              {falha && <p role="alert" className="mt-5 text-[14.5px] font-semibold text-alerta">{falha}</p>}

              <button type="submit" disabled={enviando} className="mt-7 w-full bg-petroleo px-6 py-4 text-[17px] font-bold text-papel transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
                {enviando ? 'Criando conta…' : esp ? `Começar teste grátis da ${esp.raiz}IA →` : 'Criar conta e começar →'}
              </button>
              {google ? (
                <button type="button" onClick={() => { setGoogle(null); setErros({}); setTentou(false) }} className="mt-4 w-full text-center text-[14px] font-semibold text-apagado underline hover:text-tinta">
                  Usar e-mail e senha em vez do Google
                </button>
              ) : (
                <>
                  <div className="my-6 flex items-center gap-4 text-[13px] text-apagado" aria-hidden>
                    <span className="h-px flex-1 bg-linha" />ou<span className="h-px flex-1 bg-linha" />
                  </div>
                  <button type="button" onClick={entrarComGoogle} disabled={entrandoGoogle} className="flex w-full items-center justify-center gap-3 border-[1.5px] border-linha bg-branco px-6 py-3.5 text-[16px] font-semibold transition hover:border-tinta disabled:opacity-60">
                    <LogoGoogle />
                    {entrandoGoogle ? 'Conectando…' : 'Continuar com Google'}
                  </button>
                </>
              )}
              <p className="mt-5 text-center text-[14px] text-apagado">Já tem conta? <a href="/entrar" className="font-semibold text-tinta underline">Entrar</a></p>
              <p className="mt-6 border-t border-linha pt-4 text-center text-[12.5px] text-apagado">
                Tratamento de dados conforme a LGPD · banco de dados no Brasil
              </p>
            </form>
          )}
        </div>

        <aside className="lg:pt-6">
          {esp ? (
            <>
              <p className="text-[13px] font-bold tracking-[.14em] text-apagado uppercase">Você vai testar</p>
              <NomeModulo esp={esp} className="mt-2 block text-[clamp(40px,5vw,60px)] leading-none" />
            </>
          ) : (
            <p className="font-titulo text-[clamp(28px,3vw,36px)] leading-tight font-semibold">Escolha a especialidade e comece hoje.</p>
          )}
          <ol className="mt-10 space-y-7">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="grid grid-cols-[48px_1fr] gap-4">
                <span className="grid h-12 w-12 place-items-center border border-linha bg-branco font-titulo text-xl font-semibold text-(--esp)">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2 className="text-xl font-semibold">{p.titulo}</h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-apagado">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="mt-10 space-y-2 text-[15px]">
            {['[N] dias grátis', 'Sem cartão de crédito', 'Cancele quando quiser'].map((t) => (
              <li key={t} className="flex gap-2"><span className="text-(--esp)">✓</span>{t}</li>
            ))}
          </ul>
        </aside>
      </section>
    </Moldura>
  )
}

type PropsCampo = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }

function Campo({ rotulo, erro, ajuda, children }: { rotulo: string; erro?: string; ajuda?: string; children: (p: PropsCampo) => ReactNode }) {
  const id = useId()
  const descr = [erro && `${id}-erro`, ajuda && `${id}-ajuda`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold">{rotulo}</label>
      {children({ id, 'aria-invalid': !!erro, 'aria-describedby': descr })}
      {ajuda && !erro && <p id={`${id}-ajuda`} className="mt-1.5 text-[13px] text-apagado">{ajuda}</p>}
      {erro && <p id={`${id}-erro`} className="mt-1.5 text-[13.5px] text-alerta">{erro}</p>}
    </div>
  )
}

function entrada(p: PropsCampo) {
  return `w-full border-[1.5px] bg-papel px-4 py-3 text-[16px] outline-none transition focus:border-(--esp) focus:bg-branco ${p['aria-invalid'] ? 'border-alerta' : 'border-linha'}`
}

function Forca({ senha }: { senha: string }) {
  const f = forcaSenha(senha)
  const nomes = ['', 'Fraca', 'Razoável', 'Boa', 'Forte']
  return (
    <div className="-mt-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="h-1" style={{ background: n <= f ? (f >= 3 ? 'var(--esp)' : 'var(--color-alerta)') : 'var(--color-linha)' } as CSSProperties} />
        ))}
      </div>
      {senha && <p className="mt-1 text-[12.5px] text-apagado">Senha: {nomes[f] || 'muito fraca'}</p>}
    </div>
  )
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function Pronto({ esp }: { esp: Especialidade }) {
  return (
    <div className="p-6 sm:p-10" role="status">
      <p className="text-[13px] font-bold tracking-[.14em] text-(--esp) uppercase">Conta criada</p>
      <h1 className="mt-3 text-[clamp(30px,3.6vw,40px)] leading-tight font-semibold">
        Bem-vindo(a) à <NomeModulo esp={esp} />
      </h1>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-[15.5px]">
        <li>Confirme seu e-mail pelo link que enviamos.</li>
        <li>Ative a verificação em duas etapas (obrigatória para proteger os dados dos pacientes).</li>
        <li>Pronto: o módulo abre direto. A conferência do seu CRM acontece em seguida.</li>
      </ol>
      {servicoCadastro.simulado && (
        <p className="mt-6 border-l-4 border-alerta bg-[#fbe9e6] px-4 py-3 text-[14px]">
          Versão de desenvolvimento: nenhuma conta foi criada e nenhum e-mail foi enviado.
        </p>
      )}
    </div>
  )
}
