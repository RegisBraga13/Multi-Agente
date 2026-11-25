// Anamnese, modo Formulário: o mesmo formulário que o paciente viu, uma parte por vez, já com as respostas dele.
// O médico confere cada parte ("Conferido ✓"), corrige ou completa, e na última salva: o formulário vira texto da anamnese.
// Depois de salvo, fica só para consulta (as correções são feitas na caixa de texto).
import type { ReactNode } from 'react'
import { blocosDaAnamnese, type Bloco } from '../medico/blocos'
import { alternarOpcao, chaveDaLinha, perguntaTrabalho, perguntaVisivel, type Parte, type Pergunta } from '../medico/pre-consulta'
import { ESTADOS_CIVIS, type DadosPessoais } from '../medico/regras'
import type { FormularioConsulta } from './formulario-consulta'
import { SEM_CORRETOR } from './campo-linha'

const ENTRADA = 'w-full border-[1.5px] border-linha bg-branco px-2 py-1 text-[14px] focus:border-tinta focus:outline-none'
const RotuloCampo = ({ texto, vazio }: { texto: string; vazio: boolean }) => (
  <span className={`mb-0.5 block text-[12.5px] font-semibold ${vazio ? 'text-apagado' : ''}`}>
    {texto}{vazio && <span className="ml-1.5 font-normal italic">· não respondeu</span>}
  </span>
)

type Props = {
  partes: Parte[]
  valor: FormularioConsulta
  parte: number
  onParte: (n: number) => void
  onMudar: (f: FormularioConsulta) => void
  /** partes já conferidas pelo médico */
  conferidas: boolean[]
  onConferir: (n: number) => void
  /** última parte: o formulário vira texto da anamnese */
  onSalvar: () => void
  /** já salvo: só para consulta */
  salvo: boolean
}

