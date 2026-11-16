// Mensagem do formulário para o WhatsApp do consultório (teste, 15/11/2026).
// Enquanto não há envio automático, o paciente manda o formulário pelo próprio WhatsApp:
// a página abre a conversa com esta mensagem pronta. Fotos não cabem no link; vão em seguida.
import { perguntaVisivel, type Parte, type RespostasPreConsulta } from './pre-consulta'
import { calcularIdade, formatarWhatsapp, normalizarWhatsapp, type DadosPessoais, type RascunhoPedido } from './regras'
import { NOME_MODALIDADE, rotuloDiaLongo } from './textos'
import type { Medico } from './tipos'

type Entrada = {
  medico: Medico
  pedido: RascunhoPedido
  dados: DadosPessoais
  partes: Parte[]
  respostas: RespostasPreConsulta
  /** quantas fotos o paciente escolheu */
  fotos: number
  hoje: Date
}

const SEXO: Record<DadosPessoais['sexo'], string> = { F: 'Feminino', M: 'Masculino', outro: 'Outro', '': '' }
const SIM_NAO = { sim: 'Sim', nao: 'Não', '': '' }

function texto(r: string | string[] | undefined): string {
  return (Array.isArray(r) ? r.join(', ') : (r ?? '')).trim()
}

export function mensagemFormulario({ medico, pedido, dados, partes, respostas, fotos, hoje }: Entrada): string {
  const linhas: string[] = [`*Formulário da consulta · ${medico.tratamento} ${medico.nome}*`]
  if (pedido.data && pedido.inicio) {
    linhas.push(`Pedido: ${rotuloDiaLongo(pedido.data)}, às ${pedido.inicio} · ${NOME_MODALIDADE[pedido.modalidade]}`)
  }
  if (pedido.transcricao) linhas.push(`Transcrição da consulta: ${pedido.transcricao}`)

  const idade = calcularIdade(dados.nascimento, hoje)
  const [a, m, d] = dados.nascimento.split('-')
  const whatsapp = normalizarWhatsapp(dados.whatsapp)
  const atendimento = dados.atendimento === 'convenio'
    ? `Convênio${dados.convenio.trim() ? ` (${dados.convenio.trim()})` : ''}`
    : dados.atendimento === 'particular' ? 'Particular' : ''
  const ident: [string, string][] = [
    ['Nome', dados.nomeCompleto.trim()],
    ['Nascimento', idade === null ? '' : `${d}/${m}/${a} (${idade} ${idade === 1 ? 'ano' : 'anos'})`],
    ['Sexo', SEXO[dados.sexo]],
    ['WhatsApp', whatsapp ? formatarWhatsapp(whatsapp) : dados.whatsapp.trim()],
    ['E-mail', dados.email.trim()],
    ['Cidade', dados.cidade.trim() && `${dados.cidade.trim()}/${dados.uf}`],
  ]
  const trabalho: [string, string][] = [
    ['Profissão', dados.profissao.trim()],
    ['Trabalha ao ar livre, exposto ao sol ou a produtos químicos', SIM_NAO[dados.trabalhoExposto]],
    ['Atendimento', atendimento],
  ]
  const comValor = (l: [string, string][]) => l.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
  linhas.push('', '*1. Identificação*', ...comValor(ident))
  if (comValor(trabalho).length) linhas.push('', '*2. Trabalho e atendimento*', ...comValor(trabalho))

  let respondeu = false
  partes.forEach((parte, i) => {
    const itens = parte.perguntas
      .filter((q) => q.tipo !== 'foto' && perguntaVisivel(q, dados.sexo) && texto(respostas[q.id]))
      .map((q) => `${q.rotulo.replace(/:$/, '')}${q.rotulo.endsWith('?') ? '' : ':'} ${texto(respostas[q.id])}`)
    if (!itens.length) return
    respondeu = true
    linhas.push('', `*${i + 3}. ${parte.titulo}*`, ...itens)
  })
  if (!respondeu) linhas.push('', 'Pré-consulta: não respondida.')
  if (fotos > 0) linhas.push('', `Vou enviar ${fotos} ${fotos === 1 ? 'foto' : 'fotos'} em seguida, nesta conversa.`)
  return linhas.join('\n')
}
