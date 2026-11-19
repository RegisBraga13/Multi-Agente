// Dados do modo Formulário da anamnese (o formulário do paciente, conferido e completado pelo médico).
import { ALERGIAS, perguntaVisivel, type Parte, type Pergunta } from '../medico/pre-consulta'
import { calcularIdade, ESTADOS_CIVIS, type DadosPessoais } from '../medico/regras'
import type { Respostas } from '../servidor/agenda'

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
  return partes.flatMap((p) => p.perguntas).filter((q) => q.tipo !== 'foto' && q.tipo !== 'arquivos' && perguntaVisivel(q, f.dados.sexo) && !respondida(f.respostas[q.id]))
}

const resposta = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : (v ?? '')).trim()
const ponto = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`)

/**
 * O formulário conferido vira texto da anamnese, na ordem em que o paciente respondeu.
 * Pergunta com "?" é seguida da resposta; rótulo sem "?" leva dois-pontos. Em branco não entra (vira lembrete em Perguntas).
 */
export function textoDoFormulario(partes: Parte[], f: FormularioConsulta, hoje: Date): string {
  const d = f.dados
  const idade = calcularIdade(d.nascimento, hoje)
  const linhas: string[] = []
  const ident = [
    d.nomeCompleto.trim() && `${d.nomeCompleto.trim()}${d.nomeSocial.trim() ? ` (nome social: ${d.nomeSocial.trim()})` : ''}`,
    idade !== null ? `${idade} ${idade === 1 ? 'ano' : 'anos'}` : '',
    d.sexo && `sexo ${d.sexo}`,
    d.cidade.trim() && `${d.cidade.trim()}${d.uf ? `/${d.uf}` : ''}`,
  ].filter(Boolean)
  if (ident.length) linhas.push(`Identificação: ${ident.join(', ')}.`)
  const alergias = resposta(f.respostas[ALERGIAS.id])
  if (alergias) linhas.push(`Alergias: ${ponto(alergias)}`)
  const trabalho = [
    ESTADOS_CIVIS.find((e) => e.valor === d.estadoCivil)?.rotulo ?? '',
    d.profissao.trim(),
    d.trabalhoExposto === 'sim' ? 'trabalha exposto ao sol ou a produtos químicos' : d.trabalhoExposto === 'nao' ? 'não trabalha exposto ao sol nem a produtos químicos' : '',
  ].filter(Boolean)
  if (trabalho.length) linhas.push(`Estado civil e trabalho: ${trabalho.join(', ')}.`)
  for (const parte of partes) {
    const ditos = parte.perguntas
      .filter((q) => q.tipo !== 'foto' && q.tipo !== 'arquivos' && perguntaVisivel(q, d.sexo) && resposta(f.respostas[q.id]))
      // "Pergunta? resposta." · "Rótulo: resposta." (rótulo que já termina em ":" não ganha outro)
      .map((q) => `${/[?:]$/.test(q.rotulo.trim()) ? q.rotulo.trim() : `${q.rotulo.trim()}:`} ${ponto(resposta(f.respostas[q.id]))}`)
    if (ditos.length) linhas.push(`${parte.titulo}: ${ditos.join(' ')}`)
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
