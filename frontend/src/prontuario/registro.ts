// O Prontuário do paciente: o registro "mãe". Tudo na consulta existe para produzi-lo; terminada a consulta,
// as páginas somem e só fica o registro. Por isso ele é gravado como DADOS ORGANIZADOS (diagnósticos com
// probabilidade, remédios, exames com valor e data, fotos, documentos): o retorno e os gráficos leem daqui.
// O texto que aparece na tela é montado a partir desses dados (consulta/prontuario.ts → secoesDosDados).
// Uma entrada por consulta/retorno ("Consulta 1", "Consulta 1 — Retorno", "Consulta 1 — Retorno 2", "Consulta 2"…),
// a mais recente no topo. Entrada salva nunca muda; depois do fim só recebe adendo.
// SIMULAÇÃO (sem servidor ainda): as entradas ficam no navegador (localStorage), chaveadas pelo id do paciente.
import type { ItemReceita } from '../consulta/conduta'
import { dataLocal } from '../medico/exemplo'
import { buscarPaciente } from '../modulo/exemplo'
import type { Modalidade } from '../medico/tipos'
import type { TipoAtendimento } from '../modulo/tipos'

/**
 * Sempre 3 diagnósticos: os que o médico assinalou ("assinalado"; com mais de 3, os de maior probabilidade) e,
 * para completar 3, os mais bem posicionados pela IA ("sugerido"). Descartado pelo médico não entra.
 */
export type DiagnosticoRegistro = { nome: string; cid: string; pct: number | null; situacao: 'assinalado' | 'sugerido' }
/** Resultado de exame, um por item (base do comparativo no retorno). `valor` null = não encontrado no laudo. */
export type ExameRegistro = { exame: string; nome: string; valor: string | null; status: 'PRESENT' | 'INFERRED' | 'MISSING'; data: string; origem: string }
export type FotoRegistro = { n: number; src: string | null }
/** Atestado e laudo emitidos: no prontuário só o resumo ("de 13/11 a 15/11/2026", "para o INSS"), não o documento. */
export type DocumentoRegistro =
  | { tipo: 'atestado'; de: string | null; ate: string | null; resumo: string }
  | { tipo: 'laudo'; finalidade: string; resumo: string }

/**
 * Os dados da entrada. Narrativas (QP, HDA, AP, HP, HF, exame físico, exames, orientações) são texto, já com a
 * edição do médico; '' = não colhido (não aparece). O resto é estruturado.
 */
export type DadosEntrada = {
  /** extensão das lesões em % do corpo (do campo Extensão do exame físico); null = sem número. Entradas antigas não têm */
  extensaoPct?: number | null
  /** retorno: a evolução de hoje (texto da História da evolução); vazio na primeira consulta */
  evolucao?: string
  qp: string; hda: string; ap: string; hp: string; hf: string
  exameFisico: string
  /** os exames como ficaram escritos na história (o que o médico aprovou) */
  examesTexto: string
  exames: ExameRegistro[]
  diagnosticos: DiagnosticoRegistro[]
  /** a receita enviada: os itens (estruturados, da conduta), os itens livres ("Outro") e o texto como foi enviado */
  receita: { itens: ItemReceita[]; livres: string[]; texto: string } | null
  /** sem receita: o tratamento como ficou escrito na conduta */
  condutaTexto: string
  solicitado: string[]
  encaminhado: string[]
  orientacoes: string
  retorno: string
  documentos: DocumentoRegistro[]
  fotos: FotoRegistro[]
}

export type Adendo = { quando: string; texto: string }
/** `data` 'YYYY-MM-DD', `hora` 'HH:MM'. `edicoes`: o texto que o médico reescreveu numa linha estruturada (HD, receita…). */
export type EntradaProntuario = {
  id: string
  pacienteId: string
  titulo: string
  tipo: TipoAtendimento
  modalidade: Modalidade
  data: string
  hora: string
  dados: DadosEntrada
  edicoes: Record<string, string>
  adendos: Adendo[]
}
export type NovaEntrada = Omit<EntradaProntuario, 'id' | 'pacienteId' | 'titulo' | 'adendos'>

const CHAVE = (id: string) => `especialista:prontuario:${id}`

function salvas(pacienteId: string): EntradaProntuario[] {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE(pacienteId)) ?? '[]')
    return Array.isArray(x) ? x.filter(valida) : []
  } catch { return [] }
}

