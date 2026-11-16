import { describe, expect, it } from 'vitest'
import { ESPECIALIDADES, buscarEspecialidade } from './especialidades'
import { estiloAlergia } from './alergia'

describe('estiloAlergia', () => {
  it('especialidade com cor parecida com o vermelho da alergia: fundo branco, texto e borda vermelhos', () => {
    expect(estiloAlergia(buscarEspecialidade('dermatologia')!)).toContain('bg-branco')
    expect(estiloAlergia(buscarEspecialidade('dermatologia')!)).toContain('text-alerta-clinico')
    expect(estiloAlergia(buscarEspecialidade('dermatologia')!)).not.toContain('border-alerta-clinico') // só as letras em vermelho
  })
  it('demais especialidades: bloco vermelho cheio com texto branco', () => {
    expect(estiloAlergia(buscarEspecialidade('geriatria')!)).toContain('bg-alerta-clinico')
    expect(estiloAlergia(buscarEspecialidade('geriatria')!)).toContain('text-branco')
  })
  it('só dermatologia, cardiologia e pediatria têm cor parecida', () => {
    expect(ESPECIALIDADES.filter((e) => e.alergiaContornada).map((e) => e.slug).sort()).toEqual(['cardiologia', 'dermatologia', 'pediatria'])
  })
})
