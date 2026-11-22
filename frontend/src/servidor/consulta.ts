// Conversa com o servidor da consulta (FastAPI). Formatos iguais aos contratos do servidor
// (backend/app/contratos/consulta_blocos.py), em camelCase.
import type { DadosEntrada, EntradaProntuario, PacienteComProntuario } from '../prontuario/registro'
import { BASE, chamar, ErroServidor } from './agenda'

export type SinalServidor = { id: string; texto: string; resposta: 'sim' | 'nao' }
export type AnamneseServidor = {
  queixa: string
  falas: { quem: 'Médico' | 'Paciente'; texto: string }[]
  sinais: SinalServidor[]
  emUso: string[]
  antecedentes: string[]
  alergias: { substancia: string; reacao: string }[]
  texto: string
  perguntas: { texto: string; resposta: 'sim' | 'nao'; detalhe: string | null }[]
  formulario: { respostas: Record<string, string | string[]>; fotos: string[] } | null
}
export type ExameServidor = {
  exame: { morfologia: string | null; localizacao: string | null; extensao: string | null; gravidade: string | null; achados: string | null }
  /** os exames complementares seguem só na tela até a etapa da história */
  complementares: never[]
  observacoes: string
}
export type EtapaServidor = 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta'
export type BlocoServidor = { etapa: EtapaServidor; estado: 'rascunho_ia' | 'revisado_medico' | 'oficializado'; desatualizado: boolean; conteudo: Record<string, unknown>; oficializadoEm: string | null }
export type ConsultaServidor = {
  id: string; pacienteId: string; tipo: 'consulta' | 'retorno'; modalidade: 'presencial' | 'online'
  especialidade: string; pedidoId: string | null; agendadaPara: string; finalizadaEm: string | null; blocos: BlocoServidor[]
}

const json = (corpo: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(corpo) })
const put = (corpo: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(corpo) })

/** Cria o paciente e a consulta do pedido da agenda (a mesma consulta se já aberta). */
export const abrirConsultaDoPedido = (pedidoId: string, especialidade: string) =>
  chamar<ConsultaServidor>(`/consultas/do-pedido/${pedidoId}`, json({ especialidade }))

export const buscarConsulta = (id: string) => chamar<ConsultaServidor>(`/consultas/${id}`)

export const salvarAnamnese = (id: string, corpo: AnamneseServidor) => chamar<ConsultaServidor>(`/consultas/${id}/anamnese`, put(corpo))

export const salvarExame = (id: string, corpo: ExameServidor) => chamar<ConsultaServidor>(`/consultas/${id}/exame`, put(corpo))

