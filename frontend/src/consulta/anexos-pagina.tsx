// Página 5: receita e anexos — o fim da consulta. À esquerda, os anexos que a IA montou só com a conduta
// salva (o médico escolhe quais emitir); à direita, o documento aberto, como uma folha: editar e revisar,
// assinar (só os que exigem; simulação) e enviar ao paciente (simulação). Enviado = bloco cheio.
// Com todos os escolhidos enviados, "Finalizar consulta".
import { useState } from 'react'
import { TextoCrescente } from '../medico/texto-crescente'
import { proximoPasso, type Anexo, type DadosConsulta, type TipoAnexo } from './anexos'
import { SEM_CORRETOR } from './campo-linha'
import type { Situacao } from './tipos'
import { Cartao, ROTULO } from './ui'

const FOLHA: Record<TipoAnexo, string> = {
  receita: 'Receituário médico', exames: 'Solicitação de exames', encaminhamento: 'Encaminhamento',
  orientacoes: 'Orientações ao paciente', atestado: 'Atestado médico', laudo: 'Laudo médico',
}
const PASSO = { revisar: 'Marcar como revisado', assinar: 'Assinar com certificado digital', enviar: 'Enviar ao paciente' } as const
// ︎: o símbolo em texto (sem a cor do emoji), na cor da tinta
const ASSINA = '✍︎'

/** etiqueta curta da situação do anexo, na lista */
function etiqueta(a: Anexo): string {
  if (!a.emitir) return 'Não emitir'
  if (a.estado === 'enviado') return '✓ Enviado'
  const p = proximoPasso(a)
  return p === 'revisar' ? 'Revisar' : p === 'assinar' ? 'Assinar' : 'Enviar'
}

type Props = {
  anexos: Anexo[]
  dados: DadosConsulta
  situacao: Situacao
  podeFinalizar: boolean
  pendencia: string | null
  onEmitir: (tipo: TipoAnexo) => void
  onEditar: (tipo: TipoAnexo, texto: string) => void
  onAvancar: (tipo: TipoAnexo) => void
  onFinalizar: () => void
}

