// Agenda de exemplo da página inicial do módulo (Dra. Ana Souza, dermatologia).
// Pacientes fictícios; nada vem do banco ainda. Determinística: mesma data, mesma lista.
import { dataLocal } from '../medico/exemplo'
import type { Modalidade } from '../medico/tipos'
import { ordenarPorHorario, paraData } from './dia'
import type { Atendimento, TipoAtendimento } from './tipos'

const PACIENTES = [
  { nome: 'Mariana Costa', nascimento: '1992-03-14' },
  { nome: 'João Pedro Lima', nascimento: '1974-08-02' },
  { nome: 'Beatriz Almeida', nascimento: '2008-05-21' },
  { nome: 'Carlos Henrique Rocha', nascimento: '1961-11-30' },
  { nome: 'Fernanda Oliveira', nascimento: '1988-01-09' },
  { nome: 'Rafael Monteiro', nascimento: '1996-07-17' },
  { nome: 'Luíza Fernandes', nascimento: '1979-12-03' },
  { nome: 'Antônio Barbosa', nascimento: '1953-04-26' },
  { nome: 'Camila Sampaio', nascimento: '2001-09-12' },
  { nome: 'Gustavo Nogueira', nascimento: '1985-06-05' },
  { nome: 'Helena Martins', nascimento: '1969-02-19' },
  { nome: 'Pedro Cavalcante', nascimento: '2012-10-08' },
  { nome: 'Juliana Teixeira', nascimento: '1990-08-27' },
]

// Cada horário do dia com o tipo, a modalidade, o formulário e se já tem prontuário.
type Vaga = { inicio: string; tipo: TipoAtendimento; modalidade: Modalidade; formulario: 'preenchido' | 'pendente'; historico: boolean }
const VAGAS: Vaga[] = [
  { inicio: '08:00', tipo: 'consulta', modalidade: 'presencial', formulario: 'preenchido', historico: false },
  { inicio: '08:30', tipo: 'retorno', modalidade: 'presencial', formulario: 'preenchido', historico: true },
  { inicio: '09:00', tipo: 'consulta', modalidade: 'presencial', formulario: 'pendente', historico: false },
  { inicio: '09:30', tipo: 'consulta', modalidade: 'presencial', formulario: 'preenchido', historico: true },
  { inicio: '10:00', tipo: 'retorno', modalidade: 'presencial', formulario: 'preenchido', historico: true },
  { inicio: '11:00', tipo: 'consulta', modalidade: 'presencial', formulario: 'pendente', historico: false },
  { inicio: '14:00', tipo: 'consulta', modalidade: 'online', formulario: 'preenchido', historico: false },
  { inicio: '15:00', tipo: 'retorno', modalidade: 'online', formulario: 'pendente', historico: true },
  { inicio: '16:00', tipo: 'consulta', modalidade: 'presencial', formulario: 'preenchido', historico: false },
]

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
    vagas.map((v, i) => ({
      id: `${data}-${v.inicio}`,
      inicio: v.inicio,
      paciente: PACIENTES[(i + giro) % PACIENTES.length],
      tipo: v.tipo,
      modalidade: v.modalidade,
      formulario: v.formulario,
      atendido: data < hoje || (data === hoje && v.inicio < hora),
      temHistorico: v.historico,
    })),
  )
}
