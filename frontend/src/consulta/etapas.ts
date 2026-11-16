// Regras das etapas da consulta: estados, liberação da IA e "desatualizado".
import type { Ficha } from '../modulo/tipos'
import type { Bloco, EstadoConsulta, EtapaId, RespostaAlerta, Situacao } from './tipos'

export const ETAPAS: { id: EtapaId; rotulo: string; curto: string }[] = [
  { id: 'anamnese-exame', rotulo: 'Anamnese', curto: 'Anamnese' },
  { id: 'historia', rotulo: 'História clínica', curto: 'História' },
  { id: 'diagnosticos', rotulo: 'Diagnósticos', curto: 'Diagnósticos' },
  { id: 'conduta', rotulo: 'Conduta e tratamento', curto: 'Conduta' },
]

export function ehEtapa(x: string | undefined): x is EtapaId {
  return ETAPAS.some((e) => e.id === x)
}

const BLOCOS: Bloco[] = ['anamnese', 'exame', 'historia', 'diagnosticos', 'conduta']

/** Posição no fluxo: anamnese e exame juntos alimentam a história. */
const NIVEL: Record<Bloco, number> = { anamnese: 0, exame: 0, historia: 1, diagnosticos: 2, conduta: 3 }

export function inicial(alertas: string[]): EstadoConsulta {
  const blocos = Object.fromEntries(BLOCOS.map((b) => [b, { estado: 'rascunho_ia', desatualizado: false }])) as EstadoConsulta['blocos']
  return { blocos, alertas: Object.fromEntries(alertas.map((id) => [id, null])), alcancadas: [] }
}

export function oficializar(e: EstadoConsulta, bloco: Bloco): EstadoConsulta {
  const novo = { ...e, blocos: { ...e.blocos, [bloco]: { estado: 'oficializado' as const, desatualizado: false } } }
  const liberadas = (['historia', 'diagnosticos', 'conduta'] as const).filter((b) => podeOficializar(novo, b) && !e.alcancadas.includes(b))
  return liberadas.length ? { ...novo, alcancadas: [...e.alcancadas, ...liberadas] } : novo
}

/** O médico mudou o bloco. Se ele estava oficializado, o que foi feito a partir dele fica desatualizado. */
export function editar(e: EstadoConsulta, bloco: Bloco): EstadoConsulta {
  const eraOficial = e.blocos[bloco].estado === 'oficializado'
  const blocos = { ...e.blocos, [bloco]: { estado: 'revisado_medico' as const, desatualizado: false } }
  if (eraOficial) {
    for (const b of BLOCOS) {
      if (NIVEL[b] > NIVEL[bloco] && blocos[b].estado === 'oficializado') blocos[b] = { ...blocos[b], desatualizado: true }
    }
  }
  return { ...e, blocos }
}

export function responderAlerta(e: EstadoConsulta, id: string, r: RespostaAlerta): EstadoConsulta {
  return { ...e, alertas: { ...e.alertas, [id]: r } }
}

export function pendenciasAnamnese(e: EstadoConsulta): number {
  return Object.values(e.alertas).filter((r) => r === null).length
}

const ORDEM = { rascunho_ia: 0, revisado_medico: 1, oficializado: 2 } as const

export function situacaoDaEtapa(e: EstadoConsulta, etapa: EtapaId): Situacao {
  const b = e.blocos
  const oficial = (x: Bloco) => b[x].estado === 'oficializado' && !b[x].desatualizado
  const de = (x: Bloco): Situacao => (b[x].desatualizado ? 'desatualizado' : b[x].estado)
  // anterior não salva: fase já alcançada fica desatualizada; nunca alcançada fica bloqueada
  const espera = (x: Bloco): Situacao => (e.alcancadas.includes(x) ? 'desatualizado' : 'bloqueado')
  switch (etapa) {
    case 'anamnese-exame':
      return ORDEM[b.anamnese.estado] <= ORDEM[b.exame.estado] ? b.anamnese.estado : b.exame.estado
    case 'historia':
      return b.historia.desatualizado ? 'desatualizado' : oficial('anamnese') && oficial('exame') ? de('historia') : espera('historia')
    case 'diagnosticos':
      return b.diagnosticos.desatualizado ? 'desatualizado' : oficial('historia') ? de('diagnosticos') : espera('diagnosticos')
    case 'conduta':
      return b.conduta.desatualizado ? 'desatualizado' : oficial('diagnosticos') ? de('conduta') : espera('conduta')
  }
}

/** O bloco anterior no fluxo está oficializado e em dia? (anamnese e exame não dependem de nada) */
export function podeOficializar(e: EstadoConsulta, bloco: Bloco): boolean {
  const ok = (x: Bloco) => e.blocos[x].estado === 'oficializado' && !e.blocos[x].desatualizado
  switch (bloco) {
    case 'anamnese':
    case 'exame':
      return true
    case 'historia':
      return ok('anamnese') && ok('exame')
    case 'diagnosticos':
      return ok('historia')
    case 'conduta':
      return ok('diagnosticos')
  }
}

/** Gravar só com consentimento registrado na ficha da pré-consulta. */
export function podeGravar(ficha: Ficha): boolean {
  return ficha.situacao === 'pronta' && ficha.transcricao === 'aceita'
}

const NOME_SITUACAO: Record<Situacao, string> = {
  rascunho_ia: 'Rascunho da IA',
  revisado_medico: 'Revisado',
  oficializado: 'Salvo',
  desatualizado: 'Desatualizado',
  bloqueado: 'Aguardando etapa anterior',
}

/** `curto`: versão para o navegador das etapas. */
export function nomeSituacao(s: Situacao, curto = false): string {
  if (curto) return s === 'bloqueado' ? 'Aguardando' : s === 'rascunho_ia' ? 'Rascunho' : NOME_SITUACAO[s]
  return NOME_SITUACAO[s]
}
