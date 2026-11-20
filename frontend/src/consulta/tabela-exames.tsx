// Exames realizados, por data: uma coluna por data, uma linha por exame (só leitura).
// Usada na História da evolução e no Prontuário (que guarda e atualiza a tabela a cada consulta ou retorno).
import type { TabelaExames } from './exames-tabela'

const ROTULO = 'text-[10.5px] font-bold tracking-[0.14em] text-historia-rotulo uppercase'

export function TabelaDeExames({ tabela, className = '' }: { tabela: TabelaExames; className?: string }) {
  return (
    <table className={`w-full border-collapse text-left text-[13.5px] ${className}`} aria-label="Exames por data">
      <thead>
        <tr className="border-b border-historia-borda">
          <th className={`${ROTULO} py-1 pr-3 font-bold`}>Exame</th>
          {tabela.datas.map((d) => <th key={d} className={`${ROTULO} px-3 py-1 font-bold`}>{d}</th>)}
        </tr>
      </thead>
      <tbody>
        {tabela.linhas.map((l) => (
          <tr key={l.nome} className="border-b border-historia-borda/50">
            <th className="py-0.5 pr-3 font-semibold">{l.nome}</th>
            {l.valores.map((v, i) => <td key={i} className="px-3 py-0.5">{v ?? '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
