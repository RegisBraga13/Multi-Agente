import { describe, expect, it } from 'vitest'
import { rotuloDoBloco } from './historia-servidor'

describe('rotuloDoBloco (a mensagem do estado do bloco de perguntas)', () => {
  it('carregando', () => expect(rotuloDoBloco({ carregando: true, falhou: false, n: 0 })).toBe('A IA está pensando nas perguntas…'))
  it('falhou', () => expect(rotuloDoBloco({ carregando: false, falhou: true, n: 0 })).toBe('Não foi possível escrever as perguntas.'))
  it('sem perguntas para o caso', () => expect(rotuloDoBloco({ carregando: false, falhou: false, n: 0 })).toBe('Sem perguntas para este caso.'))
  it('com perguntas não há mensagem', () => expect(rotuloDoBloco({ carregando: false, falhou: false, n: 3 })).toBeNull())
})
