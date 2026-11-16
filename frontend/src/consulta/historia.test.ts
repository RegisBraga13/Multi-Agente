import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { conteudoDaConsulta } from './exemplo'
import { montarHistoria } from './historia'

const agora = new Date(2026, 10, 16, 7, 0)
const antonio = agendaDoDia('2026-11-16', agora).find((x) => x.paciente.nome === 'Antônio Barbosa')!
const c = conteudoDaConsulta(antonio, 'dermatologia')
const exame = c.exame.map((x) => ({ rotulo: x.rotulo, valor: x.valor }))
const texto = 'Médico: Me conta.\nPaciente: Ferida no nariz que não cicatriza há 3 meses.\nMédico: Usa remédio?\nPaciente: AAS 100 mg.\n'

describe('montarHistoria', () => {
  const h = montarHistoria(antonio, agora, texto, exame, c.complementares)

  it('tem as seis seções da landing, na ordem', () => {
    expect(h.map((s) => s.rotulo)).toEqual(['Identificação', 'Queixa principal', 'História da doença atual', 'Antecedentes e alertas', 'Exame físico', 'Exames complementares'])
  })
  it('a história atual vem só das falas do paciente na anamnese salva', () => {
    const hda = h[2].texto
    expect(hda).toContain('Ferida no nariz que não cicatriza há 3 meses.')
    expect(hda).not.toContain('Me conta')
  })
  it('anamnese escrita à mão (sem falas) entra inteira', () => {
    expect(montarHistoria(antonio, agora, 'Lesão no nariz há 3 meses.', exame, [])[2].texto).toBe('Lesão no nariz há 3 meses.')
  })
  it('o exame físico usa os valores salvos (inclusive editados) e pula campos vazios', () => {
    const editado = exame.map((x) => (x.rotulo === 'Localização' ? { ...x, valor: 'Asa nasal direita' } : x.rotulo === 'Extensão' ? { ...x, valor: '' } : x))
    const ef = montarHistoria(antonio, agora, texto, editado, [])[4].texto
    expect(ef).toContain('Localização: Asa nasal direita')
    expect(ef).not.toContain('Extensão')
  })
  it('exames complementares: ausente vira "não encontrado no laudo", inferido pede conferência; sem exames diz isso', () => {
    expect(h[5].texto).toContain('Margens: não encontrado no laudo')
    expect(montarHistoria(antonio, agora, texto, exame, [])[5].texto).toBe('Nenhum exame trazido.')
  })
  it('alergia da ficha entra em antecedentes e alertas', () => {
    expect(h[3].texto).toContain('Alergia: sulfa')
  })
})
