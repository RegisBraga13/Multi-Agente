// Agenda de exemplo da página inicial do módulo (Dra. Ana Souza, dermatologia).
// Pacientes fictícios; nada vem do banco ainda. Determinística: mesma data, mesma lista.
import { dataLocal } from '../medico/exemplo'
import type { EstadoCivil } from '../medico/regras'
import type { Modalidade } from '../medico/tipos'
import { ordenarPorHorario, paraData } from './dia'
import type { Atendimento, Ficha, TipoAtendimento } from './tipos'

// Pacientes fictícios com o que cada um escreveria na ficha da pré-consulta.
type Conteudo = { sexo: 'F' | 'M'; estadoCivil: EstadoCivil | ''; profissao: string; queixa: string; emUso: string[]; antecedentes: string[]; alergias: { substancia: string; reacao: string }[] }
const PACIENTES: { nome: string; nascimento: string; ficha: Conteudo }[] = [
  { nome: 'Mariana Costa', nascimento: '1992-03-14', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Espinhas no rosto e nas costas há 6 meses, piora antes da menstruação.', emUso: ['Anticoncepcional oral'], antecedentes: [], alergias: [] } },
  { nome: 'João Pedro Lima', nascimento: '1974-08-02', ficha: { sexo: 'M', estadoCivil: 'casado', profissao: 'Comerciante', queixa: 'Placas vermelhas com descamação nos cotovelos e joelhos.', emUso: ['Losartana 50 mg, 1x ao dia'], antecedentes: ['Pressão alta'], alergias: [{ substancia: 'Dipirona', reacao: 'inchaço no rosto' }] } },
  { nome: 'Beatriz Almeida', nascimento: '2008-05-21', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Cravos e espinhas na testa há 1 ano.', emUso: [], antecedentes: [], alergias: [] } },
  { nome: 'Carlos Henrique Rocha', nascimento: '1961-11-30', ficha: { sexo: 'M', estadoCivil: '', profissao: '', queixa: 'Pinta nas costas que mudou de cor e cresceu.', emUso: ['Metformina 850 mg, 2x ao dia', 'Sinvastatina 20 mg'], antecedentes: ['Diabetes', 'Colesterol alto'], alergias: [] } },
  { nome: 'Fernanda Oliveira', nascimento: '1988-01-09', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Manchas escuras no rosto depois da gravidez.', emUso: [], antecedentes: [], alergias: [{ substancia: 'Penicilina', reacao: 'placas pelo corpo' }] } },
  { nome: 'Rafael Monteiro', nascimento: '1996-07-17', ficha: { sexo: 'M', estadoCivil: '', profissao: '', queixa: 'Queda de cabelo nas entradas há 2 anos.', emUso: [], antecedentes: [], alergias: [] } },
  { nome: 'Luíza Fernandes', nascimento: '1979-12-03', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Vermelhidão e ardor no rosto, piora com sol e calor.', emUso: ['Levotiroxina 50 mcg'], antecedentes: ['Hipotireoidismo'], alergias: [] } },
  { nome: 'Antônio Barbosa', nascimento: '1953-04-26', ficha: { sexo: 'M', estadoCivil: '', profissao: '', queixa: 'Ferida no nariz que não cicatriza há 3 meses.', emUso: ['AAS 100 mg', 'Atenolol 25 mg'], antecedentes: ['Pressão alta', 'Infarto em 2019'], alergias: [{ substancia: 'Sulfa', reacao: 'falta de ar' }] } },
  { nome: 'Camila Sampaio', nascimento: '2001-09-12', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Coceira e bolinhas nas mãos, piora ao lavar louça.', emUso: [], antecedentes: ['Rinite'], alergias: [] } },
  { nome: 'Gustavo Nogueira', nascimento: '1985-06-05', ficha: { sexo: 'M', estadoCivil: '', profissao: '', queixa: 'Unha do pé grossa e amarelada há 1 ano.', emUso: [], antecedentes: [], alergias: [] } },
  { nome: 'Helena Martins', nascimento: '1969-02-19', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Manchas vermelhas no braço que coçam, há 3 semanas.', emUso: ['Losartana 50 mg, 1x ao dia'], antecedentes: ['Pressão alta'], alergias: [{ substancia: 'Dipirona', reacao: 'inchaço no rosto' }] } },
  { nome: 'Pedro Cavalcante', nascimento: '2012-10-08', ficha: { sexo: 'M', estadoCivil: '', profissao: '', queixa: 'Verrugas nos dedos das mãos.', emUso: [], antecedentes: [], alergias: [] } },
  { nome: 'Juliana Teixeira', nascimento: '1990-08-27', ficha: { sexo: 'F', estadoCivil: '', profissao: '', queixa: 'Caspa e coceira no couro cabeludo.', emUso: [], antecedentes: [], alergias: [] } },
]

// Cada horário do dia com o tipo, a modalidade, o pagamento, a situação da ficha e se já tem prontuário.
type Vaga = { inicio: string; tipo: TipoAtendimento; modalidade: Modalidade; pagamento: string; ficha: Ficha['situacao']; historico: boolean }
const VAGAS: Vaga[] = [
  { inicio: '08:00', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Unimed', ficha: 'pronta', historico: false },
  { inicio: '08:30', tipo: 'retorno', modalidade: 'presencial', pagamento: 'Particular', ficha: 'pronta', historico: true },
  { inicio: '09:00', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Hapvida', ficha: 'link-enviado', historico: false },
  { inicio: '09:30', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Particular', ficha: 'pronta', historico: true },
  { inicio: '10:00', tipo: 'retorno', modalidade: 'presencial', pagamento: 'SulAmérica', ficha: 'pronta', historico: true },
  { inicio: '11:00', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Particular', ficha: 'pronta', historico: false },
  { inicio: '14:00', tipo: 'consulta', modalidade: 'online', pagamento: 'Particular', ficha: 'link-enviado', historico: false },
  { inicio: '15:00', tipo: 'retorno', modalidade: 'online', pagamento: 'Camed', ficha: 'sem-ficha', historico: true },
  { inicio: '16:00', tipo: 'consulta', modalidade: 'presencial', pagamento: 'Bradesco Saúde', ficha: 'pronta', historico: false },
]

/** Hora em que a ficha chegou (exemplo: 1 h antes do horário). */
function chegada(inicio: string): string {
  const h = Number(inicio.slice(0, 2)) - 1
  return `${String(h).padStart(2, '0')}:${inicio.slice(3)}`
}

function fichaDe(v: Vaga, c: Conteudo, i: number): Ficha {
  if (v.ficha !== 'pronta') return { situacao: v.ficha }
  return { situacao: 'pronta', recebidaAs: chegada(v.inicio), ...c, transcricao: i % 4 === 3 ? 'recusada' : 'aceita' }
}

/** Sábado: só as manhãs, presencial (como na agenda da página do médico). */
const VAGAS_SABADO = VAGAS.slice(0, 4)

function horaLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function agendaDoDia(data: string, agora: Date): Atendimento[] {
  const d = paraData(data)
  const semana = d.getDay()
  if (semana === 0) return []
  const vagas = semana === 6 ? VAGAS_SABADO : VAGAS
  const hoje = dataLocal(agora)
  const hora = horaLocal(agora)
  const giro = d.getDate() // troca os pacientes de um dia para o outro
  return ordenarPorHorario(
    vagas.map((v, i) => {
      const p = PACIENTES[(i + giro) % PACIENTES.length]
      return {
        id: `${data}-${v.inicio}`,
        inicio: v.inicio,
        paciente: { nome: p.nome, nascimento: p.nascimento },
        tipo: v.tipo,
        modalidade: v.modalidade,
        pagamento: v.pagamento,
        ficha: fichaDe(v, p.ficha, i),
        atendido: data < hoje || (data === hoje && v.inicio < hora),
        temHistorico: v.historico,
      }
    }),
  )
}
