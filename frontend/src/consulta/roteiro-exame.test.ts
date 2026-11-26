import { describe, expect, it } from 'vitest'
import { alternarMarca, camposDoRoteiro, escreverCampo, parteFeita, resumoDaParte, roteiroDoExame, textoDaParte } from './roteiro-exame'

const r = roteiroDoExame('reumatologia')!
const parte = (id: string) => r.find((p) => p.id === id)!

describe('roteiro do exame (reumatologia, autor 24/11/2026)', () => {
  it('5 partes na ordem; especialidade sem roteiro = undefined', () => {
    expect(r.map((p) => p.titulo)).toEqual(['GALS', 'Mapa articular', 'IPAM', 'Padrão', 'Extra-articular'])
    expect(roteiroDoExame('cardiologia')).toBeUndefined()
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
