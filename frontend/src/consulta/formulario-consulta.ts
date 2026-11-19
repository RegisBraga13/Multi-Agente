// Dados do modo Formulário da anamnese (o formulário do paciente, conferido e completado pelo médico).
import { perguntaVisivel, type Parte, type Pergunta } from '../medico/pre-consulta'
import type { DadosPessoais } from '../medico/regras'
import type { Respostas } from '../servidor/agenda'

export type FormularioConsulta = {
  dados: Pick<DadosPessoais, 'nomeCompleto' | 'nascimento' | 'sexo' | 'cidade' | 'uf' | 'estadoCivil' | 'profissao' | 'trabalhoExposto'>
  respostas: Respostas
  /** perguntas de foto com foto recebida → endereço da imagem */
  fotos: Record<string, string>
}

export const FORMULARIO_VAZIO: FormularioConsulta = {
  dados: { nomeCompleto: '', nascimento: '', sexo: '', cidade: '', uf: '', estadoCivil: '', profissao: '', trabalhoExposto: '' },
  respostas: {},
  fotos: {},
}

const respondida = (v: string | string[] | undefined) => (Array.isArray(v) ? v.length > 0 : !!v?.trim())

/** Perguntas do formulário que o paciente não respondeu (viram lembrete em Perguntas). Fotos ficam de fora. */
export function naoRespondidas(partes: Parte[], f: FormularioConsulta): Pergunta[] {
  return partes.flatMap((p) => p.perguntas).filter((q) => q.tipo !== 'foto' && perguntaVisivel(q, f.dados.sexo) && !respondida(f.respostas[q.id]))
}