export const oficializarEtapa = (id: string, etapa: 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta') =>
  chamar<ConsultaServidor>(`/consultas/${id}/${etapa}/oficializar`, { method: 'POST' })

/** O catálogo de sinais de alerta da especialidade (a IA escolhe os que servem ao caso; o médico pode abrir todos). */
export type SinalDoCatalogo = { id: string; texto: string; tipo: SinalDisparadoServidor['tipo']; acao: string[]; prazo: string }
export const sinaisDaEspecialidade = (slug: string) => chamar<SinalDoCatalogo[]>(`/especialidades/${encodeURIComponent(slug)}/sinais`)

// ---------- História e perguntas contextuais ----------

export type SinalDisparadoServidor = {
  id: string; texto: string; tipo: 'urgencia_imediata' | 'prioridade' | 'muda_tratamento'
  acao: string[]; prazo: string; origem: 'respondido' | 'ia'; trecho: string | null
}
export type PerguntaServidor = { id: string; texto: string; seSim: string; seNao: string; sinalId: string | null; resposta: 'sim' | 'nao' | null }
export type HistoriaServidor = {
  historia: { qp: string; hda: string; ap: string; hp: string; hf: string; exameFisico: string; examesTexto: string }
  seguranca: { alergias: unknown[]; emUso: string[]; sinais: SinalDisparadoServidor[] }
  conflitos: unknown[]
  extrasIa: string[]
  perguntas: PerguntaServidor[]
}

/** Lê o texto do fluxo de eventos (`event: x` + `data: {json}`, separados por linha em branco); ignora o bloco incompleto do fim. */
export function lerEventos(texto: string): { evento: string; dados: unknown }[] {
  const saida: { evento: string; dados: unknown }[] = []
  for (const bloco of texto.split('\n\n')) {
    const evento = /^event: (.+)$/m.exec(bloco)?.[1]
    const dados = /^data: (.+)$/m.exec(bloco)?.[1]
    if (!evento || dados === undefined) continue
    try { saida.push({ evento, dados: JSON.parse(dados) }) } catch { /* bloco incompleto */ }
  }
  return saida
}

const SEM_CONEXAO = 'Não foi possível falar com o consultório. Confira a internet e tente de novo.'

export const urlDaGeracao = (id: string, etapa: 'historia' | 'diagnosticos' | 'conduta') => `${BASE}/consultas/${id}/${etapa}/gerar`

export type ResultadoEtapa<T> = { gravado: boolean; conteudo: T | null; avisos: string[]; mensagem: string }

/** Pede ao servidor uma etapa escrita pela IA e espera o evento final. Falha da IA ou da rede lança ErroServidor. */
export async function gerarEtapa<T>(id: string, etapa: 'historia' | 'diagnosticos' | 'conduta'): Promise<ResultadoEtapa<T>> {
  let r: Response
  try { r = await fetch(urlDaGeracao(id, etapa), { method: 'POST' }) } catch { throw new ErroServidor(0, SEM_CONEXAO) }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null) as { detail?: unknown } | null
    throw new ErroServidor(r.status, typeof corpo?.detail === 'string' ? corpo.detail : SEM_CONEXAO)
  }
  const eventos = lerEventos(await r.text())
  const pronto = eventos.find((e) => e.evento === 'pronto')
  if (!pronto) {
    const erro = eventos.find((e) => e.evento === 'erro')?.dados as { detail?: string } | undefined
    throw new ErroServidor(500, erro?.detail ?? SEM_CONEXAO)
  }
  return pronto.dados as ResultadoEtapa<T>
}

export const gerarHistoria = (id: string) => gerarEtapa<HistoriaServidor>(id, 'historia')

// ---------- Diagnósticos ----------

export type EvidenciaServidor = { lado: 'favor' | 'contra'; texto: string; secao: string; trecho: string }
export type HipoteseServidor = { nome: string; cid: string; certeza: 'suspeita' | 'hipotese' | 'clinico'; pct: number | null; evidencias: EvidenciaServidor[] }
export type ItemDDServidor = { hipotese: HipoteseServidor; decisao: 'pendente' | 'confirmada' | 'descartada'; propria: boolean }
export type DiagnosticosServidor = { itens: ItemDDServidor[]; naoPodePerder: unknown | null; rastrear: string[] }

export const gerarDiagnosticos = (id: string) => gerarEtapa<DiagnosticosServidor>(id, 'diagnosticos')

export const salvarDiagnosticos = (id: string, bloco: DiagnosticosServidor) => chamar<ConsultaServidor>(`/consultas/${id}/diagnosticos`, put(bloco))

export const salvarHistoria = (id: string, bloco: HistoriaServidor) => chamar<ConsultaServidor>(`/consultas/${id}/historia`, put(bloco))

/** Perguntas de segurança escritas para este paciente (não grava: a tela salva junto com a história). */
export const gerarPerguntas = (id: string) =>
  chamar<{ perguntas: PerguntaServidor[]; avisos: string[]; iaFalhou: boolean }>(`/consultas/${id}/perguntas/gerar`, { method: 'POST' })

// ---------- Conduta ----------

