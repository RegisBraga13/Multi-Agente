// Página 1, coluna da direita: exame físico (fotos + campos da especialidade); exames complementares num painel por cima.
import { useCallback, useRef, useState } from 'react'
import { CampoLinha, SEM_CORRETOR } from './campo-linha'
import type { CampoExame, Complementar } from './exemplo'
import { ExameRoteiro } from './exame-roteiro'
import { camposDoRoteiro, type MarcasExame, type Roteiro } from './roteiro-exame'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao, Gaveta, ROTULO } from './ui'

/** borda, espaçamento e fonte dos campos do exame */
const CAIXA = 'border-[1.5px] px-2.5 py-0.5 text-[14.5px] leading-snug'

type Props = {
  campos: CampoExame[]
  fotos: number
  /** foto real de exemplo (só para a queixa de acne, com consentimento) */
  fotoExemplo: string | null
  /** lesões marcadas pela IA na foto 1 */
  marcas: [number, number][]
  complementares: Complementar[]
  /** fotos que o paciente mandou pelo formulário (endereços) */
  fotosPaciente?: string[]
  /** receitas anteriores, exames e laudos que o paciente mandou pelo formulário */
  documentos?: { nome: string; url: string }[]
  /** retorno: título "Fotos e exames" e, ao lado, as fotos da consulta anterior para comparar */
  retorno?: { data: string; fotos: number }
  situacao: Situacao
  /** consulta retomada do servidor: as observações que já estavam salvas */
  observacoesIniciais?: string
  /** exame por roteiro da especialidade (ex.: Reumatologia): partes que abrem e fecham, no lugar dos campos de texto */
  roteiro?: Roteiro
  /** consulta retomada: o que já estava marcado no roteiro */
  marcasIniciais?: MarcasExame
  /** retorno com roteiro: o que foi marcado na consulta anterior */
  marcasAnteriores?: MarcasExame
  onEditar: () => void
  /** salva com os valores atuais (a história clínica é montada com eles); com roteiro, também as marcas */
  onOficializar: (valores: { rotulo: string; valor: string }[], marcas?: MarcasExame) => void
  onAviso: (texto: string) => void
}

