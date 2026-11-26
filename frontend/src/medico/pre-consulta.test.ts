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
    const p = todas('ortopedia')
    expect(p.map((x) => x.id)).toEqual(['queixa', 'desde_quando', 'medicamentos', 'alergias', 'algo_mais'])
    expect(p.some((x) => x.tipo === 'foto')).toBe(false)
  })

  it('cardiologia e gastroenterologia (autor, 26/11/2026): partes na ordem do modelo, Saúde geral padrão, Exames com aviso e Algo mais no fim', () => {
    expect(partesPreConsulta('cardiologia').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Sintomas', 'Como são os sintomas', 'Histórico de saúde', 'Saúde geral', 'Histórico familiar',
      'Hábitos', 'Exames', 'O que espera da consulta', 'Algo mais que seu médico deva saber?',
    ])
    expect(partesPreConsulta('gastroenterologia').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Sintomas que tem ou teve recentemente', 'Como são os sintomas', 'Dor e intestino', 'Histórico de saúde', 'Saúde geral',
      'Alimentação e hábitos', 'Histórico familiar', 'Exames', 'O que espera da consulta', 'Algo mais que seu médico deva saber?',
    ])
    for (const esp of ['cardiologia', 'gastroenterologia']) {
      const saude = partesPreConsulta(esp).find((p) => p.titulo === 'Saúde geral')!
      expect(saude.perguntas.map((x) => x.id)).toEqual(['medicamentos', 'remedios_tipo', 'alergias', 'gravida', 'amamentando'])
      const exames = partesPreConsulta(esp).find((p) => p.titulo === 'Exames')!
      expect(exames.nota).toContain('Traga também no dia da consulta')
      expect(exames.perguntas.some((x) => x.tipo === 'arquivos')).toBe(true)
      // nota da dor só para quem marcou alguma dor (regra 5.8)
      expect(todas(esp).find((x) => x.id === 'nota_dor')?.soSe?.pergunta).toBe('sintomas')
    }
  })

  it('neurologia e endocrinologia: quem preenche no motivo; partes conforme a queixa só para quem marcou', () => {
    for (const esp of ['neurologia', 'endocrinologia', 'hematologia', 'infectologia', 'oncologia', 'nefrologia']) {
      expect(partesPreConsulta(esp)[0].perguntas[0].id).toBe('preenchido_por')
      expect(partesPreConsulta(esp)[partesPreConsulta(esp).length - 1].titulo).toBe('Algo mais que seu médico deva saber?')
    }
    const dor = partesPreConsulta('neurologia').find((p) => p.titulo === 'Dor')!
    expect(dor.perguntas.every((q) => !perguntaVisivel(q, 'F', { motivo: ['Tremor ou movimentos involuntários'] }))).toBe(true)
    expect(dor.perguntas.every((q) => perguntaVisivel(q, 'F', { motivo: ['Dor de cabeça'] }))).toBe(true)
    // dor em queimação: só a nota da dor (regra 5.8)
    expect(dor.perguntas.filter((q) => perguntaVisivel(q, 'F', { motivo: ['Dor em queimação ou choque'] })).map((q) => q.id)).toEqual(['nota_dor'])
  })

  it('pergunta que depende de várias opções aparece com qualquer uma delas', () => {
    const quanto = todas('cardiologia').find((x) => x.id === 'tabagismo_quanto')!
    expect(perguntaVisivel(quanto, 'M', { tabagismo: 'Nunca fumou' })).toBe(false)
    expect(perguntaVisivel(quanto, 'M', { tabagismo: 'Ex-fumante' })).toBe(true)
    const dor = todas('gastroenterologia').find((x) => x.id === 'nota_dor')!
    expect(perguntaVisivel(dor, 'F', { sintomas: ['Diarreia'] })).toBe(false)
    expect(perguntaVisivel(dor, 'F', { sintomas: ['Diarreia', 'Dor ao evacuar'] })).toBe(true)
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

  it('ginecologia e urologia começam pela queixa (sem "quem preenche")', () => {
    for (const esp of ['ginecologia', 'urologia']) {
      expect(partesPreConsulta(esp)[0].perguntas[0].id).toBe('queixa')
      expect(partesPreConsulta(esp)[partesPreConsulta(esp).length - 1].titulo).toBe('Algo mais que seu médico deva saber?')
    }
  })

  it('geriatria, pediatria, psiquiatria e otorrino (autor, 26/11/2026): partes na ordem do modelo, quem preenche no início', () => {
    expect(partesPreConsulta('geriatria').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Memória e comportamento', 'Mobilidade e quedas', 'Autonomia', 'Alimentação e deglutição', 'Humor, sono e sentidos',
      'Moradia e apoio', 'Histórico de saúde', 'Saúde geral', 'O que é importante para você', 'Exames', 'Algo mais que seu médico deva saber?',
    ])
    expect(partesPreConsulta('pediatria').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Queixa atual', 'Gestação e nascimento', 'Alimentação, urina e fezes', 'Crescimento e desenvolvimento', 'Sono, rotina e escola',
      'Adolescência', 'Histórico de saúde', 'Saúde geral', 'Documentos', 'Algo mais que seu médico deva saber?',
    ])
    expect(partesPreConsulta('psiquiatria').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Como começou', 'Impacto na rotina', 'Sono e energia', 'Tratamentos anteriores', 'Saúde geral', 'Álcool e outras substâncias',
      'Histórico de saúde', 'Exames', 'Algo mais que seu médico deva saber?',
    ])
    expect(partesPreConsulta('otorrinolaringologia').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Ouvido e audição', 'Tontura', 'Nariz e rosto', 'Garganta, voz e engolir', 'Sono', 'Pescoço', 'Histórico de saúde', 'Saúde geral',
      'Exames', 'Algo mais que seu médico deva saber?',
    ])
    for (const esp of ['geriatria', 'pediatria', 'psiquiatria', 'otorrinolaringologia']) {
      expect(partesPreConsulta(esp)[0].perguntas[0].id).toBe('preenchido_por')
      const fim = partesPreConsulta(esp).slice(-2)[0]
      expect(fim.nota).toContain('Traga também no dia da consulta')
      expect(fim.perguntas.some((x) => x.tipo === 'arquivos')).toBe(true)
    }
    // pessoa idosa e criança: sem gravidez e amamentação
    for (const esp of ['geriatria', 'pediatria']) expect(todas(esp).some((x) => x.id === 'gravida' || x.id === 'amamentando')).toBe(false)
    expect(todas('pediatria')[0].opcoes).toEqual(['Responsável', 'O próprio adolescente'])
    // nota da dor sempre que houver dor (regra 5.8)
    expect(todas('pediatria').find((x) => x.id === 'nota_dor')?.soSe).toEqual({ pergunta: 'motivo', opcao: ['Dor'] })
    expect(todas('otorrinolaringologia').find((x) => x.id === 'nota_dor')?.soSe).toEqual({ pergunta: 'motivo', opcao: ['Dor de ouvido', 'Dor de garganta'] })
  })

  it('otorrino: cada bloco só para quem marcou a queixa dele', () => {
    const ouvido = partesPreConsulta('otorrinolaringologia').find((p) => p.titulo === 'Ouvido e audição')!
    expect(ouvido.perguntas.every((q) => !perguntaVisivel(q, 'F', { motivo: ['Rouquidão'] }))).toBe(true)
    expect(ouvido.perguntas.every((q) => perguntaVisivel(q, 'F', { motivo: ['Zumbido'] }))).toBe(true)
  })

  it('pneumologia e hepatologia (autor, 26/11/2026): partes na ordem do modelo', () => {
    expect(partesPreConsulta('pneumologia').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Tosse e catarro', 'Falta de ar', 'Chiado ou aperto no peito', 'Crises nos últimos 12 meses', 'Sono', 'Cigarro e exposições',
      'Histórico de saúde', 'Saúde geral', 'Exames', 'Algo mais que seu médico deva saber?',
    ])
    expect(partesPreConsulta('hepatologia').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Diagnóstico ou exame alterado', 'Sintomas', 'Complicações e procedimentos', 'Bebida alcoólica', 'Hepatites e tratamentos',
      'Outras doenças e família', 'Remédios e peso', 'Saúde geral', 'Exames', 'Algo mais que seu médico deva saber?',
    ])
    // cigarros por dia só para quem fuma ou fumou; "quando parou" só para ex-fumante
    const q = Object.fromEntries(todas('pneumologia').map((x) => [x.id, x]))
    expect(perguntaVisivel(q.cigarros_dia, 'M', { tabagismo: 'Nunca fumou' })).toBe(false)
    expect(perguntaVisivel(q.cigarros_dia, 'M', { tabagismo: 'Fuma atualmente' })).toBe(true)
    expect(perguntaVisivel(q.parou, 'M', { tabagismo: 'Fuma atualmente' })).toBe(false)
    expect(q.nota_dor.soSe).toEqual({ pergunta: 'motivo', opcao: ['Dor no peito'] })
  })

  it('cirurgia geral (autor, 26/11/2026): partes na ordem do modelo; cada queixa só para quem a marcou', () => {
    expect(partesPreConsulta('cirurgia-geral').map((p) => p.titulo)).toEqual([
      'Motivo da consulta', 'Dor na barriga', 'Hérnia ou abaulamento', 'Pedra na vesícula', 'Caroço ou lesão na pele', 'Problema no ânus',
      'Retorno após cirurgia', 'Cirurgias e anestesia', 'Remédios', 'Saúde geral', 'Exames', 'Algo mais que seu médico deva saber?',
    ])
    const hernia = partesPreConsulta('cirurgia-geral').find((p) => p.titulo === 'Hérnia ou abaulamento')!
    expect(hernia.perguntas.every((q) => !perguntaVisivel(q, 'M', { motivo: ['Pedra na vesícula'] }))).toBe(true)
    expect(hernia.perguntas.every((q) => perguntaVisivel(q, 'M', { motivo: ['Hérnia ou abaulamento'] }))).toBe(true)
    const q = Object.fromEntries(todas('cirurgia-geral').map((x) => [x.id, x]))
    expect(q.nota_dor.soSe).toEqual({ pergunta: 'motivo', opcao: ['Dor na barriga'] })
  })
})

