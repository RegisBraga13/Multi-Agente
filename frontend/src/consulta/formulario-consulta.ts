// Dados do modo Formulário da anamnese (o formulário do paciente, conferido e completado pelo médico).
import { ALERGIAS, chaveDaLinha, NOTA_DOR, perguntaTrabalho, perguntaVisivel, type Parte, type Pergunta } from '../medico/pre-consulta'
import { calcularIdade, ESTADOS_CIVIS, type DadosPessoais } from '../medico/regras'
import type { Respostas } from '../servidor/agenda'
import { idadeEmTexto } from '../modulo/dia'

export type FormularioConsulta = {
  dados: Pick<DadosPessoais, 'nomeCompleto' | 'nomeSocial' | 'nascimento' | 'sexo' | 'cidade' | 'uf' | 'estadoCivil' | 'profissao' | 'trabalhoExposto'>
  respostas: Respostas
  /** perguntas de foto com foto recebida → endereço da imagem */
  fotos: Record<string, string>
}

export const FORMULARIO_VAZIO: FormularioConsulta = {
  dados: { nomeCompleto: '', nomeSocial: '', nascimento: '', sexo: '', cidade: '', uf: '', estadoCivil: '', profissao: '', trabalhoExposto: '' },
  respostas: {},
  fotos: {},
}

const respondida = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!v?.trim())

/** Perguntas do formulário que o paciente não respondeu (viram lembrete em Perguntas). Fotos ficam de fora. */
export function naoRespondidas(partes: Parte[], f: FormularioConsulta): Pergunta[] {
  return partes.flatMap((p) => p.perguntas).filter((q) => q.tipo !== 'foto' && q.tipo !== 'arquivos' && !q.semLembrete && perguntaVisivel(q, f.dados.sexo, f.respostas) && !respondida(f.respostas[q.id]))
}

/** O paciente fala de dor (gravado ou escrito)... */
const FALA_DE_DOR = /\b(dor|dores|d[oó]i|doem|doendo|dolorid[oa]s?)(?![\p{L}])/iu
/** ...e a nota já foi dita ("nota 7", "7 de 10", "8/10")? */
const NOTA_DITA = /\bnota\s*(de\s*)?(10|\d)\b|\b(10|\d)\s*(\/|de)\s*10\b/i

/** Texto do lembrete em Perguntas: curto quando a pergunta é longa ("Nota da dor (0 a 10)"). */
export const textoDoLembrete = (q: Pergunta) => q.lembrete ?? q.rotulo

/**
 * Lembretes em Perguntas: o que ficou em branco e, sempre, Alergias (mesmo respondida: o médico confirma).
 * `falado`: o que foi gravado ou escrito na anamnese (sem o texto do formulário). Se fala de dor e a nota não foi dita,
 * entra "Nota da dor (0 a 10)", em todos os módulos (autor, 24/11/2026).
 */
export function lembretesDoFormulario(partes: Parte[], f: FormularioConsulta, falado = ''): Pergunta[] {
  const brancas = naoRespondidas(partes, f)
  const lista = brancas.some((q) => q.id === ALERGIAS.id) ? brancas : [...brancas, ALERGIAS]
  const jaTem = lista.some((q) => q.id === NOTA_DOR.id) || respondida(f.respostas[NOTA_DOR.id])
  return !jaTem && FALA_DE_DOR.test(falado) && !NOTA_DITA.test(falado) ? [...lista, NOTA_DOR] : lista
}

/**
 * O que a história recebe do formulário ao salvar a anamnese: o formulário salvo (se foi salvo)
 * mais o que o médico respondeu nos lembretes de Perguntas. Em branco não entra (não perguntado ≠ negado).
 */
export function formularioParaHistoria(salvo: FormularioConsulta | null, dados: FormularioConsulta['dados'], lembretes: Respostas): FormularioConsulta | null {
  const respondidos = Object.fromEntries(Object.entries(lembretes).filter(([, v]) => respondida(v)))
  if (!salvo && !Object.keys(respondidos).length) return null
  const base = salvo ?? { ...FORMULARIO_VAZIO, dados }
  return { ...base, respostas: { ...base.respostas, ...respondidos } }
}