export type ItemReceitaServidor = {
  nome: string; forma: string; concentracao: string
  quantidade: { n: number; unidade: string; feminino: boolean }
  via: 'topico' | 'oral'; posologia: string; duracao: string; controlado?: boolean | null
}
export type OpcaoServidor = { id: string; rotulo: string; texto: string; dias: number | null; receita: ItemReceitaServidor[] }
export type LinhaServidor = { id: string; rotulo: string | null; opcoes: OpcaoServidor[]; prefixo: string | null; multipla: boolean }
export type GrupoId = 'cuidados' | 'topico' | 'sistemico' | 'orientacoes'
export type GrupoServidor = { id: GrupoId; rotulo: string; linhas: LinhaServidor[]; fixo: string | null }
export type OpcaoIAServidor = { rotulo: string; texto: string; receita: ItemReceitaServidor[] }
export type PropostaCondutaServidor = {
  urgencia: 'rotina' | 'prioritaria' | 'imediata'
  emergencia: string[]
  tabela: { chave: string; origem: string; grupos: GrupoServidor[]; bloqueadas: { opcao: string; rotulo: string; motivo: string }[]; motivosOrdem: Record<string, string> } | null
  ia: { grupos: { id: GrupoId; opcoes: OpcaoIAServidor[] }[] } | null
  origem: string
  avisos: string[]
  acao: string
  iaFalhou: boolean
}
export type CondutaServidor = {
  proposta: PropostaCondutaServidor
  diagnostico: { nome: string; cid: string; certeza: string }
  escolha: Record<string, string[]>
  textos: string[]
  receita: ItemReceitaServidor[]
  livres: string[]
}

export const gerarConduta = (id: string) => gerarEtapa<CondutaServidor>(id, 'conduta')

export const salvarConduta = (id: string, bloco: CondutaServidor) => chamar<ConsultaServidor>(`/consultas/${id}/conduta`, put(bloco))

// ---------- Documentos (anexos enviados) ----------

export type TipoDocumento = 'receita' | 'exames' | 'encaminhamento' | 'orientacoes' | 'atestado' | 'laudo'
export type DocumentoServidor = {
  tipo: TipoDocumento
  estado: 'rascunho' | 'revisado' | 'assinado' | 'enviado'
  texto: string
  registro: { tipo: 'atestado'; de: string | null; ate: string | null; resumo: string } | { tipo: 'laudo'; finalidade: string; resumo: string } | null
}

export const urlDoDocumento = (id: string, tipo: TipoDocumento) => `${BASE}/consultas/${id}/documentos/${tipo}`

/** Grava (ou troca) o documento do tipo: um por tipo em cada consulta. */
export const salvarDocumento = (id: string, doc: DocumentoServidor) => chamar<void>(`/consultas/${id}/documentos/${doc.tipo}`, put(doc))

export const listarDocumentos = (id: string) => chamar<DocumentoServidor[]>(`/consultas/${id}/documentos`)

// ---------- Prontuário ----------

export const urlDaFinalizacao = (id: string) => `${BASE}/consultas/${id}/finalizar`

/** O prontuário que o servidor monta com o que está salvo (história, diagnósticos, conduta e anexos enviados). */
export const prontuarioProposto = (id: string) => chamar<DadosEntrada>(`/consultas/${id}/prontuario`)

/** Finaliza a consulta: a entrada fica imutável (só adendo). `edicoes`: o que o médico mudou, chave → texto. */
export const finalizarConsulta = (id: string, edicoes: Record<string, string>) =>
  chamar<EntradaProntuario>(`/consultas/${id}/finalizar`, json({ edicoes }))

/** As entradas já finalizadas do paciente (a mais recente no topo). */
export const prontuarioDoPaciente = (pacienteId: string) => chamar<EntradaProntuario[]>(`/pacientes/${pacienteId}/prontuario`)

/** Adendo: o médico escreve depois da consulta finalizada; o servidor registra o texto com data e hora. */
export const adicionarAdendo = (consultaId: string, texto: string) => chamar<void>(`/consultas/${consultaId}/adendos`, json({ texto }))

/** Quem já terminou ao menos uma consulta (lista de prontuários). */
export const prontuariosDoMedico = () => chamar<PacienteComProntuario[]>('/prontuarios')

/** Nome e nascimento de um paciente do médico (a janela do prontuário de um paciente real). */
export const pacienteDoServidor = (id: string) => chamar<{ id: string; nome: string; nascimento: string }>(`/pacientes/${id}`)