const texto = (x: unknown) => typeof x === 'string'
const textos = (x: unknown) => Array.isArray(x) && x.every(texto)

/** Entrada lida do navegador: só entra se tiver a forma esperada (nada inventado para completar). */
function valida(x: unknown): x is EntradaProntuario {
  const e = x as EntradaProntuario
  if (!e || !texto(e.id) || !texto(e.pacienteId) || !texto(e.titulo) || !['consulta', 'retorno'].includes(e.tipo)) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data) || !/^\d{2}:\d{2}$/.test(e.hora) || !['presencial', 'online'].includes(e.modalidade)) return false
  const d = e.dados
  return !!d && ['qp', 'hda', 'ap', 'hp', 'hf', 'exameFisico', 'examesTexto', 'condutaTexto', 'orientacoes', 'retorno'].every((k) => texto(d[k as keyof DadosEntrada]))
    && textos(d.solicitado) && textos(d.encaminhado) && Array.isArray(d.exames) && Array.isArray(d.fotos) && Array.isArray(d.documentos)
    && Array.isArray(d.diagnosticos) && d.diagnosticos.length <= 3 && d.diagnosticos.every((x) => texto(x.nome) && texto(x.cid) && ['assinalado', 'sugerido'].includes(x.situacao))
    && (d.receita === null || (typeof d.receita === 'object' && texto(d.receita.texto) && Array.isArray(d.receita.itens)))
    && !!e.edicoes && typeof e.edicoes === 'object' && Array.isArray(e.adendos)
}

const ordem = (a: { data: string; hora: string }) => `${a.data} ${a.hora}`

/** Todas as entradas do paciente (exemplo + salvas), a mais recente no topo. */
export function entradas(pacienteId: string): EntradaProntuario[] {
  return [...(exemplos()[pacienteId] ?? []), ...salvas(pacienteId)].sort((a, b) => ordem(b).localeCompare(ordem(a)))
}

/**
 * Título da nova entrada: consulta → "Consulta N+1"; retorno → "Consulta N — Retorno" (1º retorno dessa consulta),
 * "Consulta N — Retorno 2", "— Retorno 3"… (N = última consulta). `antes`: as entradas anteriores a esta.
 */
export function tituloNovaEntrada(antes: Pick<EntradaProntuario, 'tipo' | 'data' | 'hora'>[], tipo: TipoAtendimento): string {
  const cronologica = [...antes].sort((a, b) => ordem(a).localeCompare(ordem(b)))
  const n = cronologica.filter((e) => e.tipo === 'consulta').length
  if (tipo === 'consulta') return `Consulta ${n + 1}`
  const ultima = cronologica.map((e) => e.tipo).lastIndexOf('consulta')
  const retornos = cronologica.slice(ultima + 1).filter((e) => e.tipo === 'retorno').length
  return `Consulta ${Math.max(n, 1)} — Retorno${retornos ? ` ${retornos + 1}` : ''}`
}

/** As entradas anteriores a esta consulta (a do mesmo dia e hora não conta: é ela mesma). */
const anteriores = (pacienteId: string, data: string, hora: string) => entradas(pacienteId).filter((x) => ordem(x) < `${data} ${hora}`)

/** Título que a entrada desta consulta vai ter (para mostrar na página do prontuário antes de salvar). */
export const tituloDaConsulta = (pacienteId: string, tipo: TipoAtendimento, data: string, hora: string) => tituloNovaEntrada(anteriores(pacienteId, data, hora), tipo)

/** Guarda a entrada da consulta (substitui a do mesmo dia e hora, mantendo o id: salvar de novo não duplica). */
export function salvarEntrada(pacienteId: string, e: NovaEntrada, quem?: Cadastro): EntradaProntuario | null {
  const todas = salvas(pacienteId)
  const mesma = todas.find((x) => x.data === e.data && x.hora === e.hora)
  const nova: EntradaProntuario = {
    ...e, id: mesma?.id ?? novoId(), pacienteId, titulo: tituloNovaEntrada(anteriores(pacienteId, e.data, e.hora), e.tipo), adendos: mesma?.adendos ?? [],
  }
  try {
    localStorage.setItem(CHAVE(pacienteId), JSON.stringify([...todas.filter((x) => x !== mesma), nova]))
    // quem é o paciente (pacientes que não são de exemplo não estão em nenhum cadastro local)
    if (quem) localStorage.setItem(CHAVE_QUEM(pacienteId), JSON.stringify(quem))
    return nova
  } catch { return null }
}

