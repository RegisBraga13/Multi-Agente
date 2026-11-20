import { describe, expect, it } from 'vitest'
import type { ExameRegistro } from '../prontuario/registro'
import type { Complementar } from './exemplo'
import { tabelaDeExames } from './exames-tabela'

const antes: ExameRegistro[] = [
  { exame: 'Exames laboratoriais', nome: 'Glicemia de jejum', valor: '98 mg/dL', status: 'PRESENT', data: '10/09/2026', origem: 'a.pdf' },
  { exame: 'Exames laboratoriais', nome: 'TGO', valor: '24 U/L', status: 'PRESENT', data: '10/09/2026', origem: 'a.pdf' },
]
const hoje: Complementar[] = [{
  exame: 'Exames laboratoriais', data: '12/11/2026', origem: 'b.pdf',
  itens: [
    { nome: 'Glicemia de jejum', v: { status: 'PRESENT', valor: '101 mg/dL', origem: 'pág. 1' } },
    { nome: 'TGP', v: { status: 'PRESENT', valor: '33 U/L', origem: 'pág. 1' } },
    { nome: 'TGO', v: { status: 'MISSING', valor: null } },
  ],
}]

describe('tabelaDeExames', () => {
  it('uma coluna por data (da mais antiga para a mais nova) e uma linha por exame', () => {
    expect(tabelaDeExames(antes, hoje)).toEqual({
      datas: ['10/09/2026', '12/11/2026'],
      linhas: [
        { nome: 'Glicemia de jejum', valores: ['98 mg/dL', '101 mg/dL'] },
        { nome: 'TGO', valores: ['24 U/L', null] },
        { nome: 'TGP', valores: [null, '33 U/L'] },
      ],
    })
  })
  it('sem nenhum exame com resultado, não há tabela', () => {
    expect(tabelaDeExames([], [])).toBeNull()
    expect(tabelaDeExames([{ ...antes[0], valor: null }], [])).toBeNull()
  })
})
