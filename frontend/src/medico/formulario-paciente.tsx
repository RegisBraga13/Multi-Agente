import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { UFS } from '../cadastro/validacao'
import { Campo } from './campo'
import { btnPrimario, btnSecundario, classeEntrada } from './estilos'
import { GrupoOpcoes } from './opcoes'
import { alternarOpcao, partesPreConsulta, perguntaVisivel, type Pergunta, type RespostasPreConsulta } from './pre-consulta'
import { calcularIdade, formatarWhatsapp, normalizarWhatsapp, validarDadosPessoais, validarFoto, type DadosPessoais, type RascunhoPedido } from './regras'
import { NOME_MODALIDADE, rotuloDiaLongo } from './textos'
import type { Medico } from './tipos'

type Props = { medico: Medico; pedido: RascunhoPedido; onConcluir(): void }
type Foto = { nome: string; url: string }

const SIM_NAO = [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
const ATENDIMENTO = [{ valor: 'particular', rotulo: 'Particular' }, { valor: 'convenio', rotulo: 'Convênio' }]
const comoOpcoes = (lista: readonly string[]) => lista.map((t) => ({ valor: t, rotulo: t }))
const semChave = <T,>(r: Record<string, T>, chave: string) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== chave))

/** Formulário do paciente, aberto dentro da página logo depois do pedido enviado. */
export function FormularioPaciente({ medico, pedido, onConcluir }: Props) {
  const whatsapp = normalizarWhatsapp(pedido.whatsapp)
  const [dados, setDados] = useState<DadosPessoais>({
    nomeCompleto: pedido.nome, nascimento: '', sexo: '', whatsapp: pedido.whatsapp, email: '', cidade: '', uf: '',
    profissao: '', trabalhoExposto: '', atendimento: '', convenio: '',
  })
  const partes = partesPreConsulta(medico.especialidade)
  const [pre, setPre] = useState<RespostasPreConsulta>({})
  const [erros, setErros] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [tentou, setTentou] = useState(false)
  const [fotos, setFotos] = useState<Record<string, Foto>>({})
  const [errosFoto, setErrosFoto] = useState<Record<string, string>>({})
  const [pronto, setPronto] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)
  const idade = calcularIdade(dados.nascimento, new Date())

  // ao abrir (e ao concluir), leva a tela e o foco até o formulário
  useEffect(() => {
    titulo.current?.closest('section')?.scrollIntoView({ block: 'start' })
    titulo.current?.focus({ preventScroll: true })
  }, [pronto])
  // libera as miniaturas da memória ao sair
  const fotosAtuais = useRef(fotos)
  fotosAtuais.current = fotos
  useEffect(() => () => Object.values(fotosAtuais.current).forEach((f) => URL.revokeObjectURL(f.url)), [])

  function muda<K extends keyof DadosPessoais>(campo: K, valor: DadosPessoais[K]) {
    const novo = { ...dados, [campo]: valor }
    setDados(novo)
    if (tentou) setErros(validarDadosPessoais(novo, new Date()))
  }
  const mudaPre = (id: string, valor: string | string[]) => setPre((p) => ({ ...p, [id]: valor }))

  function escolherFoto(id: string, arquivo: File | undefined) {
    const antiga = fotos[id]
    if (antiga) URL.revokeObjectURL(antiga.url)
    const outras = semChave(fotos, id)
    const outrosErros = semChave(errosFoto, id)
    const erro = arquivo && validarFoto(arquivo)
    setFotos(arquivo && !erro ? { ...outras, [id]: { nome: arquivo.name, url: URL.createObjectURL(arquivo) } } : outras)
    setErrosFoto(erro ? { ...outrosErros, [id]: erro } : outrosErros)
  }

  function campoPergunta(q: Pergunta) {
    const valor = pre[q.id]
    if (q.tipo === 'escolha' || q.tipo === 'varias') {
      const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : []
      return (
        <GrupoOpcoes key={q.id} rotulo={q.rotulo} ajuda={q.ajuda} modo={q.tipo === 'escolha' ? 'uma' : 'varias'}
          opcoes={comoOpcoes(q.opcoes ?? [])} marcadas={marcadas}
          onAlternar={(o) => mudaPre(q.id, q.tipo === 'escolha' ? o : alternarOpcao(marcadas, o, q.exclusiva))} />
      )
    }
    if (q.tipo === 'foto') {
      const foto = fotos[q.id]
      return (
        <div key={q.id} className="grid gap-3">
          <Campo rotulo={q.rotulo} erro={errosFoto[q.id]} ajuda={q.ajuda}>
            {(p) => (
              <input {...p} type="file" accept="image/*" onChange={(e) => escolherFoto(q.id, e.target.files?.[0])}
                className="block w-full text-[15px] file:mr-4 file:border-[1.5px] file:border-tinta file:bg-transparent file:px-4 file:py-2.5 file:font-semibold" />
            )}
          </Campo>
          {foto && <img src={foto.url} alt={`Foto escolhida: ${foto.nome}`} className="max-h-56 w-auto self-start border border-linha object-contain" />}
        </div>
      )
    }
    const texto = typeof valor === 'string' ? valor : ''
    return (
      <Campo key={q.id} rotulo={q.rotulo} ajuda={q.ajuda}>
        {(p) => q.tipo === 'texto-longo'
          ? <textarea {...p} rows={q.id === 'queixa' ? 3 : 2} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />
          : <input {...p} placeholder={q.placeholder} value={texto} onChange={(e) => mudaPre(q.id, e.target.value)} className={classeEntrada(p)} />}
      </Campo>
    )
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    setTentou(true)
    const e = validarDadosPessoais(dados, new Date())
    setErros(e)
    if (Object.keys(e).length) {
      // espera a tela marcar os campos com erro antes de levar o foco ao primeiro
      requestAnimationFrame(() => document.querySelector<HTMLElement>('#formulario-paciente [aria-invalid="true"]')?.focus())
      return
    }
    setPronto(true)
  }

  return (
    <section aria-labelledby="h-form" className="scroll-mt-4 pt-10 pb-14">
      {!pronto && whatsapp && pedido.data && (
        <div role="status" className="mx-auto mb-6 max-w-2xl border-l-4 border-(--esp) bg-branco px-5 py-4 text-[15.5px]">
          <b className="block">✓ Pedido enviado</b>
          {rotuloDiaLongo(pedido.data)}, às {pedido.inicio} · {NOME_MODALIDADE[pedido.modalidade]}. O consultório confirma o horário no seu WhatsApp, {formatarWhatsapp(whatsapp)}.
          <span className="mt-1 block text-[13.5px] text-apagado">Demonstração: nada foi enviado.</span>
        </div>
      )}
      <div className="mx-auto max-w-2xl">
        <div className="border border-linha bg-branco p-5 shadow-[0_30px_60px_-36px_rgba(19,48,47,.5)] sm:p-9" style={{ borderTop: '4px solid var(--esp)' }}>
          {pronto ? (
            <div role="status">
              <h2 id="h-form" ref={titulo} tabIndex={-1} className="text-[clamp(28px,4vw,38px)] leading-tight font-bold outline-none">Recebido.</h2>
              <p className="mt-3 text-[17px]">{medico.tratamento} {medico.nome} vai ler antes da consulta.</p>
              <button type="button" className={`${btnPrimario} mt-7`} onClick={onConcluir}>Voltar à página</button>
              <p className="mt-5 border-l-4 border-alerta bg-[#fbe9e6] px-4 py-3 text-[14px]">Demonstração: nada foi enviado.</p>
            </div>
          ) : (
            <form id="formulario-paciente" noValidate onSubmit={enviar}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[12px] font-bold tracking-[.14em] text-(--esp) uppercase">{medico.tratamento} {medico.nome}</span>
                <button type="button" onClick={onConcluir} className="text-[14px] font-semibold text-apagado underline hover:text-tinta">Fazer depois</button>
              </div>
              <h2 id="h-form" ref={titulo} tabIndex={-1} className="mt-3 text-[clamp(28px,4vw,38px)] leading-tight font-bold outline-none">Formulário da consulta</h2>

              <ParteNumerada numero={1} titulo="Identificação" className="mt-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Campo rotulo="Nome completo" erro={erros.nomeCompleto}>
                      {(p) => <input {...p} autoComplete="name" value={dados.nomeCompleto} onChange={(e) => muda('nomeCompleto', e.target.value)} className={classeEntrada(p)} />}
                    </Campo>
                  </div>
                  <Campo rotulo="Data de nascimento" erro={erros.nascimento} ajuda={idade !== null ? `Idade: ${idade} ${idade === 1 ? 'ano' : 'anos'}` : undefined}>
                    {(p) => <input {...p} type="date" autoComplete="bday" value={dados.nascimento} onChange={(e) => muda('nascimento', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Sexo" erro={erros.sexo}>
                    {(p) => (
                      <select {...p} value={dados.sexo} onChange={(e) => muda('sexo', e.target.value as DadosPessoais['sexo'])} className={classeEntrada(p)}>
                        <option value="">Escolha</option>
                        <option value="F">Feminino</option>
                        <option value="M">Masculino</option>
                        <option value="outro">Outro</option>
                      </select>
                    )}
                  </Campo>
                  <Campo rotulo="WhatsApp" erro={erros.whatsapp}>
                    {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" value={dados.whatsapp} onChange={(e) => muda('whatsapp', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="E-mail (opcional)" erro={erros.email}>
                    {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={dados.email} onChange={(e) => muda('email', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Cidade" erro={erros.cidade}>
                    {(p) => <input {...p} autoComplete="address-level2" value={dados.cidade} onChange={(e) => muda('cidade', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="UF" erro={erros.uf}>
                    {(p) => (
                      <select {...p} value={dados.uf} onChange={(e) => muda('uf', e.target.value)} className={classeEntrada(p)}>
                        <option value="">—</option>
                        {UFS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                    )}
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo rotulo="Profissão (opcional)">
                      {(p) => <input {...p} autoComplete="organization-title" value={dados.profissao} onChange={(e) => muda('profissao', e.target.value)} className={classeEntrada(p)} />}
                    </Campo>
                  </div>
                  <div className="sm:col-span-2">
                    <GrupoOpcoes rotulo="Trabalha ao ar livre, exposto ao sol ou a produtos químicos?" modo="uma" opcoes={SIM_NAO}
                      marcadas={[dados.trabalhoExposto]} onAlternar={(v) => muda('trabalhoExposto', v as DadosPessoais['trabalhoExposto'])} />
                  </div>
                  <GrupoOpcoes rotulo="Atendimento" modo="uma" opcoes={ATENDIMENTO}
                    marcadas={[dados.atendimento]} onAlternar={(v) => muda('atendimento', v as DadosPessoais['atendimento'])} />
                  {dados.atendimento === 'convenio' && (
                    <Campo rotulo="Qual convênio?">
                      {(p) => <input {...p} value={dados.convenio} onChange={(e) => muda('convenio', e.target.value)} className={classeEntrada(p)} />}
                    </Campo>
                  )}
                </div>
              </ParteNumerada>

              <div className="mt-10 border-t border-linha pt-7">
                <p className="text-[13px] font-bold tracking-[.14em] uppercase">
                  Pré-consulta <span className="font-semibold tracking-normal normal-case text-apagado">· opcional</span>
                </p>
                <p className="pt-2 text-[15px] text-apagado">Responda o que puder. Ajuda seu médico a chegar à consulta conhecendo o seu caso.</p>
              </div>

              {partes.map((parte, i) => (
                <ParteNumerada key={parte.titulo} numero={i + 2} titulo={parte.titulo} className="mt-8">
                  <div className="grid gap-5">
                    {parte.perguntas.filter((q) => perguntaVisivel(q, dados.sexo)).map(campoPergunta)}
                  </div>
                  {parte.nota && <p className="mt-4 bg-suave px-4 py-3 text-[14px] text-apagado">{parte.nota}</p>}
                </ParteNumerada>
              ))}

              <p className="mt-9 text-[14px] text-apagado">
                {medico.tratamento} {medico.nome} confere e completa as respostas com você na consulta.
              </p>
              <div className="mt-4 grid gap-3">
                <button type="submit" className={btnPrimario}>Enviar</button>
                <button type="button" className={btnSecundario} onClick={onConcluir}>Fazer depois</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function ParteNumerada({ numero, titulo, className, children }: { numero: number; titulo: string; className?: string; children: ReactNode }) {
  return (
    <fieldset className={className}>
      <legend className="float-left mb-4 flex w-full items-center gap-3">
        <span aria-hidden className="grid h-8 w-8 flex-none place-items-center bg-(--esp)/12 text-[14px] font-bold text-(--esp)">{numero}</span>
        <span className="text-[19px] font-bold">{titulo}</span>
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  )
}
