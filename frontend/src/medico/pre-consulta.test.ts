import { describe, expect, it } from 'vitest'
import { ESPECIALIDADES } from '../especialidades'
import { alternarOpcao, partesPreConsulta, perguntaVisivel, type Pergunta } from './pre-consulta'

const todas = (esp: string) => partesPreConsulta(esp).flatMap((p) => p.perguntas)

describe('partesPreConsulta', () => {
  it('dermatologia segue o modelo: seis partes, na ordem, e "Algo mais" no fim', () => {
    expect(partesPreConsulta('dermatologia').map((p) => p.titulo)).toEqual([
      'Queixa principal',
      'Fototipo e exposição ao sol',
      'Rotina de cuidados',
      'Saúde geral',
      'Histórico familiar',
      'Fotos e documentos',
      'Algo mais que seu médico deva saber?',
    ])
  })

  it('dermatologia: queixa com sintomas para marcar, fototipo por opções, duas fotos e documentos com aviso', () => {
    const q = Object.fromEntries(todas('dermatologia').map((x) => [x.id, x]))
    expect(q.sintomas.tipo).toBe('varias')
    expect(q.sintomas.opcoes).toEqual(['Coça', 'Dói', 'Sangra', 'Nenhum dos três'])
    expect(q.mudou.opcoes).toEqual(['Sim', 'Não', 'Não sei'])
    for (const id of ['cor_pele', 'cor_olhos', 'cor_cabelo', 'reacao_sol', 'protetor', 'bronzeamento']) expect(q[id].tipo).toBe('escolha')
    expect(q.protetor.opcoes).toEqual(['Todo dia', 'Às vezes', 'Raramente'])
    expect(q.familia.tipo).toBe('varias')
    expect(q.familia.opcoes).toEqual(['Câncer de pele', 'Psoríase', 'Dermatite atópica', 'Vitiligo', 'Queda de cabelo', 'Nenhum desses'])
    expect(q.medicamentos.rotulo).toContain('hormônios e corticoides')
    // gravidez e amamentação: duas perguntas Sim/Não, só para F (pedido do autor, 19/11/2026)
    for (const id of ['gravida', 'amamentando']) {
      expect(q[id].opcoes).toEqual(['Sim', 'Não'])
      expect(q[id].soParaSexo).toBe('F')
    }
    // Saúde geral na ordem da lista do autor; Doenças ocupa a linha (Alergias vem depois de Medicamentos)
    const saude = partesPreConsulta('dermatologia').find((p) => p.titulo === 'Saúde geral')!
    expect(saude.perguntas.map((x) => x.id)).toEqual(['doencas', 'medicamentos', 'alergias', 'gravida', 'amamentando'])
    expect(q.doencas.linhaToda).toBe(true)
    const fotos = partesPreConsulta('dermatologia').find((p) => p.titulo === 'Fotos e documentos')!
    expect(fotos.perguntas.map((x) => x.tipo)).toEqual(['foto', 'foto', 'arquivos'])
    expect(fotos.nota).toBe('A foto ajuda a acompanhar a evolução, e o exame presencial continua necessário. Traga também no dia da consulta os exames (mesmo os antigos) e as fotos no celular.')
    // nota da dor só para quem marcou "Dói" (autor, 24/11/2026)
    expect(q.nota_dor.soSe).toEqual({ pergunta: 'sintomas', opcao: 'Dói' })
  })

  it('especialidade sem pacote próprio recebe as perguntas gerais, sem foto', () => {
    const p = todas('cardiologia')
    expect(p.map((x) => x.id)).toEqual(['queixa', 'desde_quando', 'medicamentos', 'alergias', 'algo_mais'])
    expect(p.some((x) => x.tipo === 'foto')).toBe(false)
  })

  it('todo pacote é coerente: alergias em Saúde geral (opcional), ids únicos, opções só onde se escolhe', () => {
    for (const e of ESPECIALIDADES) {
      const saude = partesPreConsulta(e.slug).find((x) => x.titulo === 'Saúde geral')
      expect(saude?.perguntas.find((x) => x.id === 'alergias')?.obrigatoria).toBeFalsy()
      expect(saude?.perguntas.some((x) => x.id === 'alergias')).toBe(true)
      const p = todas(e.slug)
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
  const dor: Pergunta = { id: 'nota_dor', rotulo: 'n', tipo: 'escolha', opcoes: ['0', '1'], soSe: { pergunta: 'sintomas', opcao: 'Dói' } }
  it('pergunta que depende de outra: aparece com a opção marcada, ou se já foi respondida', () => {
    expect(perguntaVisivel(dor, 'F', { sintomas: ['Coça'] })).toBe(false)
    expect(perguntaVisivel(dor, 'F', { sintomas: ['Coça', 'Dói'] })).toBe(true)
    expect(perguntaVisivel(dor, 'F', { nota_dor: '6' })).toBe(true)
  })
  const gestacao: Pergunta = { id: 'g', rotulo: 'g', tipo: 'escolha', opcoes: ['a', 'b'], soParaSexo: 'F' }
  const comum: Pergunta = { id: 'c', rotulo: 'c', tipo: 'texto' }
  it('pergunta restrita só aparece para o sexo indicado', () => {
    expect(perguntaVisivel(gestacao, 'F', {})).toBe(true)
    for (const s of ['M', 'I', ''] as const) expect(perguntaVisivel(gestacao, s, {})).toBe(false)
  })
  it('pergunta comum aparece sempre', () => {
    for (const s of ['F', 'M', 'I', ''] as const) expect(perguntaVisivel(comum, s, {})).toBe(true)
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

describe('reumatologia (texto do autor, 24/11/2026)', () => {
  const partes = partesPreConsulta('reumatologia')
  const q = Object.fromEntries(todas('reumatologia').map((x) => [x.id, x]))

  it('partes na ordem; a última é "Algo mais", sem Pular', () => {
    expect(partes.map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Onde dói', 'Rigidez e dor', 'Outros sintomas', 'Saúde geral', 'Histórico familiar', 'Exames e fotos',
      'Algo mais que seu médico deva saber?',
    ])
    expect(partes[partes.length - 1].semPular).toBe(true)
    expect(partes[partes.length - 1].perguntas[0].tipo).toBe('texto-longo')
  })

  it('regiões separadas (o local aponta o diagnóstico), em duas colunas, com Outro que abre linha', () => {
    expect(q.regioes.tipo).toBe('varias')
    expect(q.regioes.opcoes).toHaveLength(15)
    expect(q.regioes.duasColunas).toBe(true)
    expect(q.regioes.abreLinha).toBe('Outro')
  })

  it('piora: múltipla, "Não percebi relação" desmarca as outras; nota da dor 0 a 10', () => {
    expect(q.piora.opcoes).toEqual(['Repouso (ex.: madrugada)', 'Esforço ou repetição', 'Frio ou mudança de clima', 'Estresse ou sono ruim', 'Carne vermelha ou álcool', 'Não percebi relação', 'Outro'])
    expect(q.piora.exclusiva).toBe('Não percebi relação')
    expect(q.nota_dor.escala).toBe(true)
    expect(q.nota_dor.opcoes).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })

  it('"Após algum evento" abre linha; junta inchada no passado mostra a dica da foto', () => {
    expect(q.inicio.abreLinha).toBe('Após algum evento específico')
    expect(q.inchaco.dica?.opcao).toBe('Já ficou inchada no passado, mas hoje não está')
  })

  it('Saúde geral na ordem aprovada; família com Reumatismo; fotos só imagem e aviso de trazer no dia', () => {
    expect(partes.find((p) => p.titulo === 'Saúde geral')!.perguntas.map((x) => x.id)).toEqual(['doencas', 'medicamentos', 'remedios_dor', 'alergias', 'gravida', 'amamentando'])
    expect(q.familia.opcoes).toContain('Reumatismo')
    expect(q.fotos.soFotos).toBe(true)
    expect(partes.find((p) => p.titulo === 'Exames e fotos')!.nota).toMatch(/^Traga também no dia/)
  })
})
