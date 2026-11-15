import { describe, expect, it } from 'vitest'
import { ESPECIALIDADES } from '../especialidades'
import { alternarOpcao, partesPreConsulta, perguntaVisivel, type Pergunta } from './pre-consulta'

const todas = (esp: string) => partesPreConsulta(esp).flatMap((p) => p.perguntas)

describe('partesPreConsulta', () => {
  it('dermatologia segue o modelo: seis partes, na ordem', () => {
    expect(partesPreConsulta('dermatologia').map((p) => p.titulo)).toEqual([
      'Queixa principal',
      'Fototipo e exposição ao sol',
      'Rotina de cuidados',
      'Saúde geral',
      'Histórico familiar',
      'Fotos',
    ])
  })

  it('dermatologia: queixa com sintomas para marcar, fototipo por opções, duas fotos com aviso', () => {
    const q = Object.fromEntries(todas('dermatologia').map((x) => [x.id, x]))
    expect(q.sintomas.tipo).toBe('varias')
    expect(q.sintomas.opcoes).toEqual(['Coça', 'Dói', 'Sangra', 'Nenhum dos três'])
    expect(q.mudou.opcoes).toEqual(['Sim', 'Não', 'Não sei'])
    for (const id of ['cor_pele', 'cor_olhos', 'cor_cabelo', 'reacao_sol', 'protetor', 'bronzeamento']) expect(q[id].tipo).toBe('escolha')
    expect(q.protetor.opcoes).toEqual(['Todo dia', 'Às vezes', 'Raramente', 'Nunca'])
    expect(q.familia.tipo).toBe('varias')
    expect(q.familia.opcoes).toEqual(['Câncer de pele', 'Psoríase', 'Dermatite atópica', 'Vitiligo', 'Queda de cabelo', 'Nenhum desses'])
    expect(q.medicamentos.rotulo).toContain('hormônios e corticoides')
    expect(q.gestacao.soParaSexo).toBe('F')
    const fotos = partesPreConsulta('dermatologia').find((p) => p.titulo === 'Fotos')!
    expect(fotos.perguntas.map((x) => x.tipo)).toEqual(['foto', 'foto'])
    expect(fotos.nota).toBe('A foto ajuda a acompanhar a evolução, e o exame presencial continua necessário.')
  })

  it('especialidade sem pacote próprio recebe as perguntas gerais, sem foto', () => {
    const p = todas('cardiologia')
    expect(p.map((x) => x.id)).toEqual(['queixa', 'desde_quando', 'medicamentos', 'alergias'])
    expect(p.some((x) => x.tipo === 'foto')).toBe(false)
  })

  it('todo pacote é coerente: alergia sempre, ids únicos, opções só onde se escolhe', () => {
    for (const e of ESPECIALIDADES) {
      const p = todas(e.slug)
      expect(p.some((x) => x.id === 'alergias')).toBe(true)
      expect(new Set(p.map((x) => x.id)).size).toBe(p.length)
      for (const x of p) {
        const escolhe = x.tipo === 'escolha' || x.tipo === 'varias'
        expect((x.opcoes?.length ?? 0) >= 2).toBe(escolhe)
        if (x.exclusiva) expect(x.opcoes).toContain(x.exclusiva)
      }
    }
  })
})

describe('perguntaVisivel', () => {
  const gestacao: Pergunta = { id: 'g', rotulo: 'g', tipo: 'escolha', opcoes: ['a', 'b'], soParaSexo: 'F' }
  const comum: Pergunta = { id: 'c', rotulo: 'c', tipo: 'texto' }
  it('pergunta restrita só aparece para o sexo indicado', () => {
    expect(perguntaVisivel(gestacao, 'F')).toBe(true)
    for (const s of ['M', 'outro', ''] as const) expect(perguntaVisivel(gestacao, s)).toBe(false)
  })
  it('pergunta comum aparece sempre', () => {
    for (const s of ['F', 'M', 'outro', ''] as const) expect(perguntaVisivel(comum, s)).toBe(true)
  })
})

describe('alternarOpcao', () => {
  const N = 'Nenhum dos três'
  it('marca e desmarca, mantendo as outras', () => {
    expect(alternarOpcao([], 'Coça', N)).toEqual(['Coça'])
    expect(alternarOpcao(['Coça'], 'Dói', N)).toEqual(['Coça', 'Dói'])
    expect(alternarOpcao(['Coça', 'Dói'], 'Coça', N)).toEqual(['Dói'])
  })
  it('a opção exclusiva desmarca as outras, e vice-versa', () => {
    expect(alternarOpcao(['Coça', 'Dói'], N, N)).toEqual([N])
    expect(alternarOpcao([N], 'Sangra', N)).toEqual(['Sangra'])
    expect(alternarOpcao([N], N, N)).toEqual([])
  })
  it('sem opção exclusiva, só alterna', () => {
    expect(alternarOpcao(['a'], 'b')).toEqual(['a', 'b'])
  })
})