type Cadastro = { id: string; nome: string; nascimento: string }
const CHAVE_QUEM = (id: string) => `especialista:prontuario-paciente:${id}`

/** Nome e nascimento do paciente: o cadastro de exemplo ou o que ficou guardado ao salvar o prontuário. */
export function cadastroDoPaciente(id: string): Cadastro | undefined {
  const exemplo = buscarPaciente(id)
  if (exemplo) return exemplo
  try {
    const q = JSON.parse(localStorage.getItem(CHAVE_QUEM(id)) ?? 'null') as Cadastro | null
    return q && texto(q.nome) && texto(q.nascimento) ? { id, nome: q.nome, nascimento: q.nascimento } : undefined
  } catch { return undefined }
}

export type PacienteComProntuario = Cadastro & { entradas: number; /** data da entrada mais recente, 'YYYY-MM-DD' */ ultima: string }

/**
 * Quem tem prontuário: todo paciente que terminou ao menos uma consulta ou um retorno (tem entrada salva).
 * Mais recente primeiro. O médico acessa a qualquer hora, sem depender da agenda.
 */
export function pacientesComProntuario(): PacienteComProntuario[] {
  const ids = new Set(Object.keys(exemplos()))
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? ''
      const prefixo = 'especialista:prontuario:'
      if (k.startsWith(prefixo)) ids.add(k.slice(prefixo.length))
    }
  } catch { /* sem armazenamento: só os de exemplo */ }
  return [...ids].flatMap((id): PacienteComProntuario[] => {
    const cadastro = cadastroDoPaciente(id)
    const todas = entradas(id)
    return cadastro && todas.length ? [{ ...cadastro, entradas: todas.length, ultima: todas[0].data }] : []
  }).sort((a, b) => b.ultima.localeCompare(a.ultima) || a.nome.localeCompare(b.nome))
}

const novoId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Endereço da janela do prontuário (pelo id do paciente). */
export const enderecoProntuario = (slug: string, pacienteId: string) => `/modulo/${slug}/prontuario/${pacienteId}`

/** Abre (ou traz para a frente) a janela do prontuário do paciente, separada da consulta. */
export function abrirJanelaProntuario(slug: string, pacienteId: string): Window | null {
  return window.open(enderecoProntuario(slug, pacienteId), `prontuario-${pacienteId}`, 'popup,width=820,height=900')
}

// Exemplo: João Pedro Lima já teve a Consulta 1 (psoríase); no dia 13/11 ele vem para o retorno das 08:30.
export const JOAO_ID = '8715f152-846a-467d-a995-91ea384312b6'
// Exemplo: Antônio Barbosa (8h) foi atendido hoje e o prontuário da Consulta 1 está pronto para ler.
export const ANTONIO_ID = 'd17f3be7-5155-4d72-b178-05776e2a3bc0'
const exemplos = (): Record<string, EntradaProntuario[]> => ({ ...EXEMPLOS, [ANTONIO_ID]: [consultaDoAntonio(dataLocal(new Date()))] })

