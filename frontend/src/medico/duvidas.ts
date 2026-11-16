// Perguntas frequentes da página do médico. Textos do autor (15/11/2026).
// As comuns valem para todas as especialidades; o pacote de cada uma pode acrescentar as suas.
// Regra: sempre "seu médico", sem gênero nem especialidade.

export type Duvida = {
  id: string
  pergunta: string
  resposta: string
  /** botão junto da resposta */
  acao?: 'whatsapp-consultorio' | 'lista-convenios'
}

const COMUNS: Duvida[] = [
  {
    id: 'reserva', pergunta: 'O horário fica reservado imediatamente?',
    resposta: 'Você escolhe o horário disponível e recebe a confirmação do consultório após a validação do agendamento.',
  },
  {
    id: 'convenios', pergunta: 'Quais convênios são atendidos?', acao: 'lista-convenios',
    resposta: 'Atendimento particular e pelos convênios abaixo. O consultório confirma a cobertura pelo WhatsApp.',
  },
  {
    id: 'remarcar', pergunta: 'Posso cancelar ou remarcar?', acao: 'whatsapp-consultorio',
    resposta: 'Sim. Fale com o consultório para solicitar uma alteração, conforme a política de agendamento.',
  },
  {
    id: 'online', pergunta: 'Como funciona a consulta online?',
    resposta: 'Você é atendido por videochamada, com avaliação e orientações médicas. Quando necessário, seu médico poderá recomendar um exame presencial.',
  },
  {
    id: 'preencher', pergunta: 'Preciso preencher meus dados antes?',
    resposta: 'Antecipar algumas informações pelo site ou WhatsApp agiliza o atendimento, e seu médico terá mais tempo para se aprofundar no seu caso. Mas você também pode fornecê-las durante a consulta.',
  },
  {
    id: 'protecao', pergunta: 'Minhas informações de saúde ficam protegidas?',
    resposta: 'Seus dados são tratados com confidencialidade e conforme a legislação de proteção de dados.',
  },
  {
    id: 'medico_ou_ia', pergunta: 'A consulta é realizada por um médico ou pela IA?',
    resposta: 'Pelo seu médico. A inteligência artificial é utilizada apenas como ferramenta de apoio, sem substituir a avaliação e as decisões médicas.',
  },
  {
    id: 'receita', pergunta: 'A consulta online permite receita médica?',
    resposta: 'Sim, quando clinicamente indicado. Seu médico poderá emitir uma prescrição digital conforme as normas aplicáveis.',
  },
  {
    id: 'valor', pergunta: 'Qual é o valor da consulta?',
    resposta: 'O valor e as formas de pagamento são informados antes da confirmação do agendamento.',
  },
  {
    id: 'retorno', pergunta: 'A consulta oferece retorno?',
    resposta: 'Sim. Os prazos para retorno são informados após a consulta.',
  },
]

/** Perguntas próprias de cada especialidade, cada uma entrando logo depois da pergunta comum indicada. */
const PACOTES: Partial<Record<string, { depoisDe: string; duvida: Duvida }[]>> = {
  dermatologia: [
    {
      depoisDe: 'medico_ou_ia',
      duvida: {
        id: 'fotos', pergunta: 'Posso enviar fotos das lesões antes da consulta?',
        resposta: 'Sim, o formulário disponibiliza esse recurso. As imagens podem auxiliar na avaliação médica, mas não substituem o exame clínico.',
      },
    },
  ],
}

export function duvidasDaPagina(especialidade: string): Duvida[] {
  const lista = [...COMUNS]
  for (const { depoisDe, duvida } of PACOTES[especialidade] ?? []) {
    lista.splice(lista.findIndex((d) => d.id === depoisDe) + 1, 0, duvida)
  }
  return lista
}

/** Número já normalizado ('55' + DDD + número) → link que abre a conversa no WhatsApp, com a mensagem pronta se houver. */
export const linkWhatsapp = (numero: string, texto?: string) =>
  `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
