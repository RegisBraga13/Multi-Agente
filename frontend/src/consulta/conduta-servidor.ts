// Tradução da conduta entre o servidor e a tela. Funções puras, sem rede e sem React.
// A escolha, o texto e a atualização continuam em `conduta.ts`; aqui só se troca o formato da proposta.
import type { CondutaServidor, GrupoId, GrupoServidor, ItemReceitaServidor, PropostaCondutaServidor } from '../servidor/consulta'
import { itensReceita } from './anexos'
import { GRUPOS_CONDUTA, gruposConduta, sugerir, textoDoGrupo, type Conduta, type Grupo, type ItemReceita, type Opcao } from './conduta'

const ORDEM: GrupoId[] = ['cuidados', 'topico', 'sistemico', 'orientacoes']

const receitaDaTela = (i: ItemReceitaServidor): ItemReceita => ({
  nome: i.nome, forma: i.forma, concentracao: i.concentracao, quantidade: i.quantidade, via: i.via, posologia: i.posologia, duracao: i.duracao,
  ...(i.controlado ? { controlado: true } : {}),
})

function grupoDaTabela(g: GrupoServidor): Grupo {
  return {
    id: g.id, rotulo: g.rotulo, ...(g.fixo ? { fixo: g.fixo } : {}),
    linhas: g.linhas.map((l) => ({
      id: l.id, rotulo: l.rotulo, multipla: l.multipla, ...(l.prefixo ? { prefixo: l.prefixo } : {}),
      opcoes: l.opcoes.map((o): Opcao => ({ id: o.id, rotulo: o.rotulo, texto: o.texto, ...(o.dias !== null ? { dias: o.dias } : {}), receita: o.receita.map(receitaDaTela) })),
    })),
  }
}

/** Sem tabela: as opções da IA, em uma linha só por grupo; o sistêmico e as orientações (ex.: exames + retorno) são de
 *  múltipla escolha em todos os módulos (autor, 25/11/2026). */
function grupoDaIa(id: GrupoId, opcoes: { rotulo: string; texto: string; receita: ItemReceitaServidor[] }[], rotulos: string[]): Grupo {
  return {
    id, rotulo: rotulos[ORDEM.indexOf(id)],
    linhas: [{ id, rotulo: null, multipla: id === 'sistemico' || id === 'orientacoes', opcoes: opcoes.map((o, n): Opcao => ({ id: `${id}-${n}`, rotulo: o.rotulo, texto: o.texto, receita: o.receita.map(receitaDaTela) })) }],
  }
}

/** Sempre os 4 grupos, na ordem fixa: o grupo que a proposta não trouxe fica vazio (os textos e as seções seguem alinhados). */
function completar(grupos: Grupo[], rotulos: string[]): Grupo[] {
  return ORDEM.map((id, i) => grupos.find((g) => g.id === id) ?? { id, rotulo: rotulos[i], linhas: [{ id, rotulo: null, opcoes: [] }] })
}

/**
 * A proposta do servidor no modelo da tela. `nomeDoSinal`: o texto do sinal de alerta (o servidor devolve o id) para
 * mostrar a fonte da ordem das opções. Sem tabela e sem IA, as 4 seções abrem em branco para o médico escrever.
 */
export function condutaDoServidor(b: CondutaServidor, diagnostico: Conduta['diagnostico'], dia: string, nomeDoSinal: (id: string) => string, especialidade?: string): Conduta {
  const { tabela, ia } = b.proposta
  const rotulos = gruposConduta(especialidade)
  const vazio = GRUPOS_CONDUTA.map(() => false)
  const base = { dia, diagnostico, rotulos, escolha: {}, outros: {}, textos: GRUPOS_CONDUTA.map(() => ''), editado: vazio }
  const modelo = tabela ? tabela.grupos.map(grupoDaTabela) : ia && ia.grupos.length ? ia.grupos.map((g) => grupoDaIa(g.id, g.opcoes, rotulos)) : null
  if (!modelo) return { ...base, grupos: null, motivo: {}, revelado: GRUPOS_CONDUTA.map(() => true) }
  const { grupos } = sugerir({ grupos: completar(modelo, rotulos), regras: [] }, [])
  const motivo = Object.fromEntries(Object.entries(tabela?.motivosOrdem ?? {}).map(([linha, sinal]) => [linha, nomeDoSinal(sinal)]))
  const escolha = { kit: ['kit'] } // o kit de exames de rotina vem marcado
  return { ...base, grupos, motivo, escolha, textos: grupos.map((g) => textoDoGrupo(g, escolha, dia)), revelado: vazio }
}

/** `base`: o último bloco que o servidor devolveu (dele vêm a proposta e o diagnóstico que guiou a conduta). */
export function condutaParaServidor(c: Conduta, base: CondutaServidor): CondutaServidor {
  const { itens, livres } = itensReceita(c)
  return { proposta: base.proposta, diagnostico: base.diagnostico, escolha: c.escolha, textos: c.textos, receita: itens, livres }
}

/** A faixa vermelha: `null` em rotina; a emergência é a ação fixa dos sinais de urgência imediata. */
export function urgenciaDaConduta(p: PropostaCondutaServidor): { nivel: 'prioritaria' | 'imediata'; acoes: string[] } | null {
  if (p.urgencia === 'imediata') return { nivel: 'imediata', acoes: p.emergencia }
  if (p.urgencia === 'prioritaria') return { nivel: 'prioritaria', acoes: [] }
  return null
}

const comPonto = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

export function textoDaFaixa(u: { nivel: 'prioritaria' | 'imediata'; acoes: string[] }): string {
  if (u.nivel === 'prioritaria') return 'Prioridade: há sinal de alerta de prioridade nesta consulta.'
  return `Urgência imediata: ${u.acoes.map(comPonto).join(' ')}`
}

/** As opções que o servidor retirou da conduta por contraindicação (com o motivo). */
export const bloqueadasDaConduta = (p: PropostaCondutaServidor): { rotulo: string; motivo: string }[] =>
  (p.tabela?.bloqueadas ?? []).map((b) => ({ rotulo: b.rotulo, motivo: b.motivo }))

export const textoDaRetirada = (r: { rotulo: string; motivo: string }): string => `Não sugerido: ${r.rotulo} — ${comPonto(r.motivo)}`
