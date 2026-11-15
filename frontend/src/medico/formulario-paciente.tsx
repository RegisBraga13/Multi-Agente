import { useEffect, useRef, useState, type FormEvent } from 'react'
import { UFS } from '../cadastro/validacao'
import { Campo } from './campo'
import { btnPrimario, btnSecundario, classeEntrada } from './estilos'
import { validarDadosPessoais, validarFoto, type DadosPessoais, type PreConsulta } from './regras'
import { artigo } from './textos'
import type { Medico } from './tipos'

type Props = { medico: Medico; inicial: { nome: string; whatsapp: string }; onConcluir(): void }

export function FormularioPaciente({ medico, inicial, onConcluir }: Props) {
  const [dados, setDados] = useState<DadosPessoais>({
    nomeCompleto: inicial.nome, nascimento: '', sexo: '', whatsapp: inicial.whatsapp, email: '', cidade: '', uf: '',
  })
  const [pre, setPre] = useState<PreConsulta>({ queixa: '', desdeQuando: '', medicamentos: '', alergias: '' })
  const [erros, setErros] = useState<Partial<Record<keyof DadosPessoais, string>>>({})
  const [tentou, setTentou] = useState(false)
  const [foto, setFoto] = useState<{ nome: string; url: string } | null>(null)
  const [erroFoto, setErroFoto] = useState('')
  const [pronto, setPronto] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
  }, [pronto])
  // libera a miniatura da memória ao trocar a foto ou sair
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url) }, [foto])

  function muda<K extends keyof DadosPessoais>(campo: K, valor: DadosPessoais[K]) {
    const novo = { ...dados, [campo]: valor }
    setDados(novo)
    if (tentou) setErros(validarDadosPessoais(novo, new Date()))
  }
  const mudaPre = (campo: keyof PreConsulta, valor: string) => setPre((p) => ({ ...p, [campo]: valor }))

  function escolherFoto(arquivo: File | undefined) {
    setFoto(null)
    setErroFoto('')
    if (!arquivo) return
    const erro = validarFoto(arquivo)
    if (erro) return setErroFoto(erro)
    setFoto({ nome: arquivo.name, url: URL.createObjectURL(arquivo) })
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
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-papel bg-[url(/papel.png)] bg-size-[512px]" role="dialog" aria-modal="true" aria-labelledby="h-form">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
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

              <fieldset className="mt-7">
                <legend className="text-[13px] font-bold tracking-[.14em] uppercase">Dados pessoais</legend>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Campo rotulo="Nome completo" erro={erros.nomeCompleto}>
                      {(p) => <input {...p} autoComplete="name" value={dados.nomeCompleto} onChange={(e) => muda('nomeCompleto', e.target.value)} className={classeEntrada(p)} />}
                    </Campo>
                  </div>
                  <Campo rotulo="Data de nascimento" erro={erros.nascimento}>
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
                </div>
              </fieldset>

              <fieldset className="mt-9 border-t border-linha pt-7">
                <legend className="float-left w-full text-[13px] font-bold tracking-[.14em] uppercase">
                  Pré-consulta <span className="font-semibold tracking-normal normal-case text-apagado">· opcional</span>
                </legend>
                <p className="clear-both pt-2 text-[15px] text-apagado">Responda o que puder. Ajuda {artigo(medico)} a chegar à consulta conhecendo o seu caso.</p>
                <div className="mt-4 grid gap-4">
                  <Campo rotulo="O que trouxe você à consulta?">
                    {(p) => <textarea {...p} rows={3} value={pre.queixa} onChange={(e) => mudaPre('queixa', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Desde quando?">
                    {(p) => <input {...p} placeholder="Ex.: uns três meses" value={pre.desdeQuando} onChange={(e) => mudaPre('desdeQuando', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Medicamentos e cremes que usa ou já usou">
                    {(p) => <textarea {...p} rows={2} value={pre.medicamentos} onChange={(e) => mudaPre('medicamentos', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Alergia a algum medicamento?">
                    {(p) => <input {...p} placeholder="Ex.: dipirona. Se não tiver, escreva “não”." value={pre.alergias} onChange={(e) => mudaPre('alergias', e.target.value)} className={classeEntrada(p)} />}
                  </Campo>
                  <Campo rotulo="Foto da lesão (opcional)" erro={erroFoto || undefined} ajuda="Uma foto com boa luz ajuda. Até 10 MB.">
                    {(p) => (
                      <input {...p} type="file" accept="image/*" onChange={(e) => escolherFoto(e.target.files?.[0])}
                        className="block w-full text-[15px] file:mr-4 file:border-[1.5px] file:border-tinta file:bg-transparent file:px-4 file:py-2.5 file:font-semibold" />
                    )}
                  </Campo>
                  {foto && <img src={foto.url} alt={`Foto escolhida: ${foto.nome}`} className="max-h-56 w-auto self-start border border-linha object-contain" />}
                </div>
              </fieldset>

              <div className="mt-9 grid gap-3">
                <button type="submit" className={btnPrimario}>Enviar</button>
                <button type="button" className={btnSecundario} onClick={onConcluir}>Fazer depois</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
