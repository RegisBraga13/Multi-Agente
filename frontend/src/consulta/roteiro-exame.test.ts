import { describe, expect, it } from 'vitest'
import { alternarMarca, camposDoRoteiro, escreverCampo, parteFeita, resumoDaParte, roteiroDoExame, textoDaParte } from './roteiro-exame'

const r = roteiroDoExame('reumatologia')!
const parte = (id: string) => r.find((p) => p.id === id)!

describe('roteiro do exame (reumatologia, autor 24/11/2026)', () => {
  it('5 partes na ordem; especialidade sem roteiro = undefined', () => {
    expect(r.map((p) => p.titulo)).toEqual(['GALS', 'Mapa articular', 'IPAM', 'Padrão', 'Extra-articular'])
    expect(roteiroDoExame('ortopedia')).toBeUndefined()
  })

  it('linha de uma resposta troca; de várias acumula; tocar de novo desmarca', () => {
    let m = alternarMarca({}, 'gals.marcha', 'Normal', false)
    m = alternarMarca(m, 'gals.marcha', 'Claudicante', false)
    expect(m['gals.marcha']).toEqual(['Claudicante'])
    m = alternarMarca(m, 'mapa.mcf', 'D', true)
    m = alternarMarca(m, 'mapa.mcf', 'E', true)
    expect(m['mapa.mcf']).toEqual(['D', 'E'])
    expect(alternarMarca(m, 'gals.marcha', 'Claudicante', false)['gals.marcha']).toBeUndefined()
  })

  it('texto de cada parte só com o que foi marcado; parte vazia = não examinada (null)', () => {
    const m = {
      'gals.marcha': ['Claudicante'], 'gals.pernas': ['Alterado'], 'gals.bracos': ['Normal'],
      'mapa.ombro': ['D'], 'mapa.mcf': ['D', 'E'], 'mapa.lombar': ['Sim'],
      'ipam.inspecao': ['Edema articular'], 'ipam.palpacao': ['Calor local'], 'ipam.adm_ativa': ['Limitada por dor/fraqueza'],
      'ipam.mao': ['Phalen', 'Finkelstein'],
      'padrao.numero': ['Poli (≥ 5)'], 'padrao.simetria': ['Simétrico'],
    }
    expect(textoDaParte(parte('gals'), m)).toBe('Marcha claudicante; braços normais; pernas alteradas.')
    expect(textoDaParte(parte('mapa'), m)).toBe('Ombro D; MCFs D e E; coluna lombar.')
    expect(textoDaParte(parte('ipam'), m)).toBe('Inspeção: edema articular. Palpação: calor local. ADM ativa limitada por dor/fraqueza. Manobras positivas: Phalen, Finkelstein (mão/punho).')
    expect(textoDaParte(parte('padrao'), m)).toBe('Poli (≥ 5), simétrico.')
    expect(textoDaParte(parte('extra'), m)).toBeNull()
    expect(camposDoRoteiro(r, m).map((c) => c.rotulo)).toEqual(['GALS', 'Articulações acometidas', 'IPAM', 'Padrão', 'Extra-articular'])
  })
})

const d = roteiroDoExame('dermatologia')!
const pd = (id: string) => d.find((p) => p.id === id)!

