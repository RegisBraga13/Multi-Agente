import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { gerarAgenda } from '../medico/exemplo'
import { EscolhaRetorno } from './retorno-pagina'

const agenda = gerarAgenda(new Date(2026, 10, 22))
const html = (valor: Parameters<typeof EscolhaRetorno>[0]['valor']) =>
  renderToStaticMarkup(<EscolhaRetorno valor={valor} onMudar={() => {}} agenda={agenda} atendeOnline />)

describe('EscolhaRetorno', () => {
  it('"Não" marcado: sem dia escolhido, agenda fechada', () => {
    const h = html({ escolha: 'nao' })
    expect(h).toContain('Retorno')
    expect(h).toMatch(/aria-pressed="true"[^>]*>Não/)
    expect(h).not.toContain('Escolher dia e horário')
    expect(h).not.toContain('role="dialog"')
  })
  it('"Sim" sem horário pede o dia e o horário', () => {
    expect(html({ escolha: 'sim', marcado: null })).toContain('Escolher dia e horário')
  })
  it('"Sim" com horário mostra dia, hora e modalidade', () => {
    expect(html({ escolha: 'sim', marcado: { data: '2026-12-05', inicio: '14:00', modalidade: 'presencial' } })).toContain('05/12/2026 às 14:00, presencial')
  })
})
