import { describe, expect, it } from 'vitest'
import { ESPECIALIDADES } from '../especialidades'
import { duvidasDaPagina, linkWhatsapp } from './duvidas'

describe('duvidasDaPagina', () => {
  it('dermatologia: perguntas comuns e a das fotos logo depois de médico ou IA; sem a da gravação', () => {
    const ids = duvidasDaPagina('dermatologia').map((d) => d.id)
    expect(ids).toEqual(['reserva', 'remarcar', 'online', 'preencher', 'protecao', 'medico_ou_ia', 'fotos', 'receita', 'valor', 'retorno'])
  })

  it('especialidade sem pacote próprio fica só com as comuns', () => {
    const ids = duvidasDaPagina('cardiologia').map((d) => d.id)
    expect(ids).not.toContain('fotos')
    expect(ids).toHaveLength(9)
  })

  it('textos sem gênero nem especialidade: sempre "seu médico"', () => {
    for (const e of ESPECIALIDADES) {
      for (const d of duvidasDaPagina(e.slug)) {
        const t = `${d.pergunta} ${d.resposta}`
        expect(t).not.toMatch(/dermatolog|(^|\s)(a|o|sua) médic[oa]\b|\bnosso\b/i)
      }
    }
  })

  it('remarcar oferece o WhatsApp do consultório; proteção com o texto do autor', () => {
    const d = Object.fromEntries(duvidasDaPagina('dermatologia').map((x) => [x.id, x]))
    expect(d.remarcar.acao).toBe('whatsapp-consultorio')
    expect(d.protecao.resposta).toBe('Seus dados são tratados com confidencialidade e conforme a legislação de proteção de dados.')
  })
})

describe('linkWhatsapp', () => {
  it('monta o link do WhatsApp com o número normalizado', () => {
    expect(linkWhatsapp('5585912345678')).toBe('https://wa.me/5585912345678')
  })
  it('leva a mensagem pronta, codificada', () => {
    expect(linkWhatsapp('5585912345678', 'Olá, *Ana*\n2 fotos & mais')).toBe('https://wa.me/5585912345678?text=Ol%C3%A1%2C%20*Ana*%0A2%20fotos%20%26%20mais')
  })
})