describe('roteiro do exame (dermatologia, autor 26/11/2026)', () => {
  it('9 partes na ordem combinada (Lesões cutâneas em duas)', () => {
    expect(d.map((p) => p.titulo)).toEqual(['Avaliação geral', 'Pele', 'Lesões', 'Local e aspecto', 'Anexos', 'Mucosas', 'Linfonodos', 'Registro fotográfico'])
  })

  it('"Outro" abre texto; desmarcar apaga o texto; sem texto, fica de fora', () => {
    let m = alternarMarca({}, 'lesoes.primaria', 'Pápula', true)
    m = alternarMarca(m, 'lesoes.primaria', 'Outro', true)
    expect(textoDaParte(pd('lesoes'), m)).toBe('Lesão primária: pápula.')
    m = escreverCampo(m, 'lesoes.primaria#outro', 'comedões')
    expect(textoDaParte(pd('lesoes'), m)).toBe('Lesão primária: pápula e comedões.')
    m = alternarMarca(m, 'lesoes.primaria', 'Outro', true)
    expect(m['lesoes.primaria#outro']).toBeUndefined()
  })

  it('"Sem alterações" e "Não…" excluem as outras opções da linha', () => {
    let m = alternarMarca({}, 'mucosas.achados', 'Eritema', true)
    m = alternarMarca(m, 'mucosas.achados', 'Sem alterações', true)
    expect(m['mucosas.achados']).toEqual(['Sem alterações'])
    m = alternarMarca(m, 'mucosas.achados', 'Úlceras', true)
    expect(m['mucosas.achados']).toEqual(['Úlceras'])
  })

  it('sinais vitais e dimensões em caixinhas; uma resposta em estado geral e fototipo', () => {
    let m = alternarMarca({}, 'geral.estado', 'Bom', false)
    m = alternarMarca(m, 'geral.estado', 'Regular', false)
    m = escreverCampo(m, 'geral.vitais#pa', '120/80')
    m = escreverCampo(m, 'geral.vitais#spo2', '98')
    expect(textoDaParte(pd('geral'), m)).toBe('Estado geral: regular; sinais vitais: PA 120/80 mmHg, SpO₂ 98%.')
    m = alternarMarca(m, 'pele.fototipo', 'III', false)
    expect(textoDaParte(pd('pele'), m)).toBe('Fototipo: III.')
    m = escreverCampo(m, 'local.dimensoes#a', '12')
    m = escreverCampo(m, 'local.dimensoes#b', '8')
    m = alternarMarca(m, 'local.dimensoes', 'mm', false)
    m = alternarMarca(m, 'local.gravidade', 'Moderada', false)
    expect(textoDaParte(pd('local'), m)).toBe('Dimensões: 12 × 8 mm; gravidade: moderada.')
  })

  it('Extensão vira campo próprio (o retorno compara o número), fora do texto da parte', () => {
    const m = escreverCampo({}, 'local.extensao#pct', '3')
    expect(textoDaParte(pd('local'), m)).toBeNull()
    expect(parteFeita(pd('local'), m)).toBe(true)
    expect(resumoDaParte(pd('local'), m)).toBe('extensão 3% do corpo')
    const campos = camposDoRoteiro(d, m)
    expect(campos.find((c) => c.rotulo === 'Extensão')?.valor).toBe('3% do corpo')
    expect(campos.find((c) => c.rotulo === 'Local e aspecto')?.valor).toBeNull()
  })

  it('não marcado não entra (parte vazia = null)', () => {
    expect(camposDoRoteiro(d, {}).every((c) => c.valor === null)).toBe(true)
  })
})