export function FormularioMedico({ partes, valor, parte, onParte, onMudar, conferidas, onConferir, onSalvar, salvo }: Props) {
  const blocos = blocosDaAnamnese(partes) // sem a Identificação: a anamnese só monta a história clínica
  const bloco = blocos[parte]
  const dados = valor.dados
  const mudaDado = <K extends keyof FormularioConsulta['dados']>(k: K, v: FormularioConsulta['dados'][K]) => onMudar({ ...valor, dados: { ...dados, [k]: v } })
  const mudaResposta = (id: string, v: string | string[]) => onMudar({ ...valor, respostas: { ...valor.respostas, [id]: v } })

  function campoDado(rotulo: string, k: 'profissao', tipo = 'text') {
    return (
      <label key={k} className="block">
        <RotuloCampo texto={rotulo} vazio={!dados[k].trim()} />
        {/* min-w-0: no iPad o campo de data tem largura própria e invadia o campo ao lado */}
        <input {...SEM_CORRETOR} type={tipo} value={dados[k]} onChange={(e) => mudaDado(k, e.target.value)} className={`${ENTRADA} min-w-0 appearance-none`} />
      </label>
    )
  }

  /** `extra`: na mesma fileira, depois das opções (a linha do "Outro") */
  function opcoes(rotulo: string, lista: readonly { valor: string; rotulo: string; nome?: string }[], marcadas: string[], onTocar: (v: string) => void, extra?: ReactNode) {
    return (
      <div role="group" aria-label={rotulo}>
        <RotuloCampo texto={rotulo} vazio={marcadas.length === 0} />
        <div className="flex flex-wrap gap-1">
          {lista.map((o) => {
            const sel = marcadas.includes(o.valor)
            return (
              <button key={o.valor} type="button" aria-pressed={sel} onClick={() => onTocar(o.valor)} title={o.nome} aria-label={o.nome}
                className={`border-[1.5px] px-2 py-0.5 text-[13px] ${sel ? 'border-tinta bg-tinta font-semibold text-papel' : 'border-linha hover:bg-suave'}`}>
                {o.rotulo}
              </button>
            )
          })}
          {extra}
        </div>
      </div>
    )
  }

  function campoPergunta(q: Pergunta) {
    const v = valor.respostas[q.id]
    if (q.tipo === 'arquivos') {
      const docs = Object.entries(valor.fotos).filter(([k]) => k.startsWith(`${q.id}_`))
      return (
        <div key={q.id} className="col-span-2">
          <RotuloCampo texto={q.rotulo} vazio={docs.length === 0} />
          {docs.length > 0 && <p className="text-[13px]">{docs.length} {docs.length === 1 ? 'arquivo' : 'arquivos'} · ver em Exame físico, “Inserir prints, arquivos, laudos”</p>}
        </div>
      )
    }
    if (q.tipo === 'foto') {
      const url = valor.fotos[q.id]
      return (
        <div key={q.id}>
          <RotuloCampo texto={q.rotulo} vazio={!url} />
          {url && <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={q.rotulo} className="max-h-28 border border-linha object-contain" /></a>}
        </div>
      )
    }
    if (q.tipo === 'escolha' && q.lista) {
      const escolhida = typeof v === 'string' ? v : ''
      return (
        <label key={q.id} className="block">
          <RotuloCampo texto={q.rotulo} vazio={!escolhida} />
          <select value={escolhida} onChange={(e) => mudaResposta(q.id, e.target.value)} className={`${ENTRADA} w-auto max-w-full`}>
            <option value="">Escolha</option>
            {(q.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      )
    }
    if (q.tipo === 'escolha' || q.tipo === 'varias') {
      const marcadas = Array.isArray(v) ? v : v ? [v] : []
      const linha = valor.respostas[chaveDaLinha(q.id)]
      return (
        <div key={q.id} className={q.duasColunas || q.escala || (q.opcoes ?? []).join('').length > 60 ? 'col-span-2' : ''}>
          {opcoes(q.rotulo, (q.opcoes ?? []).map((o) => ({ valor: o, rotulo: o })), marcadas, (o) =>
            mudaResposta(q.id, q.tipo === 'escolha' ? (marcadas.includes(o) ? '' : o) : alternarOpcao(marcadas, o, q.exclusiva)),
          q.abreLinha && marcadas.includes(q.abreLinha) && (
            <input {...SEM_CORRETOR} aria-label={`${q.abreLinha}: ${q.placeholder ?? 'escreva'}`} placeholder={q.placeholder}
              value={typeof linha === 'string' ? linha : ''} onChange={(e) => mudaResposta(chaveDaLinha(q.id), e.target.value)}
              className={`${ENTRADA} !w-auto min-w-[8rem] flex-1 !py-0`} />
          ))}
        </div>
      )
    }
    const texto = typeof v === 'string' ? v : ''
    return (
      <label key={q.id} className={`block ${q.tipo === 'texto-longo' || q.linhaToda ? 'col-span-2' : ''}`}>
        <RotuloCampo texto={q.rotulo} vazio={!texto.trim()} />
        <input {...SEM_CORRETOR} value={texto} onChange={(e) => mudaResposta(q.id, e.target.value)} className={ENTRADA} />
      </label>
    )
  }

  function conteudo(b: Bloco) {
    if ('parte' in b) {
      const visivel = (q: Pergunta | undefined): q is Pergunta => !!q && perguntaVisivel(q, dados.sexo, valor.respostas)
      // parte em duas colunas (como o paciente viu no PC): cabe na caixa sem rolar
      if (b.parte.colunas) {
        return b.parte.colunas.map((ids, i) => (
          <div key={i} className="grid content-start gap-y-2">{ids.map((id) => b.parte.perguntas.find((q) => q.id === id)).filter(visivel).map(campoPergunta)}</div>
        ))
      }
      return b.parte.perguntas.filter(visivel).map(campoPergunta)
    }
    // 'trabalho' (a Identificação não aparece na anamnese)
    return [
      <div key="ec">{opcoes('Estado civil', ESTADOS_CIVIS, dados.estadoCivil ? [dados.estadoCivil] : [], (v) => mudaDado('estadoCivil', dados.estadoCivil === v ? '' : v as DadosPessoais['estadoCivil']))}</div>,
      campoDado('Profissão', 'profissao'),
      <div key="te" className="col-span-2">{opcoes(perguntaTrabalho(partes).rotulo, [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }],
        dados.trabalhoExposto ? [dados.trabalhoExposto] : [], (v) => mudaDado('trabalhoExposto', dados.trabalhoExposto === v ? '' : v as DadosPessoais['trabalhoExposto']))}</div>,
    ]
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-linha px-3 py-1.5">
        <button type="button" onClick={() => onParte(parte - 1)} disabled={parte === 0} aria-label="Parte anterior" className="px-1 text-[20px] leading-none disabled:opacity-30">‹</button>
        <p className="min-w-0 flex-1 truncate text-center text-[14px]">
          {conferidas[parte] && <span className="mr-1 font-bold text-(--esp)" aria-label="conferido">✓</span>}
          <b>{bloco.titulo}</b> <span className="text-apagado">· parte {parte + 1} de {blocos.length}</span>
        </p>
        <button type="button" onClick={() => onParte(parte + 1)} disabled={parte === blocos.length - 1} aria-label="Próxima parte" className="px-1 text-[20px] leading-none disabled:opacity-30">›</button>
      </div>
      {/* salvo: só para consulta (fieldset desabilitado trava todos os campos de uma vez) */}
      <fieldset disabled={salvo} className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-2 overflow-y-auto bg-branco px-3 py-2 [&>*]:min-w-0">
        {conteudo(bloco)}
      </fieldset>
      <div className="flex items-center justify-end gap-3 border-t border-linha px-3 py-1.5">
        {salvo ? (
          <p className="flex-1 text-[13px] text-apagado">Formulário salvo no texto da anamnese. Corrija na caixa de texto (Escrever).</p>
        ) : parte < blocos.length - 1 ? (
          <button type="button" onClick={() => { onConferir(parte); onParte(parte + 1) }}
            className="border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold hover:bg-tinta hover:text-papel">
            Conferido ✓
          </button>
        ) : (
          <button type="button" onClick={() => { onConferir(parte); onSalvar() }}
            className="bg-(--esp) px-4 py-1.5 text-[14px] font-bold text-papel transition hover:-translate-y-0.5">
            Salvar formulário
          </button>
        )}
      </div>
    </div>
  )
}
