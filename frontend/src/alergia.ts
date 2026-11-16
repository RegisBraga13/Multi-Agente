// Alergia é o único aviso em vermelho. Quando a cor da especialidade é parecida com esse vermelho,
// a alergia vai em fundo branco, borda neutra e só as letras em vermelho, para não se confundir com a cor do módulo.
import type { Especialidade } from './especialidades'

export function estiloAlergia(esp: Especialidade): string {
  return esp.alergiaContornada ? 'border-[1.5px] border-linha bg-branco text-alerta-clinico' : 'bg-alerta-clinico text-branco'
}
