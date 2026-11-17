// Tipos da consulta (Módulo A). Seguem a Constituição (docs/constituicao.md): cada etapa é
// rascunho_ia → revisado_medico → oficializado, e só o oficializado alimenta a etapa seguinte.
// Formato pensado para as tabelas da Fase 3/4 (encounters, transcripts, clinical_facts, ...).

/** As 5 páginas da consulta, na ordem do fluxo (a última: receita e anexos, o fim da consulta). */
export type EtapaId = 'anamnese-exame' | 'historia' | 'diagnosticos' | 'conduta' | 'anexos'

/** O que é oficializado separadamente (a página 1 tem dois blocos: duas fases da Constituição). */
export type Bloco = 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta' | 'anexos'

export type Estado = 'rascunho_ia' | 'revisado_medico' | 'oficializado'

/** Como a etapa aparece no navegador. `bloqueado` = a IA aguarda a etapa anterior oficializada. */
export type Situacao = Estado | 'desatualizado' | 'bloqueado'

export type Proveniencia = 'relatado' | 'observado' | 'inferido_ia' | 'confirmado'

/** Valor extraído de um documento. MISSING nunca tem valor inventado. */
export type Extraido<T> =
  | { status: 'PRESENT'; valor: T; origem: string }
  | { status: 'INFERRED'; valor: T; origem: string; aviso: string }
  | { status: 'MISSING'; valor: null }

/** o médico pergunta e marca: V = sim (entra na história clínica), F = não */
export type RespostaAlerta = 'v' | 'f'

export type EstadoConsulta = {
  blocos: Record<Bloco, { estado: Estado; desatualizado: boolean }>
  /** id do sinal de alerta → resposta do médico (null = ainda sem resposta) */
  alertas: Record<string, RespostaAlerta | null>
  /** etapas já liberadas alguma vez: não somem se a anterior for editada (ficam desatualizadas) */
  alcancadas: Bloco[]
}
