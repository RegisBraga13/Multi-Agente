import { describe, expect, it } from 'vitest'
import { RASCUNHO_INICIAL, escolher, horarioEscolhido, podeSalvarAnexos, retornoParaEnvio, textoDoRetorno, type RascunhoRetorno } from './retorno'

const H = { data: '2026-12-05', inicio: '14:00', modalidade: 'presencial' as const }
const SIM_SEM_HORARIO: RascunhoRetorno = { escolha: 'sim', marcado: null }
const SIM_COM_HORARIO: RascunhoRetorno = { escolha: 'sim', marcado: H }

describe('rascunho do retorno (nada vai ao servidor até Finalizar)', () => {
  it('começa em "Não" (sem retorno)', () => {
    expect(RASCUNHO_INICIAL).toEqual({ escolha: 'nao' })
    expect(retornoParaEnvio(RASCUNHO_INICIAL)).toBeNull()
  })
  it('"Sim" sem horário não envia nada e impede salvar os anexos', () => {
    expect(retornoParaEnvio(SIM_SEM_HORARIO)).toBeNull()
    expect(podeSalvarAnexos(SIM_SEM_HORARIO)).toBe(false)
  })
  it('"Sim" com horário envia o horário e libera salvar', () => {
    expect(retornoParaEnvio(SIM_COM_HORARIO)).toEqual(H)
    expect(podeSalvarAnexos(SIM_COM_HORARIO)).toBe(true)
    expect(podeSalvarAnexos(RASCUNHO_INICIAL)).toBe(true)
  })
  it('voltar de "Sim" para "Não" descarta o horário: o corpo vai com retornoMarcado nulo', () => {
    const r = escolher(SIM_COM_HORARIO, 'nao')
    expect(r).toEqual({ escolha: 'nao' })
    expect(retornoParaEnvio(r)).toBeNull()
  })
  it('escolher "Sim" de novo não traz o horário antigo; escolher "Sim" estando em "Sim" mantém o horário', () => {
    expect(escolher({ escolha: 'nao' }, 'sim')).toEqual(SIM_SEM_HORARIO)
    expect(escolher(SIM_COM_HORARIO, 'sim')).toEqual(SIM_COM_HORARIO)
  })
  it('horarioEscolhido guarda o horário no "Sim"', () => {
    expect(horarioEscolhido(SIM_SEM_HORARIO, H)).toEqual(SIM_COM_HORARIO)
    expect(horarioEscolhido(RASCUNHO_INICIAL, H)).toEqual(SIM_COM_HORARIO)
  })
  it('texto para a tela', () => {
    expect(textoDoRetorno(H)).toBe('05/12/2026 às 14:00, presencial')
  })
})