const EXEMPLOS: Record<string, EntradaProntuario[]> = {
  [JOAO_ID]: [{
    id: '0b7c2f0e-3f4d-4f43-9a51-1d7e3b0c9a10', pacienteId: JOAO_ID,
    titulo: 'Consulta 1', tipo: 'consulta', modalidade: 'presencial', data: '2026-09-18', hora: '09:00',
    dados: {
      extensaoPct: 4,
      qp: 'Placas vermelhas com descamação nos cotovelos e joelhos.',
      hda: 'Paciente, 52 anos, casado, comerciante, refere placas avermelhadas e descamativas nos cotovelos e joelhos há 2 anos, com piora no último inverno. Prurido leve. Nega dor articular.',
      ap: 'Hipertensão arterial. Em uso de losartana 50 mg 1x/dia. Alergia a dipirona (inchaço no rosto).',
      hp: '', hf: '',
      exameFisico: 'Placas eritematodescamativas bem delimitadas em cotovelos e joelhos; couro cabeludo e unhas sem alterações. BSA estimada em 4%.',
      examesTexto: '',
      exames: [
        { exame: 'Exames laboratoriais', nome: 'Glicemia de jejum', valor: '98 mg/dL', status: 'PRESENT', data: '10/09/2026', origem: 'laudo-rotina.pdf' },
        { exame: 'Exames laboratoriais', nome: 'TGO', valor: '24 U/L', status: 'PRESENT', data: '10/09/2026', origem: 'laudo-rotina.pdf' },
        { exame: 'Exames laboratoriais', nome: 'TGP', valor: '30 U/L', status: 'PRESENT', data: '10/09/2026', origem: 'laudo-rotina.pdf' },
      ],
      diagnosticos: [{ nome: 'Psoríase vulgar', cid: 'L40.0', pct: 85, situacao: 'assinalado' }, { nome: 'Dermatite seborreica', cid: 'L21', pct: 10, situacao: 'sugerido' }, { nome: 'Eczema numular', cid: 'L30.0', pct: 5, situacao: 'sugerido' }],
      receita: {
        itens: [
          { nome: 'Propionato de clobetasol', forma: 'CREM', concentracao: '0,05%', quantidade: { n: 1, unidade: 'bisn. 30g', feminino: true }, via: 'topico', posologia: 'Aplicar fina camada nas placas 1 vez ao dia, à noite.', duracao: '4sem' },
          { nome: 'Hidratante corporal com ureia', forma: 'CREM', concentracao: '10%', quantidade: { n: 1, unidade: 'fr.', feminino: false }, via: 'topico', posologia: 'Aplicar no corpo 2 vezes ao dia (manhã e noite).', duracao: 'uso contínuo' },
        ],
        livres: [],
        texto: 'USO TÓPICO (EXTERNO)\n1. Propionato de clobetasol 0,05% CREM (01 bisn. 30g)\n   Aplicar fina camada nas placas 1 vez ao dia, à noite — 4sem\n2. Hidratante corporal com ureia 10% CREM (01 fr.)\n   Aplicar no corpo 2 vezes ao dia (manhã e noite) — uso contínuo',
      },
      condutaTexto: '',
      solicitado: ['exames de rotina'], encaminhado: [],
      orientacoes: 'Evitar banhos quentes e prolongados. Não usar o corticoide no rosto.',
      retorno: 'em 8 semanas, em 13/11/2026.',
      documentos: [],
      fotos: [{ n: 1, src: null }, { n: 2, src: null }],
    },
    edicoes: {}, adendos: [],
  }],
}

function consultaDoAntonio(data: string): EntradaProntuario {
  return {
    id: '5d1f6b7a-2c0e-4a3b-9e84-0a5c7d9e1b22', pacienteId: ANTONIO_ID,
    titulo: 'Consulta 1', tipo: 'consulta', modalidade: 'presencial', data, hora: '08:00',
    dados: {
      qp: 'Ferida no nariz que não cicatriza há 3 meses.',
      hda: 'Paciente, 73 anos, refere ferida na asa nasal esquerda há 3 meses, que sangra ao toque e não cicatriza. Sem dor. Trabalhou muitos anos exposto ao sol.',
      ap: 'Hipertensão arterial e infarto do miocárdio em 2019. Em uso de AAS 100 mg e atenolol 25 mg. Alergia a sulfa (falta de ar).',
      hp: '', hf: '',
      exameFisico: 'Pápula perolada com ulceração central e telangiectasias na asa nasal esquerda, lesão única de cerca de 6 mm. Pele com dano solar crônico.',
      examesTexto: '', exames: [],
      diagnosticos: [{ nome: 'Carcinoma basocelular', cid: 'C44.3', pct: 80, situacao: 'assinalado' }, { nome: 'Ceratose actínica', cid: 'L57.0', pct: 12, situacao: 'sugerido' }, { nome: 'Carcinoma espinocelular', cid: 'C44.3', pct: 8, situacao: 'sugerido' }],
      receita: null,
      condutaTexto: 'Biópsia da lesão para confirmar o diagnóstico e planejar a retirada.',
      solicitado: ['biópsia da lesão (anatomopatológico)'], encaminhado: [],
      orientacoes: 'Proteger a lesão do sol. Procurar atendimento se sangrar muito ou crescer rápido.',
      retorno: 'em 2 semanas, com o resultado da biópsia.',
      documentos: [],
      fotos: [{ n: 1, src: null }, { n: 2, src: null }],
    },
    edicoes: {}, adendos: [],
  }
}
