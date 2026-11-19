// Identificação do paciente (a página inicial do formulário, obrigatória). Usada pelo paciente no celular
// e pelo médico no computador, quando o paciente escolheu "preencher na consulta".
import { UFS } from '../cadastro/validacao'
import { Campo } from './campo'
import { classeEntrada } from './estilos'
import { calcularIdade, type DadosPessoais } from './regras'

type Props = {
  dados: DadosPessoais
  erros: Partial<Record<keyof DadosPessoais, string>>
  muda: <K extends keyof DadosPessoais>(campo: K, valor: DadosPessoais[K]) => void
}

// Campos com a largura do que cabem neles: data, sexo, WhatsApp e UF estreitos;
// nome, e-mail e cidade crescem e ocupam o espaço que sobra na linha.
export function CamposIdentificacao({ dados, erros, muda }: Props) {
  const idade = calcularIdade(dados.nascimento, new Date())
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-3 sm:gap-x-4">
      <div className="min-w-[13rem] flex-1">
        <Campo rotulo="Nome completo" erro={erros.nomeCompleto}>
          {(p) => <input {...p} autoComplete="name" value={dados.nomeCompleto} onChange={(e) => muda('nomeCompleto', e.target.value)} className={classeEntrada(p)} />}
        </Campo>
      </div>
      <div className="min-w-[13rem] flex-1">
        <Campo rotulo="Nome social (opcional)">
          {(p) => <input {...p} autoComplete="nickname" value={dados.nomeSocial} onChange={(e) => muda('nomeSocial', e.target.value)} className={classeEntrada(p)} />}
        </Campo>
      </div>
      <div className="w-[9.5rem]">
        <Campo rotulo="Nascimento" erro={erros.nascimento} ajuda={idade !== null ? `${idade} ${idade === 1 ? 'ano' : 'anos'}` : undefined}>
          {/* no iPad (Safari) o campo de data tem largura própria: min-w-0 o mantém dentro da caixa */}
          {(p) => <input {...p} type="date" autoComplete="bday" value={dados.nascimento} onChange={(e) => muda('nascimento', e.target.value)} className={`${classeEntrada(p)} min-w-0 appearance-none`} />}
        </Campo>
      </div>
      <div className="w-[8rem]">
        <Campo rotulo="Sexo" erro={erros.sexo}>
          {(p) => (
            <select {...p} value={dados.sexo} onChange={(e) => muda('sexo', e.target.value as DadosPessoais['sexo'])} className={classeEntrada(p)}>
              <option value="">Escolha</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="I">Intersexo</option>
            </select>
          )}
        </Campo>
      </div>
      <div className="w-[10rem]">
        <Campo rotulo="WhatsApp" erro={erros.whatsapp}>
          {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" value={dados.whatsapp} onChange={(e) => muda('whatsapp', e.target.value)} className={classeEntrada(p)} />}
        </Campo>
      </div>
      <div className="min-w-[13rem] flex-1">
        <Campo rotulo="E-mail (opcional)" erro={erros.email}>
          {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={dados.email} onChange={(e) => muda('email', e.target.value)} className={classeEntrada(p)} />}
        </Campo>
      </div>
      {/* Cidade e UF sempre juntas na mesma linha; a cidade cresce */}
      <div className="flex min-w-[15rem] flex-1 gap-3">
        <div className="min-w-0 flex-1">
          <Campo rotulo="Cidade" erro={erros.cidade}>
            {(p) => <input {...p} autoComplete="address-level2" value={dados.cidade} onChange={(e) => muda('cidade', e.target.value)} className={classeEntrada(p)} />}
          </Campo>
        </div>
        <div className="w-[5.5rem] flex-none">
          <Campo rotulo="UF" erro={erros.uf}>
            {(p) => (
              <select {...p} value={dados.uf} onChange={(e) => muda('uf', e.target.value)} className={classeEntrada(p)}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u}>{u}</option>)}
              </select>
            )}
          </Campo>
        </div>
      </div>
    </div>
  )
}
