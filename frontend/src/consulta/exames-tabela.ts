// Retorno: os exames complementares realizados, numa tabela por data (uma coluna por data, uma linha por exame).
// Entram os resultados do prontuário (consultas anteriores) e os trazidos hoje. Sem resultado, sem tabela.
import type { ExameRegistro } from '../prontuario/registro'
import type { Complementar } from './exemplo'

export type TabelaExames = { datas: string[]; linhas: { nome: string; valores: (string | null)[] }[] }

/** 'DD/MM/AAAA' → 'AAAAMMDD' (para ordenar) */
const chaveDaData = (d: string) => d.split('/').reverse().join('')

export function tabelaDeExames(anteriores: ExameRegistro[], complementares: Complementar[]): TabelaExames | null {
  const resultados = [
    ...anteriores.map((e) => ({ nome: e.nome, valor: e.valor, data: e.data })),
    ...complementares.flatMap((c) => c.itens.map((i) => ({ nome: i.nome, valor: i.v.status === 'MISSING' ? null : i.v.valor, data: c.data }))),
  ].filter((r): r is { nome: string; valor: string; data: string } => r.valor !== null)
  if (!resultados.length) return null

  const datas = [...new Set(resultados.map((r) => r.data))].sort((a, b) => chaveDaData(a).localeCompare(chaveDaData(b)))
  const nomes = [...new Set(resultados.map((r) => r.nome))]
  return {
    datas,
    linhas: nomes.map((nome) => ({
      nome,
      valores: datas.map((data) => resultados.filter((r) => r.nome === nome && r.data === data).pop()?.valor ?? null),
    })),
  }
}
