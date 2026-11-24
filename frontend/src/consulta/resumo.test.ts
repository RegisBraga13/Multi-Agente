import { describe, expect, it } from 'vitest'
import type { SecaoHistoria } from './historia'
import { atualizarResumo, marcarResumo, montarResumo, secaoDeAlergias } from './resumo'

const historia = (ant: string, hda = ''): SecaoHistoria[] => [
  { rotulo: 'Identificação', texto: 'Fulana, 34 anos · Consulta · Presencial' },
  { rotulo: 'Queixa principal', texto: 'Espinhas.' },
  { rotulo: 'História da doença atual', texto: hda },
  { rotulo: 'Antecedentes e alertas', texto: ant },
  { rotulo: 'Exame físico', texto: 'Pápulas.' },
]
const resumo = (ant: string, hda = '') => montarResumo(historia(ant, hda)).map((x) => [x.texto, x.marca])

describe('montarResumo (só a partir da história salva)', () => {
  it('Mariana: nega comorbidades e alergias (F), anticoncepcional (V), alerta e respostas às perguntas', () => {
    expect(resumo(
      'Nega comorbidades. Em uso de anticoncepcional oral. Nega alergias. Alerta: nódulos dolorosos ou cicatrizes (acne grave).',
      'Paciente de 34 anos refere espinhas. Sem tratamento prévio. Nega febre. Relata planejar gravidez nos próximos meses. Nega uso prévio de antibiótico ou isotretinoína.',
    )).toEqual([
      ['Alergias', 'f'],
      ['Nódulos dolorosos ou cicatrizes (acne grave)', 'v'],
      ['Planeja gravidez', 'v'],
      ['Comorbidades', 'f'],
      ['Anticoncepcional oral', 'v'],
      ['Tratamento prévio', 'f'],
      ['Antibiótico ou isotretinoína prévios', 'f'],
    ])
  })
  it('comorbidades e remédios da ficha viram um item cada (vírgula da dose não separa)', () => {
    expect(resumo('Diabetes e colesterol alto. Em uso de metformina 850 mg, 2x ao dia e sinvastatina 20 mg. Nega alergias.')).toEqual([
      ['Alergias', 'f'], ['Diabetes', 'v'], ['Colesterol alto', 'v'], ['Metformina 850 mg, 2x ao dia', 'v'], ['Sinvastatina 20 mg', 'v'],
    ])
  })
  it('comorbidade depois da alergia e do remédio também entra; a frase da pele não vira comorbidade', () => {
    expect(resumo('Alergia a penicilina (urticária). Pele morena, raramente queima. Em uso de losartana 50 mg. Hipertensão arterial.')).toEqual([
      ['Alergia a penicilina (urticária)', 'v'], ['Hipertensão arterial', 'v'], ['Losartana 50 mg', 'v'],
    ])
  })
  it('alergia informada vem primeiro, com V', () => {
    expect(resumo('Pressão alta. Em uso de losartana 50 mg, 1x ao dia. Alergia a dipirona (inchaço no rosto).')[0]).toEqual(['Alergia a dipirona (inchaço no rosto)', 'v'])
  })
  it('alergia sempre aparece: sem nada na história, "não informado" e sem marca', () => {
    const r = montarResumo(historia('Ficha da pré-consulta não preenchida.'))
    expect(r).toEqual([{ id: 'alergia:nao-informado', tipo: 'alergia', texto: 'Alergias: não informado', marcaIA: null, marca: null, secao: null, trecho: null }])
  })
  it('nega tudo numa frase só: comorbidades F e medicamentos F', () => {
    expect(resumo('Nega comorbidades e uso contínuo de medicações. Nega alergias.')).toEqual([['Alergias', 'f'], ['Comorbidades', 'f'], ['Medicamentos em uso', 'f']])
  })
  it('todo item cita uma frase literal da história', () => {
    const h = historia('Pressão alta e infarto em 2019. Em uso de AAS 100 mg e atenolol 25 mg. Nega uso de anticoagulante além do AAS. Alergia a sulfa (falta de ar).')
    for (const x of montarResumo(h)) expect(h.find((s) => s.rotulo === x.secao)!.texto).toContain(x.trecho)
  })
  it('a anamnese fica fora: frase solta da HDA sem relevância não entra', () => {
    expect(resumo('Nega alergias.', 'Relata: fico mexendo nelas. Nega febre.')).toEqual([['Alergias', 'f']])
  })
})

describe('marcar e atualizar', () => {
  const r = montarResumo(historia('Nega comorbidades. Em uso de anticoncepcional oral. Nega alergias.'))
  it('o médico troca V↔F; "não informado" não tem marca para trocar', () => {
    expect(marcarResumo(r, 'comorbidade:comorbidades', 'v').find((x) => x.id === 'comorbidade:comorbidades')!.marca).toBe('v')
    const sem = montarResumo(historia(''))
    expect(marcarResumo(sem, 'alergia:nao-informado', 'v')[0].marca).toBeNull()
  })
  it('história salva de novo: a troca do médico fica se a IA leu igual; senão vale a nova leitura', () => {
    const trocado = marcarResumo(marcarResumo(r, 'comorbidade:comorbidades', 'v'), 'alergia:alergias', 'v')
    const novo = montarResumo(historia('Nega comorbidades. Em uso de anticoncepcional oral. Alergia a dipirona (urticária).'))
    const a = atualizarResumo(trocado, novo)
    expect(a.find((x) => x.id === 'comorbidade:comorbidades')!.marca).toBe('v')
    expect(a.some((x) => x.id === 'alergia:alergias')).toBe(false)
    expect(a[0]).toMatchObject({ texto: 'Alergia a dipirona (urticária)', marca: 'v' })
  })
})

describe('secaoDeAlergias (retorno: a alergia do prontuário entra no "Para relembrar")', () => {
  it('vira a frase que o resumo já entende, com marca V', () => {
    const itens = montarResumo([secaoDeAlergias([{ substancia: 'Penicilina', reacao: 'urticária' }, { substancia: 'Dipirona', reacao: '' }])!])
    expect(itens.filter((x) => x.tipo === 'alergia').map((x) => [x.texto, x.marca])).toEqual([['Alergia a Penicilina (urticária)', 'v'], ['Alergia a Dipirona (reação não informada)', 'v']])
  })
  it('sem alergia registrada: nada (continua "não informado")', () => {
    expect(secaoDeAlergias([])).toBeNull()
  })
})