export function PaginaAnexos(p: Props) {
  const { anexos } = p
  const [aberto, setAberto] = useState<TipoAnexo>(() => anexos.find((a) => a.emitir)?.tipo ?? anexos[0].tipo)
  const [tentou, setTentou] = useState(false)
  const a = anexos.find((x) => x.tipo === aberto) ?? anexos[0]
  const passo = proximoPasso(a)
  const escolhidos = anexos.filter((x) => x.emitir)
  const enviados = escolhidos.filter((x) => x.estado === 'enviado').length
  const comAssinatura = escolhidos.filter((x) => x.assinatura)
  const assinados = comAssinatura.filter((x) => x.estado === 'assinado' || x.estado === 'enviado').length
  const finalizada = p.situacao === 'oficializado'

  return (
    <Cartao
      titulo="Receita e anexos"
      cabecalho={<p className="flex-1 text-center text-[13.5px] text-apagado">Montados só com a conduta salva. Escolha, revise, assine e envie.</p>}
      legenda={`☑ = emitir · ${ASSINA} = exige certificado digital · assinatura e envio: simulação`}
      rodape={finalizada ? <span className="text-[14px] font-semibold text-petroleo">✓ Consulta finalizada</span> : (
        <>
          {tentou && p.pendencia && <span className="text-[13.5px] whitespace-nowrap text-apagado">{p.pendencia}</span>}
          <button type="button" disabled={!p.podeFinalizar} onClick={() => (p.pendencia ? setTentou(true) : p.onFinalizar())}
            className="bg-petroleo px-4 py-2 text-[15px] font-bold whitespace-nowrap text-papel transition enabled:hover:-translate-y-0.5 disabled:opacity-40">
            Finalizar consulta
          </button>
        </>
      )}
    >
      <div className="grid flex-1 gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={ROTULO}>Anexos · toque para abrir</p>
          {anexos.map((x) => {
            const enviado = x.estado === 'enviado'
            const aqui = x.tipo === aberto
            // enviado = bloco cheio (petróleo); aberto = tom da especialidade; escolhido = contorno cheio; não emitir = tracejado
            const estilo = enviado ? 'border-petroleo bg-petroleo text-papel'
              : aqui ? 'border-(--esp) bg-(--esp-claro)'
              : x.emitir ? 'border-(--esp-medio) bg-branco'
              : 'border-dashed border-linha bg-branco text-apagado'
            return (
              <div key={x.tipo} className={`flex min-h-[46px] items-stretch border-[1.5px] transition-colors ${estilo} ${aqui && enviado ? 'outline-2 outline-offset-2 outline-(--esp)' : ''}`}>
                <button type="button" onClick={() => p.onEmitir(x.tipo)} disabled={enviado} aria-pressed={x.emitir} aria-label={`Emitir ${x.titulo}`}
                  className={`grid w-11 shrink-0 place-items-center border-r-[1.5px] ${enviado ? 'border-papel/30' : 'border-linha'}`}>
                  <span className={`grid size-[18px] place-items-center border-[1.5px] text-[12px] font-extrabold ${enviado ? 'border-papel' : x.emitir ? 'border-(--esp) text-(--esp)' : 'border-apagado'}`}>{x.emitir ? '✓' : ''}</span>
                </button>
                <button type="button" onClick={() => setAberto(x.tipo)} aria-current={aqui}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left">
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{x.titulo}</span>
                  {x.assinatura && <span title="Exige certificado digital" className="text-[14px]">{ASSINA}</span>}
                  <span className={`shrink-0 text-[12.5px] font-semibold ${enviado ? '' : 'text-apagado'}`}>{etiqueta(x)}</span>
                </button>
              </div>
            )
          })}
          {/* resumo no cartão escuro */}
          <div className="mt-auto flex items-baseline gap-4 bg-escuro px-4 py-2.5 text-sobre-escuro">
            <span className="text-[26px] leading-none font-bold tabular-nums">{enviados}/{escolhidos.length}</span>
            <span className="text-[13.5px]">enviados{comAssinatura.length > 0 && <> · <b>{assinados}/{comAssinatura.length}</b> assinados</>}</span>
          </div>
        </div>

        {/* o documento aberto, como uma folha */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-1 flex-col border border-linha bg-branco px-5 py-3 shadow-sm">
            <p className="border-b border-linha pb-1.5 text-center text-[11.5px] font-bold tracking-[0.14em] text-apagado uppercase">{FOLHA[a.tipo]}</p>
            <p className="mt-2 mb-2 flex flex-wrap justify-between gap-2 text-[13.5px]">
              <span>Paciente: <b>{p.dados.paciente}</b></span>
              <span>Data: <b>{p.dados.data}</b></span>
            </p>
            <TextoCrescente
              {...SEM_CORRETOR}
              value={a.texto}
              readOnly={a.estado === 'enviado'}
              onChange={(e) => p.onEditar(a.tipo, e.target.value)}
              aria-label={`Texto: ${a.titulo}`}
              className="-mx-1 block w-[calc(100%+0.5rem)] bg-transparent px-1 text-[14.5px] leading-[1.45] text-tinta hover:bg-suave/50 focus:bg-suave/70 focus:outline-none read-only:hover:bg-transparent"
            />
            <p className="mt-auto border-t border-linha pt-1.5 text-[12px] text-apagado">
              {!a.assinatura ? 'Não exige assinatura digital.'
                : a.estado === 'assinado' || a.estado === 'enviado' ? `${ASSINA} Assinado com certificado digital (simulação).`
                : `${ASSINA} Assinatura digital pendente.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {a.estado === 'enviado' ? (
              <span className="text-[14px] font-semibold text-petroleo">✓ Enviado ao paciente por WhatsApp e e-mail (simulação)</span>
            ) : !a.emitir ? (
              <button type="button" onClick={() => p.onEmitir(a.tipo)} className="border-[1.5px] border-tinta px-3 py-1.5 text-[14px] font-semibold hover:bg-tinta hover:text-papel">Emitir este anexo</button>
            ) : passo && (
              <>
                {a.estado !== 'rascunho' && <span className="text-[13px] text-apagado">✓ Revisado{a.estado === 'assinado' ? ' · assinado' : ''}</span>}
                <button type="button" disabled={!a.texto.trim()} onClick={() => p.onAvancar(a.tipo)}
                  className="bg-(--esp) px-4 py-1.5 text-[14.5px] font-bold text-papel transition enabled:hover:-translate-y-0.5 disabled:opacity-40">
                  {PASSO[passo]}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Cartao>
  )
}
