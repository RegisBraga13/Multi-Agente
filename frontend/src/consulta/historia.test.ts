import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { conteudoDaConsulta } from './exemplo'
import { atualizarHistoria, montarHistoria } from './historia'

const agora = new Date(2026, 10, 16, 7, 0)
const antonio = agendaDoDia('2026-11-16', agora).find((x) => x.paciente.nome === 'Antônio Barbosa')!
const c = conteudoDaConsulta(antonio, 'dermatologia')
const exame = c.exame.map((x) => ({ rotulo: x.rotulo, valor: x.valor }))
const texto = 'Médico: Me conta.\nPaciente: Ferida no nariz que não cicatriza há 3 meses.\nMédico: Usa remédio?\nPaciente: AAS 100 mg.\n'

describe('montarHistoria', () => {
  const contexto = { falas: c.falas, sinais: [{ texto: 'Ferida não cicatriza há >4 sem', resposta: 'v' as const }, { texto: 'Outro sinal', resposta: 'f' as const }] }
  const h = montarHistoria(antonio, agora, texto, exame, c.complementares, contexto)

  it('tem as seis seções da landing, na ordem', () => {
    expect(h.map((s) => s.rotulo)).toEqual(['Identificação', 'Queixa principal', 'História da doença atual', 'Antecedentes e alertas', 'Exame físico', 'Exames complementares'])
  })
  it('a história atual vem só das falas do paciente, em linguagem médica corrida (como na landing)', () => {
    const hda = h[2].texto
    expect(hda.startsWith('Paciente de 73 anos refere ferida no nariz que não cicatriza há 3 meses.')).toBe(true)
    expect(hda).not.toContain('Me conta')
  })
  it('a queixa abre a HDA mesmo quando foi dita depois de outras falas', () => {
    const fora = ['Médico: Toma anticoagulante?', 'Paciente: AAS 100 mg.', 'Médico: Me conta.', 'Paciente: Ferida no nariz que não cicatriza há 3 meses.'].join(String.fromCharCode(10))
    expect(montarHistoria(antonio, agora, fora, exame, [], contexto)[2].texto.startsWith('Paciente de 73 anos refere ferida no nariz')).toBe(true)
  })
  it('pergunta respondida entra contextualizada (HDA ou antecedentes); sem resposta não entra', () => {
    const p = (texto: string, secao: 'hda' | 'ant') => ({ texto, sim: `${texto} sim.`, nao: `${texto} não.`, secao })
    const h2 = montarHistoria(antonio, agora, texto, exame, [], { ...contexto, perguntas: [
      { pergunta: p('Gravidez', 'hda'), resposta: 'nao' as const },
      { pergunta: p('Anticoagulante', 'ant'), resposta: 'sim' as const },
    ] })
    expect(h2[2].texto.endsWith('Gravidez não.')).toBe(true)
    expect(h2[3].texto).toContain('Anticoagulante sim.')
    expect(h[2].texto).not.toContain('Gravidez')
  })
  it('fala do paciente fora do roteiro entra como relato; remédios ficam nos antecedentes', () => {
    expect(h[2].texto).toContain('Relata: AAS 100 mg.')
    const roteiro = c.falas.map((f) => `${f.quem}: ${f.texto}`).join(String.fromCharCode(10))
    const hda = montarHistoria(antonio, agora, roteiro, exame, [], contexto)[2].texto
    expect(hda).toContain('Sangramento ao trauma leve, com formação de crosta.')
    expect(hda).not.toMatch(/AAS|Atenolol|Sulfa/i)
  })
  it('anamnese escrita à mão (sem falas) entra inteira', () => {
    expect(montarHistoria(antonio, agora, 'Lesão no nariz há 3 meses.', exame, [])[2].texto).toBe('Lesão no nariz há 3 meses.')
  })
  it('o exame físico usa os valores salvos (inclusive editados) e pula campos vazios', () => {
    const editado = exame.map((x) => (x.rotulo === 'Localização' ? { ...x, valor: 'Asa nasal direita' } : x.rotulo === 'Extensão' ? { ...x, valor: '' } : x))
    const ef = montarHistoria(antonio, agora, texto, editado, [])[4].texto
    expect(ef).toContain('em asa nasal direita')
    expect(ef).not.toContain('cerca de 6 mm')
  })
  it('exames complementares: ausente vira "não encontrado no laudo", inferido pede conferência; sem exames diz isso', () => {
    expect(h[5].texto).toContain('Margens: não encontrado no laudo')
    expect(montarHistoria(antonio, agora, texto, exame, [])[5].texto).toBe('Nenhum exame trazido.')
  })
  it('alergia da ficha e sinal de alerta marcado V entram em antecedentes e alertas; F não entra', () => {
    expect(h[3].texto).toContain('Alergia a sulfa (falta de ar).')
    expect(h[3].texto).toContain('Alerta: ferida não cicatriza há >4 sem.')
    expect(h[3].texto).not.toContain('outro sinal')
  })
  it('exames complementares: laudo (biópsia) numa linha só; laboratório, um resultado por linha', () => {
    expect(h[5].texto).toBe('Biópsia anterior (2024): Diagnóstico: Carcinoma basocelular nodular; Local: Região malar esquerda; Margens: não encontrado no laudo.')
  })
  it('sigla no remédio não vira minúscula (AAS)', () => {
    expect(h[3].texto).toContain('Em uso de AAS 100 mg')
  })
})

describe('atualizarHistoria', () => {
  const geradas = [{ rotulo: 'A', texto: 'a1' }, { rotulo: 'B', texto: 'b1' }, { rotulo: 'C', texto: 'c1' }]
  const atuais = ['a1', 'b1 editado pelo médico', 'c1']
  it('só reescreve as seções cuja origem mudou; mantém as edições do médico nas demais', () => {
    const novas = [{ rotulo: 'A', texto: 'a2' }, { rotulo: 'B', texto: 'b1' }, { rotulo: 'C', texto: 'c1' }]
    const r = atualizarHistoria(geradas, atuais, novas)
    expect(r.textos).toEqual(['a2', 'b1 editado pelo médico', 'c1'])
    expect(r.mudou).toEqual([true, false, false])
  })
  it('nada mudou: nada é reescrito', () => {
    expect(atualizarHistoria(geradas, atuais, geradas).mudou).toEqual([false, false, false])
  })
  it('seção editada pelo médico cuja origem mudou: o texto dele fica, a IA sugere ao lado', () => {
    const novas = [{ rotulo: 'A', texto: 'a1' }, { rotulo: 'B', texto: 'b2' }, { rotulo: 'C', texto: 'c1' }]
    const r = atualizarHistoria(geradas, atuais, novas)
    expect(r.textos[1]).toBe('b1 editado pelo médico')
    expect(r.mudou[1]).toBe(false)
    expect(r.sugestoes).toEqual([null, 'b2', null])
  })
})
