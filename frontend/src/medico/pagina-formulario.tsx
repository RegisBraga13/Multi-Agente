import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buscarEspecialidade } from '../especialidades'
import { Marca } from '../marca'
import { abrirFormulario, ErroServidor, type PedidoDoLink } from '../servidor/agenda'
import { buscarMedico } from './exemplo'
import { FormularioPaciente } from './formulario-paciente'
import type { RascunhoPedido } from './regras'
import { formatarWhatsapp } from './regras'

type Estado = { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'pronto'; pedido: PedidoDoLink }

/** Página aberta pelo link que o paciente recebe no WhatsApp: só o formulário do pedido dele. */
export function PaginaFormulario() {
  const { token = '' } = useParams()
  const navegar = useNavigate()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  useEffect(() => {
    abrirFormulario(token).then(
      (pedido) => setEstado({ tipo: 'pronto', pedido }),
      (erro) => setEstado({ tipo: 'erro', mensagem: erro instanceof ErroServidor ? erro.message : 'Não foi possível abrir o formulário.' }),
    )
  }, [token])

  const pedido = estado.tipo === 'pronto' ? estado.pedido : null
  const medico = pedido ? buscarMedico(pedido.medicoSlug) : undefined
  const esp = medico ? buscarEspecialidade(medico.especialidade) : undefined

  useEffect(() => {
    document.title = medico ? `Formulário · ${medico.tratamento} ${medico.nome}` : 'Formulário da consulta'
  }, [medico])

  const rascunho: RascunhoPedido | null = pedido && {
    modalidade: pedido.modalidade, data: pedido.data, inicio: pedido.inicio, nome: pedido.nome,
    whatsapp: formatarWhatsapp(pedido.whatsapp), atendimento: null, convenio: '', transcricao: null, forma: 'whatsapp',
  }

  return (
    <div style={{ '--esp': esp?.cor } as CSSProperties} className="flex min-h-screen flex-col">
      {/* sem cabeçalho próprio: a especialidade, "Formulário" e a parte ficam numa linha só, no topo do cartão */}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-3 sm:px-6">
        {estado.tipo === 'carregando' && <p className="py-16 text-center text-apagado">Abrindo o formulário…</p>}
        {estado.tipo === 'erro' && <p role="alert" className="py-16 text-center text-[17px] font-semibold text-alerta">{estado.mensagem}</p>}
        {pedido && !medico && <p role="alert" className="py-16 text-center text-[17px] font-semibold text-alerta">Não foi possível abrir o formulário.</p>}
        {pedido && medico && pedido.situacaoFicha === 'pronta' && (
          <div role="status" className="mx-auto max-w-3xl py-16">
            <h2 className="text-[clamp(26px,4vw,34px)] font-bold">Formulário já enviado.</h2>
            <p className="mt-3 text-[17px]">{medico.tratamento} {medico.nome} já recebeu suas respostas. Obrigado!</p>
          </div>
        )}
        {pedido && medico && rascunho && pedido.situacaoFicha !== 'pronta' && (
          <FormularioPaciente medico={medico} token={token} pedido={rascunho} onConcluir={() => navegar(`/medico/${medico.slug}`)} />
        )}
      </main>

      <footer className="border-t border-linha py-1.5 text-center text-[13px] text-apagado">
        Formulário com <Marca className="text-[17px]" />
      </footer>
    </div>
  )
}
