// Página 1, coluna da direita: exame físico (fotos + campos da especialidade); exames complementares num painel por cima.
import { useCallback, useRef, useState } from 'react'
import { CampoLinha } from './campo-linha'
import type { CampoExame, Complementar } from './exemplo'
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
  situacao: Situacao
  onEditar: () => void
  /** salva com os valores atuais (a história clínica é montada com eles) */
  onOficializar: (valores: { rotulo: string; valor: string }[]) => void
  onAviso: (texto: string) => void
}

export function Exame({ campos, fotos, fotoExemplo, marcas, complementares, situacao, onEditar, onOficializar, onAviso }: Props) {
  const [laudos, setLaudos] = useState(false)
  const fecharLaudos = useCallback(() => setLaudos(false), [])
  const [valores, setValores] = useState(() => campos.map((c) => c.valor))
  /** campos que o médico já mexeu: deixam de ser sugestão da IA */
  const [mexidos, setMexidos] = useState<boolean[]>(() => campos.map(() => false))
  const oficializado = situacao === 'oficializado'
  const temRascunho = campos.some((c) => c.valor)
  /** texto livre do médico, sem depender da IA */
  const [observacoes, setObservacoes] = useState('')
  /** Enter encerra o campo e pula para o de baixo (o último só encerra) */
  const caixas = useRef<(HTMLInputElement | null)[]>([])
  const proximo = (i: number) => { const el = caixas.current[i + 1]; if (el) el.focus(); else caixas.current[i]?.blur() }

  const mudar = (i: number, v: string) => {
    setValores((xs) => xs.map((x, j) => (j === i ? v : x)))
    setMexidos((xs) => xs.map((x, j) => (j === i ? true : x)))
    if (situacao !== 'revisado_medico') onEditar()
  }

  const inserir = (
    <div className="flex flex-1 justify-center">
      <button type="button" onClick={() => setLaudos(true)} className="border-[1.5px] border-tinta px-3 py-1 text-[14px] font-bold hover:bg-tinta hover:text-papel">
        Inserir prints, arquivos, laudos{complementares.length ? ` (${complementares.length})` : ''}
      </button>
    </div>
  )

  return (
    <Cartao
      titulo="Exame físico e complementar"
      cabecalho={inserir}
      legenda={temRascunho ? 'Tracejado = sugestão da IA · clique para editar' : undefined}
      rodape={<BotaoOficializar rotulo="Salvar exame físico" oficializado={oficializado} onClick={() => onOficializar([...campos.map((c, i) => ({ rotulo: c.rotulo, valor: valores[i] })), { rotulo: 'Observações', valor: observacoes }])} />}
    >
      <>
          {fotoExemplo ? (
            // com foto: a foto 1 grande, com as lesões marcadas pela IA; as demais ao lado
            <div className="flex gap-2">
              <div className="relative aspect-[2.8/1] min-w-0 flex-1 overflow-hidden bg-suave">
                <div className="absolute inset-x-0 top-0 aspect-[1000/650] -translate-y-[12.6%]">
                  <img src={fotoExemplo} alt="Foto 1 do exame" className="block size-full object-cover" />
                  {marcas.map(([x, y], i) => (
                    <i key={i} style={{ left: `${x}%`, top: `${y}%` }} title={`Lesão ${i + 1}`}
                      className="absolute -mt-[10px] -ml-[10px] size-[20px] rounded-full! border-2 border-(--esp) bg-branco text-center text-[11px] leading-[16px] font-bold text-tinta not-italic">
                      {i + 1}
                    </i>
                  ))}
                </div>
                <span className="absolute top-1 right-1 bg-tinta/80 px-1.5 py-0.5 text-[11px] font-semibold text-papel">Foto 1 · {marcas.length} lesões marcadas pela IA</span>
              </div>
              <div className="flex flex-col gap-1">
                {Array.from({ length: fotos - 1 }, (_, i) => (
                  <span key={i} className="flex size-[36px] items-center justify-center bg-suave font-titulo text-[15px] font-semibold text-apagado" aria-label={`Foto ${i + 2}`}>{i + 2}</span>
                ))}
                <button type="button" onClick={() => onAviso('Fotos e câmera chegam numa próxima etapa.')} aria-label="Adicionar foto" className="flex size-[36px] items-center justify-center border-[1.5px] border-dashed border-(--esp-medio) text-[20px] text-apagado hover:border-tinta hover:text-tinta">+</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: fotos }, (_, i) =>
                i === 0 && fotoExemplo ? (
                  <img key={i} src={fotoExemplo} alt="Foto 1 do exame" className="size-[58px] object-cover" />
                ) : (
                  <span key={i} className="flex size-[58px] items-center justify-center bg-suave font-titulo text-[20px] font-semibold text-apagado" aria-label={`Foto ${i + 1}`}>{i + 1}</span>
                ),
              )}
              <button type="button" onClick={() => onAviso('Fotos e câmera chegam numa próxima etapa.')} className="flex size-[58px] flex-col items-center justify-center border-[1.5px] border-dashed border-(--esp-medio) text-[12px] font-semibold text-apagado hover:border-tinta hover:text-tinta">
                <span className="text-[20px] leading-none">+</span>Foto
              </button>
            </div>
          )}
          <dl className="mt-2 space-y-[3px]">
            {campos.map((c, i) => {
              const ia = !mexidos[i] && !oficializado && !!c.valor
              return (
                <div key={c.rotulo} className="grid grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-start gap-3">
                  <dt className="pt-[5px] text-[13px] font-semibold text-apagado">{c.rotulo}</dt>
                  <dd>
                    <CampoLinha
                      ref={(el) => { caixas.current[i] = el }}
                      value={valores[i]}
                      onChange={(e) => mudar(i, e.target.value)}
                      onEnter={() => proximo(i)}
                      aria-label={c.rotulo}
                      placeholder="Descreva"
                      caixa={CAIXA}
                      className={`bg-branco focus:border-tinta focus:outline-none ${ia ? 'border-dashed border-(--esp-medio)' : 'border-linha'}`}
                    />
                  </dd>
                </div>
              )
            })}
            {/* campo livre: acrescentar, observar, descrever sem depender da IA */}
            <div className="grid grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-start gap-3">
              <dt className="pt-[5px] text-[13px] font-semibold text-apagado">Observações</dt>
              <dd>
                <CampoLinha
                  ref={(el) => { caixas.current[campos.length] = el }}
                  value={observacoes}
                  onChange={(e) => { setObservacoes(e.target.value); if (situacao !== 'revisado_medico') onEditar() }}
                  onEnter={() => proximo(campos.length)}
                  aria-label="Observações"
                  placeholder={temRascunho ? 'Acrescente o que quiser, com suas palavras' : 'Sem fotos ainda: descreva o exame aqui'}
                  caixa={CAIXA}
                  className="border-linha bg-branco focus:border-tinta focus:outline-none"
                />
              </dd>
            </div>
          </dl>
      </>
      {laudos && (
        <Gaveta titulo="Prints, arquivos, laudos" onFechar={fecharLaudos}>
          <Complementares lista={complementares} onAnexar={() => onAviso('Anexar laudos chega numa próxima etapa.')} />
        </Gaveta>
      )}
    </Cartao>
  )
}

function Complementares({ lista, onAnexar }: { lista: Complementar[]; onAnexar: () => void }) {
  return (
    <div className="space-y-3">
      {lista.length === 0 && <p className="text-[14.5px] text-apagado">Nenhum exame trazido pelo paciente.</p>}
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
