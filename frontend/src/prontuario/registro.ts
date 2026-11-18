// O Prontuário do paciente: uma entrada por consulta/retorno salvo ("Consulta 1", "Consulta 1 — Retorno",
// "Consulta 2"…), cada uma com data e hora; a mais recente no topo. Só leitura fora do fim da consulta.
// SIMULAÇÃO (sem servidor ainda): as entradas salvas ficam no navegador (localStorage), para a janela do
// prontuário (outra janela do navegador) enxergá-las. Com o servidor, isto passa para o banco de dados.
import type { TipoAtendimento } from '../modulo/tipos'

export type LinhaEntrada = { rotulo: string; texto: string }
export type SecaoEntrada = { titulo: string; linhas: LinhaEntrada[] }
/** `data` 'YYYY-MM-DD', `hora` 'HH:MM' */
export type EntradaProntuario = { titulo: string; tipo: TipoAtendimento; data: string; hora: string; secoes: SecaoEntrada[] }

/** Paciente → chave estável (ainda não há id de paciente): nascimento + nome sem acentos. */
export function chavePaciente(p: { nome: string; nascimento: string }): string {
  const nome = p.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${p.nascimento}-${nome}`
}

const CHAVE = (k: string) => `especialista:prontuario:${k}`

function salvas(k: string): EntradaProntuario[] {
  try {
    const x = JSON.parse(localStorage.getItem(CHAVE(k)) ?? '[]')
    return Array.isArray(x) ? x.filter(valida) : []
  } catch { return [] }
}

/** Entrada lida do navegador: só entra se tiver a forma esperada (nada inventado para completar). */
function valida(x: unknown): x is EntradaProntuario {
  const e = x as EntradaProntuario
  return !!e && typeof e.titulo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.data) && /^\d{2}:\d{2}$/.test(e.hora)
    && Array.isArray(e.secoes) && e.secoes.every((s) => typeof s.titulo === 'string' && Array.isArray(s.linhas) && s.linhas.every((l) => typeof l.rotulo === 'string' && typeof l.texto === 'string'))
}

/** Todas as entradas do paciente (exemplo + salvas), a mais recente no topo. */
export function entradas(k: string): EntradaProntuario[] {
  return [...(EXEMPLOS[k] ?? []), ...salvas(k)].sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`))
}

/** Título da nova entrada: consulta → "Consulta N+1"; retorno → "Consulta N — Retorno" (N = última consulta). */
export function tituloNovaEntrada(antes: EntradaProntuario[], tipo: TipoAtendimento): string {
  const n = antes.filter((e) => e.tipo === 'consulta').length
  return tipo === 'consulta' ? `Consulta ${n + 1}` : `Consulta ${Math.max(n, 1)} — Retorno`
}

/** Guarda a entrada da consulta (substitui a do mesmo dia e hora: salvar de novo não duplica). */
export function salvarEntrada(k: string, e: Omit<EntradaProntuario, 'titulo'>): EntradaProntuario | null {
  const outras = salvas(k).filter((x) => !(x.data === e.data && x.hora === e.hora))
  const antes = [...(EXEMPLOS[k] ?? []), ...outras].filter((x) => `${x.data} ${x.hora}` < `${e.data} ${e.hora}`)
  const nova = { ...e, titulo: tituloNovaEntrada(antes, e.tipo) }
  try {
    localStorage.setItem(CHAVE(k), JSON.stringify([...outras, nova]))
    return nova
  } catch { return null }
}

/** Endereço da janela do prontuário. */
export const enderecoProntuario = (slug: string, p: { nome: string; nascimento: string }) =>
  `/modulo/${slug}/prontuario/${chavePaciente(p)}?nome=${encodeURIComponent(p.nome)}`

/** Abre (ou traz para a frente) a janela do prontuário do paciente, separada da consulta. */
export function abrirJanelaProntuario(slug: string, p: { nome: string; nascimento: string }): Window | null {
  return window.open(enderecoProntuario(slug, p), `prontuario-${chavePaciente(p)}`, 'popup,width=820,height=900')
}

// Exemplo: João Pedro Lima já teve a Consulta 1 (psoríase); no dia 13/11 ele vem para o retorno das 08:30.
const EXEMPLOS: Record<string, EntradaProntuario[]> = {
  '1974-08-02-joao-pedro-lima': [{
    titulo: 'Consulta 1', tipo: 'consulta', data: '2026-09-18', hora: '09:00',
    secoes: [
      { titulo: '', linhas: [
        { rotulo: 'QP', texto: 'Placas vermelhas com descamação nos cotovelos e joelhos.' },
        { rotulo: 'HDA', texto: 'Paciente de 52 anos refere placas avermelhadas e descamativas nos cotovelos e joelhos há 2 anos, com piora no último inverno. Prurido leve. Nega dor articular.' },
        { rotulo: 'AP', texto: 'Hipertensão arterial. Em uso de losartana 50 mg 1x/dia. Alergia a dipirona (inchaço no rosto).' },
      ] },
      { titulo: '', linhas: [
        { rotulo: 'Ex. físico', texto: 'Placas eritematodescamativas bem delimitadas em cotovelos e joelhos; couro cabeludo e unhas sem alterações. BSA estimada em 4%.' },
      ] },
      { titulo: '', linhas: [
        { rotulo: 'HD', texto: 'Psoríase vulgar (CID-10 L40.0)' },
      ] },
      { titulo: 'Conduta', linhas: [
        { rotulo: '', texto: 'USO TÓPICO (EXTERNO)\n1. Propionato de clobetasol 0,05% CREM (01 bisn. 30g)\n   Aplicar fina camada nas placas 1 vez ao dia, à noite — 4sem\n2. Hidratante corporal com ureia 10% CREM (01 fr.)\n   Aplicar no corpo 2 vezes ao dia (manhã e noite) — uso contínuo' },
        { rotulo: 'Solicitado', texto: 'exames de rotina.' },
        { rotulo: 'Orientações gerais', texto: 'Evitar banhos quentes e prolongados. Não usar o corticoide no rosto.' },
        { rotulo: 'Retorno', texto: 'em 8 semanas, em 13/11/2026.' },
      ] },
    ],
  }],
}