const resposta = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()

/** A resposta com o que foi escrito na linha da opção: "Outro" vira o próprio texto; as demais ganham o texto entre parênteses. */
function respostaComLinha(q: Pergunta, r: FormularioConsulta['respostas']): string {
  const linha = resposta(r[chaveDaLinha(q.id)])
  const v = r[q.id]
  if (!q.abreLinha || !linha) return resposta(v)
  const troca = (o: string) => (o !== q.abreLinha ? o : o === 'Outro' ? linha : `${o} (${linha})`)
  return resposta(Array.isArray(v) ? v.map(troca) : v === undefined ? v : troca(v))
}
const ponto = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`)

/**
 * O formulário conferido vira texto da anamnese, na ordem em que o paciente respondeu.
 * Pergunta com "?" é seguida da resposta; rótulo sem "?" leva dois-pontos. Em branco não entra (vira lembrete em Perguntas).
 */
export function textoDoFormulario(partes: Parte[], f: FormularioConsulta, hoje: Date): string {
  const d = f.dados
  const idade = calcularIdade(d.nascimento, hoje)
  const linhas: string[] = []
  // só o que ajuda o raciocínio clínico: a anamnese não leva nome, nome social nem cidade (regra 9.1)
  const ident = [
    idade !== null ? idadeEmTexto(d.nascimento, hoje) : '',
    d.sexo && `sexo ${d.sexo}`,
  ].filter(Boolean)
  if (ident.length) linhas.push(`Identificação: ${ident.join(', ')}.`)
  const trabalho = [
    ESTADOS_CIVIS.find((e) => e.valor === d.estadoCivil)?.rotulo ?? '',
    d.profissao.trim(),
    d.trabalhoExposto === 'sim' ? perguntaTrabalho(partes).sim : d.trabalhoExposto === 'nao' ? perguntaTrabalho(partes).nao : '',
  ].filter(Boolean)
  if (trabalho.length) linhas.push(`Estado civil e trabalho: ${trabalho.join(', ')}.`)
  for (const parte of partes) {
    const ditos = parte.perguntas
      .filter((q) => q.tipo !== 'foto' && q.tipo !== 'arquivos' && perguntaVisivel(q, d.sexo, f.respostas) && resposta(f.respostas[q.id]))
      // "Pergunta? resposta." · "Rótulo: resposta." (rótulo que já termina em ":" não ganha outro; sem rótulo, só a resposta)
      .map((q) => {
        const r = ponto(respostaComLinha(q, f.respostas))
        return q.semRotulo ? r : `${/[?:]$/.test(q.rotulo.trim()) ? q.rotulo.trim() : `${q.rotulo.trim()}:`} ${r}`
      })
    // título que já é pergunta ("Algo mais que seu médico deva saber?") não leva dois-pontos
    if (ditos.length) linhas.push(`${parte.titulo}${parte.titulo.endsWith('?') ? '' : ':'} ${ditos.join(' ')}`)
  }
  const docs = Object.keys(f.fotos).filter((k) => k.startsWith('documentos_')).length
  const fotos = Object.keys(f.fotos).length - docs
  const anexos = [fotos && `${fotos} ${fotos === 1 ? 'foto' : 'fotos'}`, docs && `${docs} ${docs === 1 ? 'documento' : 'documentos'}`].filter(Boolean)
  if (anexos.length) linhas.push(`Fotos e documentos: ${anexos.join(' e ')} (no Exame físico).`)
  return linhas.join('\n')
}

/** Põe o texto do formulário no começo da caixa da anamnese; se já tinha um (salvo antes), troca pelo novo. */
export function juntarFormularioAoTexto(texto: string, formulario: string, anterior: string | null): string {
  if (anterior && texto.startsWith(anterior)) return formulario + texto.slice(anterior.length)
  return texto.trim() ? `${formulario}\n\n${texto}` : `${formulario}\n\n`
}
