// Anamnese, modo Formulário: o mesmo formulário que o paciente viu, uma parte por vez, já com as respostas dele.
// O médico confere o que foi respondido e completa o resto, se quiser.
import { blocosDoFormulario, type Bloco } from '../medico/blocos'
import { ALERGIAS, alternarOpcao, perguntaVisivel, type Parte, type Pergunta } from '../medico/pre-consulta'
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
}

export function FormularioMedico({ partes, valor, parte, onParte, onMudar }: Props) {
  const blocos = blocosDoFormulario(partes)
  const bloco = blocos[parte]
  const dados = valor.dados
  const mudaDado = <K extends keyof FormularioConsulta['dados']>(k: K, v: FormularioConsulta['dados'][K]) => onMudar({ ...valor, dados: { ...dados, [k]: v } })
  const mudaResposta = (id: string, v: string | string[]) => onMudar({ ...valor, respostas: { ...valor.respostas, [id]: v } })

  function campoDado(rotulo: string, k: 'nomeCompleto' | 'nomeSocial' | 'nascimento' | 'cidade' | 'profissao', tipo = 'text') {
    return (
      <label key={k} className="block">
        <RotuloCampo texto={rotulo} vazio={!dados[k].trim()} />
        {/* min-w-0: no iPad o campo de data tem largura própria e invadia o campo ao lado */}
        <input {...SEM_CORRETOR} type={tipo} value={dados[k]} onChange={(e) => mudaDado(k, e.target.value)} className={`${ENTRADA} min-w-0 appearance-none`} />
      </label>
    )
  }

  function opcoes(rotulo: string, lista: readonly { valor: string; rotulo: string; nome?: string }[], marcadas: string[], onTocar: (v: string) => void) {
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
    if (q.tipo === 'escolha' || q.tipo === 'varias') {
      const marcadas = Array.isArray(v) ? v : v ? [v] : []
      return (
        <div key={q.id}>
          {opcoes(q.rotulo, (q.opcoes ?? []).map((o) => ({ valor: o, rotulo: o })), marcadas, (o) =>
            mudaResposta(q.id, q.tipo === 'escolha' ? (marcadas.includes(o) ? '' : o) : alternarOpcao(marcadas, o, q.exclusiva)))}
        </div>
      )
    }
    const texto = typeof v === 'string' ? v : ''
    return (
      <label key={q.id} className={`block ${q.tipo === 'texto-longo' ? 'col-span-2' : ''}`}>
        <RotuloCampo texto={q.rotulo} vazio={!texto.trim()} />
        <input {...SEM_CORRETOR} value={texto} onChange={(e) => mudaResposta(q.id, e.target.value)} className={ENTRADA} />
      </label>
    )
  }

  function conteudo(b: Bloco) {
    if ('parte' in b) return b.parte.perguntas.filter((q) => perguntaVisivel(q, dados.sexo)).map(campoPergunta)
    if (b.id === 'trabalho') {
      return [
        <div key="ec">{opcoes('Estado civil', ESTADOS_CIVIS, dados.estadoCivil ? [dados.estadoCivil] : [], (v) => mudaDado('estadoCivil', dados.estadoCivil === v ? '' : v as DadosPessoais['estadoCivil']))}</div>,
        campoDado('Profissão', 'profissao'),
        <div key="te" className="col-span-2">{opcoes('Trabalha ao ar livre, exposto ao sol ou a produtos químicos?', [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }],
          dados.trabalhoExposto ? [dados.trabalhoExposto] : [], (v) => mudaDado('trabalhoExposto', dados.trabalhoExposto === v ? '' : v as DadosPessoais['trabalhoExposto']))}</div>,
      ]
    }
    // um campo por linha onde a largura aperta (iPad): nada sobe sobre o vizinho
    return [
      <div key="n" className="col-span-2">{campoDado('Nome completo', 'nomeCompleto')}</div>,
      <div key="ns" className="col-span-2">{campoDado('Nome social', 'nomeSocial')}</div>,
      <div key="dn">{campoDado('Nascimento', 'nascimento', 'date')}</div>,
      <div key="s">{opcoes('Sexo', [{ valor: 'M', rotulo: 'M', nome: 'Masculino' }, { valor: 'F', rotulo: 'F', nome: 'Feminino' }, { valor: 'I', rotulo: 'I', nome: 'Intersexo' }],
        dados.sexo ? [dados.sexo] : [], (v) => mudaDado('sexo', v as DadosPessoais['sexo']))}</div>,
      campoDado('Cidade', 'cidade'),
      <label key="uf" className="block">
        <RotuloCampo texto="UF" vazio={!dados.uf} />
        <input {...SEM_CORRETOR} maxLength={2} value={dados.uf} onChange={(e) => mudaDado('uf', e.target.value.toUpperCase())} className={`${ENTRADA} w-16`} />
      </label>,
      <div key="al" className="col-span-2">{campoPergunta(ALERGIAS)}</div>,
    ]
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-linha px-3 py-1.5">
        <button type="button" onClick={() => onParte(parte - 1)} disabled={parte === 0} aria-label="Parte anterior" className="px-1 text-[20px] leading-none disabled:opacity-30">‹</button>
        <p className="min-w-0 flex-1 truncate text-center text-[14px]">
          <b>{bloco.titulo}</b> <span className="text-apagado">· parte {parte + 1} de {blocos.length}</span>
        </p>
        <button type="button" onClick={() => onParte(parte + 1)} disabled={parte === blocos.length - 1} aria-label="Próxima parte" className="px-1 text-[20px] leading-none disabled:opacity-30">›</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-3 gap-y-2 overflow-y-auto bg-branco px-3 py-2 [&>*]:min-w-0">
        {conteudo(bloco)}
      </div>
    </div>
  )
}