describe('roteiro do exame (cardiologia e gastroenterologia, autor 26/11/2026)', () => {
  const c = roteiroDoExame('cardiologia')!
  const g = roteiroDoExame('gastroenterologia')!
  const pc = (id: string) => c.find((p) => p.id === id)!
  const pg = (id: string) => g.find((p) => p.id === id)!

  it('partes na ordem do modelo', () => {
    expect(c.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Aspecto geral e perfusão', 'Coração', 'Sopros', 'Respiratório', 'Abdome', 'Extremidades', 'Pulsos', 'Carótidas'])
    expect(g.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Aspecto geral', 'Boca e pescoço', 'Abdome: inspeção e ausculta', 'Abdome: palpação', 'Anorretal', 'Extremidades e pele'])
  })

  it('sinais vitais e edema em caixinhas; pulsos com o lado no texto', () => {
    let m = escreverCampo({}, 'vitais.vitais#pa', '130/85')
    m = escreverCampo(m, 'vitais.vitais#fc', '72')
    m = alternarMarca(m, 'vitais.ritmo', 'Regular', false)
    expect(textoDaParte(pc('vitais'), m)).toBe('Sinais vitais: PA 130/85 mmHg, FC 72 bpm; ritmo: regular.')
    m = alternarMarca(m, 'extremidades.edema', 'Presente', false)
    m = escreverCampo(m, 'extremidades.edema#grau', '2')
    m = alternarMarca(m, 'pulsos.pedioso_e', 'Reduzido', false)
    expect(textoDaParte(pc('extremidades'), m)).toBe('Edema: grau 2/4+, presente.')
    expect(textoDaParte(pc('pulsos'), m)).toBe('Pedioso E: reduzido.')
  })

  it('palpação do abdome: "Não depressível" convive com "Tenso" (sem opção exclusiva nessa linha)', () => {
    let m = alternarMarca({}, 'abdome_palp.abdome', 'Tenso', true, false)
    m = alternarMarca(m, 'abdome_palp.abdome', 'Não depressível', true, false)
    expect(m['abdome_palp.abdome']).toEqual(['Tenso', 'Não depressível'])
    m = alternarMarca(m, 'abdome_palp.murphy', 'Presente', false)
    expect(textoDaParte(pg('abdome_palp'), m)).toBe('Abdome: tenso e não depressível; sinal de Murphy: presente.')
  })
})

describe('roteiro do exame (neurologia e endocrinologia, autor 26/11/2026)', () => {
  const n = roteiroDoExame('neurologia')!
  const e = roteiroDoExame('endocrinologia')!
  it('partes na ordem do modelo', () => {
    expect(n.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Estado mental e linguagem', 'Pares I a VI', 'Pares V a XII', 'Motricidade', 'Força (MRC 0–5)', 'Reflexos', 'Sensibilidade', 'Coordenação', 'Marcha e meníngeos'])
    expect(e.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Aspecto geral e pele', 'Tireoide e olhos', 'Coração e neuromuscular', 'Pés', 'Exame dirigido'])
  })
  it('força D/E com flexão/extensão juntas; pés com o lado no texto', () => {
    let m = escreverCampo({}, 'forca.cotovelo#df', '5')
    m = escreverCampo(m, 'forca.cotovelo#de', '4')
    m = escreverCampo(m, 'forca.cotovelo#ef', '3')
    expect(textoDaParte(n.find((p) => p.id === 'forca')!, m)).toBe('Flexão/extensão do cotovelo: D 5/4, E 3.')
    m = alternarMarca({}, 'pes.monofilamento_e', 'Não percebido em 1 ou mais', false)
    expect(textoDaParte(e.find((p) => p.id === 'pes')!, m)).toBe('Monofilamento E: não percebido em 1 ou mais.')
  })
})

describe('roteiro do exame (hematologia e infectologia, autor 26/11/2026)', () => {
  it('partes na ordem do modelo; respiratório da infecto sem opção exclusiva', () => {
    expect(roteiroDoExame('hematologia')!.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Estado geral e perfusão', 'Pele e mucosas', 'Linfonodos', 'Coração e pulmões', 'Abdome', 'Extremidades', 'Exame dirigido'])
    const i = roteiroDoExame('infectologia')!
    expect(i.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Estado geral e perfusão', 'Pele e mucosas', 'Orofaringe e linfonodos', 'Respiratório', 'Cardiovascular', 'Abdome e urinário', 'Neurológico', 'Articulações e dispositivos'])
    let m = alternarMarca({}, 'respiratorio.achados', 'Sem esforço', true, false)
    m = alternarMarca(m, 'respiratorio.achados', 'Estertores', true, false)
    expect(textoDaParte(i.find((p) => p.id === 'respiratorio')!, m)).toBe('Sem esforço; estertores.')
  })
})

describe('roteiro do exame (oncologia e nefrologia, autor 26/11/2026)', () => {
  it('partes na ordem do modelo; ECOG e diurese nos sinais vitais', () => {
    const o = roteiroDoExame('oncologia')!
    expect(o.map((p) => p.titulo)).toEqual(['Sinais vitais e ECOG', 'Estado geral e nutrição', 'Pele e mucosas', 'Linfonodos', 'Coração e pulmões', 'Abdome', 'Extremidades e neurológico', 'Sítio tumoral ou acesso'])
    const n = roteiroDoExame('nefrologia')!
    expect(n.map((p) => p.titulo)).toEqual(['Sinais vitais e diurese', 'Estado geral e perfusão', 'Estado volêmico', 'Coração e pulmões', 'Abdome e trato urinário', 'Pele e extremidades', 'Acesso de diálise ou enxerto'])
    let m = alternarMarca({}, 'vitais.ecog', '2', false)
    expect(textoDaParte(o[0], m)).toBe('ECOG: 2.')
    m = escreverCampo({}, 'vitais.diurese#ml', '800')
    m = escreverCampo(m, 'vitais.diurese#h', '24')
    expect(textoDaParte(n[0], m)).toBe('Diurese: 800 mL, em 24 h.')
  })
})

describe('roteiro do exame (ginecologia e urologia, autor 26/11/2026)', () => {
  it('começam pelo consentimento do exame íntimo; punho-percussão por lado', () => {
    for (const esp of ['ginecologia', 'urologia']) expect(roteiroDoExame(esp)![0].titulo).toBe('Sinais vitais e consentimento')
    const u = roteiroDoExame('urologia')!
    expect(u.map((p) => p.titulo)).toEqual(['Sinais vitais e consentimento', 'Abdome e flancos', 'Região inguinal', 'Genitália e períneo', 'Escroto e testículos', 'Toque retal', 'Dispositivos e resíduo'])
    const m = alternarMarca({}, 'abdome.ppl_d', 'Dolorosa', false)
    expect(textoDaParte(u[1], m)).toBe('Punho-percussão lombar D: dolorosa.')
  })
})

describe('roteiro do exame (geriatria, pediatria, psiquiatria e otorrino, autor 26/11/2026)', () => {
  it('partes na ordem do modelo', () => {
    expect(roteiroDoExame('geriatria')!.map((p) => p.titulo)).toEqual(['Sinais vitais e peso', 'Ortostatismo', 'Estado geral e nutrição', 'Vigília, atenção e comunicação',
      'Visão, audição e boca', 'Coração e pulmões', 'Abdome e extremidades', 'Pele', 'Força, marcha e equilíbrio', 'Instrumentos'])
    expect(roteiroDoExame('pediatria')!.map((p) => p.titulo)).toEqual(['Medidas e curva', 'Sinais vitais', 'Estado geral e hidratação', 'Pele e mucosas', 'Cabeça e pescoço',
      'Respiratório', 'Cardiovascular', 'Abdome', 'Neurológico e locomotor', 'Exame dirigido'])
    expect(roteiroDoExame('psiquiatria')!.map((p) => p.titulo)).toEqual(['Apresentação e atitude', 'Vigília, orientação e atenção', 'Psicomotricidade', 'Fala', 'Humor e afeto',
      'Curso e forma do pensamento', 'Conteúdo do pensamento', 'Sensopercepção', 'Memória, crítica e juízo', 'Exame físico dirigido'])
    expect(roteiroDoExame('otorrinolaringologia')!.map((p) => p.titulo)).toEqual(['Sinais vitais', 'Estado geral, voz e respiração', 'Orelhas e mastoides', 'Otoscopia',
      'Avaliação auditiva', 'Nariz e rinoscopia', 'Boca e orofaringe', 'Pescoço', 'Vestibular ou endoscópico'])
  })
  it('instrumentos da geriatria: só os preenchidos entram no texto', () => {
    const g = roteiroDoExame('geriatria')!.find((p) => p.id === 'instrumentos')!
    let m = escreverCampo({}, 'instrumentos.escores#minicog', '3')
    m = escreverCampo(m, 'instrumentos.escores#tug', '14')
    expect(textoDaParte(g, m)).toBe('Resultados: Mini-Cog 3, TUG 14 s.')
  })
  it('otoscopia por lado e Weber', () => {
    const o = roteiroDoExame('otorrinolaringologia')!
    let m = escreverCampo({}, 'otoscopia.membrana#d', 'abaulada')
    m = alternarMarca(m, 'otoscopia.achados', 'Abaulamento', true)
    expect(textoDaParte(o.find((p) => p.id === 'otoscopia')!, m)).toBe('Membrana timpânica: D abaulada; achados: abaulamento.')
    expect(textoDaParte(o.find((p) => p.id === 'audicao')!, alternarMarca({}, 'audicao.weber', 'Lateraliza à D', false))).toBe('Weber: lateraliza à D.')
  })
})

describe('roteiro do exame (pneumologia e hepatologia, autor 26/11/2026)', () => {
  it('partes na ordem do modelo; SpO₂ em oxigênio com fluxo; ascite não pesquisada', () => {
    const p = roteiroDoExame('pneumologia')!
    expect(p.map((x) => x.titulo)).toEqual(['Sinais vitais e oxigênio', 'Estado geral e esforço', 'Inspeção e palpação', 'Percussão', 'Ausculta', 'Coração e extremidades', 'SpO₂ ao esforço'])
    const h = roteiroDoExame('hepatologia')!
    expect(h.map((x) => x.titulo)).toEqual(['Sinais vitais', 'Estado geral e nutrição', 'Vigília e cognição', 'Pele, olhos e mucosas', 'Inspeção e percussão', 'Palpação abdominal', 'Extremidades e pulmões'])
    let m = alternarMarca({}, 'vitais.o2', 'Oxigênio', false)
    m = escreverCampo(m, 'vitais.fluxo#t', 'cateter, 2 L/min')
    expect(textoDaParte(p[0], m)).toBe('SpO₂ em: oxigênio; dispositivo e fluxo de oxigênio: cateter, 2 L/min.')
    expect(textoDaParte(h[4], alternarMarca({}, 'inspecao.ascite', 'Presente', false))).toBe('Sinais clínicos de ascite: presente.')
  })
})

describe('roteiro do exame (cirurgia geral, autor 26/11/2026)', () => {
  it('partes na ordem do modelo; dreno com débito, horas e aspecto', () => {
    const c = roteiroDoExame('cirurgia-geral')!
    expect(c.map((x) => x.titulo)).toEqual(['Sinais vitais', 'Estado geral e perfusão', 'Cardiopulmonar', 'Abdome: inspeção e ausculta', 'Abdome: percussão e palpação',
      'Sinais dirigidos', 'Parede abdominal e virilhas', 'Ferida, dreno ou estoma', 'Pele ou região anorretal'])
    const ferida = c.find((p) => p.id === 'ferida')!
    let m = escreverCampo({}, 'ferida.dreno#ml', '50')
    m = escreverCampo(m, 'ferida.dreno#h', '24')
    m = escreverCampo(m, 'ferida.dreno#aspecto', 'seroso')
    expect(textoDaParte(ferida, m)).toBe('Dreno: Débito 50 mL, em 24 h, aspecto seroso.')
    expect(textoDaParte(c.find((p) => p.id === 'sinais')!, alternarMarca({}, 'sinais.murphy', 'Positivo', false))).toBe('Sinal de Murphy: positivo.')
  })
})

