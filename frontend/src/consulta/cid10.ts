// Busca no CID-10 (tabela do DATASUS em `src/dados/cid10.json`), igual para todas as especialidades.
// O médico digita parte do nome ("psoríase") ou do código ("L40", "l400") e vê o código; não envia nada a ninguém.
export type Cid = readonly [codigo: string, nome: string]

const semAcento = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Até `limite` resultados. Termo com menos de 2 letras não busca. Código: prefixo (ponto opcional), em ordem de código. Nome: todas as palavras, em qualquer ordem. */
export function buscarCid(lista: readonly Cid[], termo: string, limite = 30): Cid[] {
  const t = termo.trim()
  if (t.length < 2) return []
  if (/^[a-z]\d/i.test(t)) {
    const prefixo = t.toUpperCase().replace('.', '')
    return lista.filter(([c]) => c.replace('.', '').startsWith(prefixo)).sort((a, b) => a[0].localeCompare(b[0])).slice(0, limite)
  }
  const palavras = semAcento(t).split(/\s+/)
  return lista
    .map((c) => ({ c, nome: semAcento(c[1]) }))
    .filter(({ nome }) => palavras.every((p) => nome.includes(p)))
    .sort((a, b) => Number(!a.nome.startsWith(palavras[0])) - Number(!b.nome.startsWith(palavras[0])) || a.nome.length - b.nome.length || a.c[0].localeCompare(b.c[0]))
    .slice(0, limite)
    .map(({ c }) => c)
}

/** A tabela inteira (14 mil códigos), carregada só quando o painel é aberto. */
export async function carregarCid(): Promise<Cid[]> {
  return (await import('../dados/cid10.json')).default as unknown as Cid[]
}
