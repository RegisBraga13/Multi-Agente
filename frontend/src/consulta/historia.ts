// História clínica: montada SÓ com a anamnese e o exame físico salvos (Constituição, fase 2).
// Simulação da IA: organiza o que foi salvo em seções, como na landing.
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import type { Complementar } from './exemplo'

export type SecaoHistoria = { rotulo: string; texto: string }

export function montarHistoria(
  at: Atendimento,
  agora: Date,
  anamnese: string,
  exame: { rotulo: string; valor: string }[],
  complementares: Complementar[],
): SecaoHistoria[] {
  const f = at.ficha
  const pronta = f.situacao === 'pronta' ? f : null

  // história atual: as falas do paciente; anamnese escrita à mão (sem falas) entra inteira
  const linhas = anamnese.split('\n').map((l) => l.trim()).filter(Boolean)
  const falasPaciente = linhas.filter((l) => l.startsWith('Paciente:')).map((l) => l.slice('Paciente:'.length).trim())
  const temFalas = linhas.some((l) => /^(Médico|Paciente):/.test(l))
  const hda = (temFalas ? falasPaciente.join(' ') : linhas.join(' ')) || 'Não registrada.'

  const antecedentes = [
    pronta?.antecedentes.length ? `Antecedentes: ${pronta.antecedentes.join(', ')}.` : '',
    pronta?.emUso.length ? `Em uso: ${pronta.emUso.join(', ')}.` : '',
    ...(pronta?.alergias ?? []).map((a) => `Alergia: ${a.substancia.toLowerCase()} (${a.reacao}).`),
  ].filter(Boolean).join(' ') || 'Nada relatado.'

  const ef = exame.filter((x) => x.valor.trim()).map((x) => `${x.rotulo}: ${x.valor.trim()}`).join('. ')

  const exames = complementares.length
    ? complementares.map((c) => `${c.exame}, ${c.data}: ` + c.itens.map((i) =>
        i.v.status === 'MISSING' ? `${i.nome}: não encontrado no laudo` : `${i.nome}: ${i.v.valor}${i.v.status === 'INFERRED' ? ' (conferir no laudo)' : ''}`,
      ).join('; ') + '.').join(' ')
    : 'Nenhum exame trazido.'

  return [
    { rotulo: 'Identificação', texto: `${at.paciente.nome} · ${idade(at.paciente.nascimento, agora)} anos · ${at.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · ${at.modalidade === 'online' ? 'Online' : 'Presencial'}` },
    { rotulo: 'Queixa principal', texto: pronta?.queixa || 'Não registrada na ficha.' },
    { rotulo: 'História da doença atual', texto: hda },
    { rotulo: 'Antecedentes e alertas', texto: antecedentes },
    { rotulo: 'Exame físico', texto: ef ? `${ef}.` : 'Não registrado.' },
    { rotulo: 'Exames complementares', texto: exames },
  ]
}
