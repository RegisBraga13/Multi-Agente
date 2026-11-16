// Página 1, coluna da direita: exame físico (fotos + campos da especialidade); exames complementares num painel por cima.
import { useCallback, useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import type { CampoExame, Complementar } from './exemplo'
import type { Situacao } from './tipos'
import { BotaoOficializar, Cartao, Gaveta, ROTULO } from './ui'

type Props = {
  campos: CampoExame[]
  fotos: number
  /** foto real de exemplo (só para a queixa de acne, com consentimento) */
  fotoExemplo: string | null
  complementares: Complementar[]
  situacao: Situacao
  onEditar: () => void
  /** salva com os valores atuais (a história clínica é montada com eles) */
  onOficializar: (valores: { rotulo: string; valor: string }[]) => void
  onAviso: (texto: string) => void
}

export function Exame({ campos, fotos, fotoExemplo, complementares, situacao, onEditar, onOficializar, onAviso }: Props) {
  const [laudos, setLaudos] = useState(false)
  const fecharLaudos = useCallback(() => setLaudos(false), [])
  const [valores, setValores] = useState(() => campos.map((c) => c.valor))
  /** campos que o médico já mexeu: deixam de ser sugestão da IA */
  const [mexidos, setMexidos] = useState<boolean[]>(() => campos.map(() => false))
  const oficializado = situacao === 'oficializado'
  const temRascunho = campos.some((c) => c.valor)

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
      rodape={<BotaoOficializar rotulo="Salvar exame físico" oficializado={oficializado} onClick={() => onOficializar(campos.map((c, i) => ({ rotulo: c.rotulo, valor: valores[i] })))} />}
    >
      <>
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
          <dl className="mt-3 space-y-1.5">
            {campos.map((c, i) => {
              const ia = !mexidos[i] && !oficializado && !!c.valor
              return (
                <div key={c.rotulo} className="grid grid-cols-[minmax(0,136px)_minmax(0,1fr)] items-start gap-3">
                  <dt className="pt-[7px] text-[13px] font-semibold text-apagado">{c.rotulo}</dt>
                  <dd>
                    <TextoCrescente
                      value={valores[i]}
                      onChange={(e) => mudar(i, e.target.value)}
                      aria-label={c.rotulo}
                      placeholder="Descreva"
                      className={`block w-full border-[1.5px] bg-branco px-2.5 py-1 text-[14.5px] leading-snug focus:border-tinta focus:outline-none ${ia ? 'border-dashed border-(--esp-medio)' : 'border-linha'}`}
                    />
                  </dd>
                </div>
              )
            })}
          </dl>
          <p className="mt-2 text-[13px] text-apagado">
            {temRascunho ? 'Tracejado = descrição da IA a partir das fotos. Revise, edite e salve.' : 'Sem fotos ainda: descreva o exame.'}
          </p>
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