export function Exame({ campos, fotos, fotoExemplo, marcas, complementares, fotosPaciente = [], documentos = [], retorno, situacao, observacoesIniciais = '', roteiro, marcasIniciais = {}, marcasAnteriores, onEditar, onOficializar, onAviso }: Props) {
  const [marcasRoteiro, setMarcasRoteiro] = useState<MarcasExame>(marcasIniciais)
  /** roteiro com uma parte aberta: as fotos se recolhem para a parte caber na tela */
  const [parteAberta, setParteAberta] = useState(false)
  const [laudos, setLaudos] = useState(false)
  const fecharLaudos = useCallback(() => setLaudos(false), [])
  const [valores, setValores] = useState(() => campos.map((c) => c.valor))
  /** campos que o médico já mexeu: deixam de ser sugestão da IA */
  const [mexidos, setMexidos] = useState<boolean[]>(() => campos.map(() => false))
  const oficializado = situacao === 'oficializado'
  const temRascunho = campos.some((c) => c.valor)
  /** texto livre do médico, sem depender da IA */
  const [observacoes, setObservacoes] = useState(observacoesIniciais)
  /** Enter encerra o campo e pula para o de baixo (o último só encerra) */
  const caixas = useRef<(HTMLInputElement | null)[]>([])
  /** campo aberto no editor de baixo (o último índice = Observações); null = nenhum (todos os campos à vista) */
  const [ativo, setAtivo] = useState<number | null>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  /** Enter: guarda o que foi escrito e fecha o editor (todos os campos voltam); o próximo só abre se for clicado */
  const fechar = () => { setAtivo(null); (document.activeElement as HTMLElement | null)?.blur() }
  const nomes = [...campos.map((c) => c.rotulo), 'Observações']
  const valorDe = (i: number) => (i === campos.length ? observacoes : valores[i])
  const mudarObs = (v: string) => { setObservacoes(v); if (situacao !== 'revisado_medico') onEditar() }

  const mudar = (i: number, v: string) => {
    setValores((xs) => xs.map((x, j) => (j === i ? v : x)))
    setMexidos((xs) => xs.map((x, j) => (j === i ? true : x)))
    if (situacao !== 'revisado_medico') onEditar()
  }

  const inserir = (
    <div className="flex flex-1 justify-center">
      <button type="button" onClick={() => setLaudos(true)} className="border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold hover:bg-tinta hover:text-papel">
        Inserir prints, arquivos, laudos{complementares.length + documentos.length ? ` (${complementares.length + documentos.length})` : ''}
      </button>
    </div>
  )

  return (
    <Cartao
      titulo={retorno ? 'Fotos e exames' : 'Exame físico e complementar'}
      cabecalho={inserir}
      legenda={temRascunho ? 'Tracejado = sugestão da IA · clique para editar' : undefined}
      rodape={<BotaoOficializar rotulo={retorno ? 'Salvar fotos e exames' : 'Salvar exame físico'} oficializado={oficializado} onClick={() => (roteiro
        ? onOficializar([...camposDoRoteiro(roteiro, marcasRoteiro, !!marcasAnteriores).map((c) => ({ rotulo: c.rotulo, valor: c.valor ?? '' })), { rotulo: 'Observações', valor: observacoes }], marcasRoteiro)
        : onOficializar([...campos.map((c, i) => ({ rotulo: c.rotulo, valor: valores[i] })), { rotulo: 'Observações', valor: observacoes }]))} />}
    >
      <>
          {retorno && (
            <div className="mb-2 flex items-center gap-2">
              <p className={`${ROTULO} shrink-0`}>Consulta anterior · {retorno.data}</p>
              {Array.from({ length: retorno.fotos }, (_, i) => (
                <span key={i} title={`Foto ${i + 1} da consulta anterior`} className="flex size-9 items-center justify-center bg-suave font-titulo text-[14px] font-semibold text-apagado">{i + 1}</span>
              ))}
            </div>
          )}
          {!(roteiro && parteAberta) && <Fotos fotos={fotosPaciente.length || fotos} urls={fotosPaciente} fotoExemplo={fotoExemplo} marcas={marcas} onAdicionar={() => onAviso('Fotos e câmera chegam numa próxima etapa.')} />}
          {roteiro ? (
            <ExameRoteiro roteiro={roteiro} marcas={marcasRoteiro} anteriores={marcasAnteriores} onAbrir={setParteAberta}
              onMarcas={(m) => { setMarcasRoteiro(m); if (situacao !== 'revisado_medico') onEditar() }}
              observacoes={observacoes} onObservacoes={mudarObs} />
          ) : (<>
          {/* editando um campo, os outros se recolhem; ao sair (clicar fora), todos voltam */}
          <div className="flex min-h-0 flex-1 flex-col" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAtivo(null) }}>
          <dl className="mt-2 space-y-[3px]">
            {campos.map((c, i) => {
              const ia = !mexidos[i] && !oficializado && !!c.valor
              return (
                <div key={c.rotulo} className={`grid grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-start gap-3 ${ativo !== null && ativo !== i ? 'hidden' : ''}`}>
                  <dt className="pt-[5px] text-[13px] font-semibold text-apagado">{c.rotulo}</dt>
                  <dd>
                    <CampoLinha
                      ref={(el) => { caixas.current[i] = el }}
                      value={valores[i]}
                      onChange={(e) => mudar(i, e.target.value)}
                      onEnter={fechar}
                      onFocus={() => setAtivo(i)}
                      aria-label={c.rotulo}
                      placeholder="Descreva"
                      caixa={CAIXA}
                      className={`bg-branco focus:border-tinta focus:outline-none ${ativo === i ? 'border-tinta' : ia ? 'border-dashed border-(--esp-medio)' : 'border-linha'}`}
                    />
                  </dd>
                </div>
              )
            })}
            {/* campo livre: acrescentar, observar, descrever sem depender da IA */}
            <div className={`grid grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-start gap-3 ${ativo !== null && ativo !== campos.length ? 'hidden' : ''}`}>
              <dt className="pt-[5px] text-[13px] font-semibold text-apagado">Observações</dt>
              <dd>
                <CampoLinha
                  ref={(el) => { caixas.current[campos.length] = el }}
                  value={observacoes}
                  onChange={(e) => mudarObs(e.target.value)}
                  onEnter={fechar}
                  onFocus={() => setAtivo(campos.length)}
                  aria-label="Observações"
                  placeholder={temRascunho ? 'Acrescente o que quiser, com suas palavras' : fotosPaciente.length || fotos ? 'Descreva o exame aqui' : 'Sem fotos ainda: descreva o exame aqui'}
                  caixa={CAIXA}
                  className={`bg-branco focus:border-tinta focus:outline-none ${ativo === campos.length ? 'border-tinta' : 'border-linha'}`}
                />
              </dd>
            </div>
          </dl>
          {/* editor: ao clicar num campo, o texto inteiro dele aparece aqui (quebrando linha) para editar sem perder a visão */}
          {ativo !== null && (
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <p className={ROTULO}>{nomes[ativo]}</p>
              <textarea
                ref={editor}
                {...SEM_CORRETOR}
                value={valorDe(ativo)}
                onChange={(e) => (ativo === campos.length ? mudarObs(e.target.value) : mudar(ativo, e.target.value))}
                onKeyDown={(e) => {
                  // Enter guarda e fecha o editor
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  fechar()
                }}
                aria-label={`Editor: ${nomes[ativo]}`}
                placeholder={ativo === campos.length ? 'Acrescente o que quiser, com suas palavras' : 'Descreva'}
                className="mt-1 block min-h-[72px] w-full flex-1 resize-none border-[1.5px] border-tinta bg-branco px-3 py-2 text-[14.5px] leading-snug focus:outline-none"
              />
            </div>
          )}
          </div>
          </>)}
      </>
      {laudos && (
        <Gaveta titulo="Prints, arquivos, laudos" onFechar={fecharLaudos}>
          {documentos.length > 0 && (
            <div className="mb-4">
              <p className="text-[15px] font-semibold">Enviados pelo paciente no formulário</p>
              <ul className="mt-1 divide-y divide-linha border-y border-linha">
                {documentos.map((d) => (
                  <li key={d.url} className="py-1.5 text-[14.5px]">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4 hover:text-(--esp)">{d.nome}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Complementares lista={complementares} semMensagem={documentos.length > 0} onAnexar={() => onAviso('Anexar laudos chega numa próxima etapa.')} />
        </Gaveta>
      )}
    </Cartao>
  )
}

/**
 * Fotos do exame: todas juntas no mesmo espaço (quanto mais fotos, menores). Um clique abre a foto para analisar
 * (a 1 com as lesões marcadas pela IA); as outras ficam pequenas ao lado para trocar. Nada abre ao passar o mouse.
 */
function Fotos({ fotos, urls, fotoExemplo, marcas, onAdicionar }: { fotos: number; urls: string[]; fotoExemplo: string | null; marcas: [number, number][]; onAdicionar: () => void }) {
  const [aberta, setAberta] = useState<number | null>(null)
  const real = (i: number) => urls[i] ?? (i === 0 ? fotoExemplo : null)
  const mais = (classe: string, comNome = true) => (
    <button type="button" onClick={onAdicionar} aria-label="Adicionar foto"
      className={`flex flex-col items-center justify-center border-[1.5px] border-dashed border-(--esp-medio) text-[12px] font-semibold text-apagado hover:border-tinta hover:text-tinta ${classe}`}>
      <span className="text-[20px] leading-none">+</span>{comNome && 'Foto'}
    </button>
  )
  if (fotos === 0) return <div className="flex">{mais('size-[58px]')}</div>

  if (aberta === null) {
    // todas juntas: a grade se ajusta ao número de fotos (+ o botão de adicionar) sem sair do espaço
    const n = fotos + 1
    const linhas = n <= 4 ? 1 : n <= 10 ? 2 : 3
    const colunas = Math.ceil(n / linhas)
    return (
      // o quadro tem tamanho fixo (proporção da foto, no máximo 170 px de altura); a grade se encaixa dentro
      <div className="relative aspect-[2.8/1] max-h-[138px] lg:max-h-[170px]">
      <div className="absolute inset-0 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${linhas}, minmax(0, 1fr))` }}>
        {Array.from({ length: fotos }, (_, i) => (
          <button key={i} type="button" onClick={() => setAberta(i)} aria-label={`Abrir foto ${i + 1}`} className="relative min-h-0 overflow-hidden bg-suave">
            {real(i) ? <img src={real(i)!} alt="" className="block size-full object-cover" />
              : <span className="flex size-full items-center justify-center font-titulo text-[20px] font-semibold text-apagado">{i + 1}</span>}
            {real(i) && <span className="absolute top-1 left-1 bg-tinta/80 px-1.5 text-[11px] font-semibold text-papel">{i + 1}</span>}
          </button>
        ))}
        {mais('min-h-0')}
      </div>
      </div>
    )
  }

  const img = real(aberta)
  return (
    <div className="flex gap-2">
      <div className="relative aspect-[2.8/1] max-h-[138px] lg:max-h-[170px] min-w-0 flex-1 overflow-hidden bg-suave">
        {img ? (
          <div className="absolute inset-x-0 top-0 aspect-[1000/650] -translate-y-[12.6%]">
            <img src={img} alt={`Foto ${aberta + 1} do exame`} className="block size-full object-cover" />
            {marcas.map(([x, y], i) => (
              <i key={i} style={{ left: `${x}%`, top: `${y}%` }} title={`Lesão ${i + 1}`}
                className="absolute -mt-[10px] -ml-[10px] size-[20px] rounded-full! border-2 border-(--esp) bg-branco text-center text-[11px] leading-[16px] font-bold text-tinta not-italic">
                {i + 1}
              </i>
            ))}
          </div>
        ) : (
          <span className="flex size-full items-center justify-center font-titulo text-[28px] font-semibold text-apagado">Foto {aberta + 1}</span>
        )}
        <button type="button" onClick={() => setAberta(null)} className="absolute top-1 left-1 bg-tinta/80 px-1.5 py-0.5 text-[11px] font-semibold text-papel hover:bg-tinta">× Todas as fotos</button>
        {img && marcas.length > 0 && <span className="absolute top-1 right-1 bg-tinta/80 px-1.5 py-0.5 text-[11px] font-semibold text-papel">Foto {aberta + 1} · {marcas.length} lesões marcadas pela IA</span>}
      </div>
      {/* as outras, pequenas ao lado: um clique troca a foto aberta */}
      <div className="flex flex-col flex-wrap content-start gap-1">
        {Array.from({ length: fotos }, (_, i) => i).filter((i) => i !== aberta).map((i) => (
          <button key={i} type="button" onClick={() => setAberta(i)} aria-label={`Abrir foto ${i + 1}`}
            className="flex size-[36px] items-center justify-center overflow-hidden bg-suave font-titulo text-[15px] font-semibold text-apagado hover:outline-[1.5px] hover:outline-tinta">
            {real(i) ? <img src={real(i)!} alt="" className="block size-full object-cover" /> : i + 1}
          </button>
        ))}
        {mais('size-[36px]', false)}
      </div>
    </div>
  )
}

function Complementares({ lista, semMensagem = false, onAnexar }: { lista: Complementar[]; semMensagem?: boolean; onAnexar: () => void }) {
  return (
    <div className="space-y-3">
      {lista.length === 0 && !semMensagem && <p className="text-[14.5px] text-apagado">Nenhum exame trazido pelo paciente.</p>}
      {lista.map((c) => (
        <div key={c.exame}>
          <p className="text-[15px] font-semibold">{c.exame} <span className="font-normal text-apagado">· {c.data} · {c.origem}</span></p>
          <ul className="mt-1 divide-y divide-linha border-y border-linha">
            {c.itens.map((it) => (
              <li key={it.nome} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-1 text-[14.5px]">
                <span>{it.nome}</span>
                {it.v.status === 'MISSING' ? (
                  <span className="text-[13.5px] text-apagado italic">não encontrado no laudo</span>
                ) : (
                  <span className={`font-semibold ${it.v.status === 'INFERRED' ? 'border-b-[1.5px] border-dashed border-(--esp-medio)' : ''}`}>{it.v.valor}</span>
                )}
                {it.v.status === 'INFERRED' && <span className="col-span-2 text-[13px] text-apagado">⚠ {it.v.aviso}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className={ROTULO}>Valores extraídos pela IA; tracejado = confira no laudo</p>
      <button type="button" onClick={onAnexar} className="border-[1.5px] border-dashed border-(--esp-medio) px-3 py-1.5 text-[14px] font-semibold text-apagado hover:border-tinta hover:text-tinta">
        + Anexar laudo
      </button>
    </div>
  )
}
