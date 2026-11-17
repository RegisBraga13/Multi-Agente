// Conduta de exemplo (Dermatologia), por diagnóstico (id da hipótese). Simula a IA.
// Grupos 1–3 e as opções vêm da landing (index.html, CONDG/CONDT). O antigo "Seguimento" virou
// "4. Orientações": orientações gerais + solicitação de exames, data de retorno e encaminhamento.
// As regras leem só o "Para relembrar" (texto do item + marca V/F).
import type { ModeloConduta } from './conduta'

const ACNE: ModeloConduta = {
  grupos: [
    {
      id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
        { id: 'oleosa', rotulo: 'Rotina para pele oleosa/acneica', texto: 'Rotina para pele oleosa/acneica. Limpeza suave 2×/dia, hidratante não comedogênico e fotoproteção oil-free. Evitar espremer pápulas e pústulas.' },
        { id: 'sensivel', rotulo: 'Rotina para pele sensível', texto: 'Rotina para pele sensível. Limpeza suave 1×/dia, hidratante calmante não comedogênico e fotoproteção oil-free.' },
      ] }],
    },
    {
      id: 'topico', rotulo: '2. Tratamento tópico', linhas: [{ id: 'topico', rotulo: null, opcoes: [
        { id: 'adapaleno-bpo', rotulo: 'Adapaleno + peróxido de benzoíla', texto: 'Adapaleno + peróxido de benzoíla. Combinação preferencial; uso noturno, conforme tolerância.' },
        { id: 'bpo-clinda', rotulo: 'Peróxido de benzoíla + clindamicina', texto: 'Peróxido de benzoíla + clindamicina. Uso noturno, conforme tolerância.' },
        { id: 'tretinoina-clinda', rotulo: 'Tretinoína + clindamicina', texto: 'Tretinoína + clindamicina. Uso noturno, conforme tolerância.' },
        { id: 'azelaico', rotulo: 'Ácido azelaico', texto: 'Ácido azelaico. Uso 2×/dia, conforme tolerância; sem retinoide tópico.' },
        { id: 'bpo', rotulo: 'Peróxido de benzoíla isolado', texto: 'Peróxido de benzoíla isolado. Uso noturno, conforme tolerância.' },
        { id: 'adapaleno', rotulo: 'Adapaleno isolado', texto: 'Adapaleno isolado. Uso noturno, conforme tolerância.' },
      ] }],
    },
    {
      id: 'sistemico', rotulo: '3. Tratamento sistêmico', linhas: [{ id: 'sistemico', rotulo: null, opcoes: [
        { id: 'doxiciclina', rotulo: 'Doxiciclina oral', texto: 'Doxiciclina oral, associada ao tratamento tópico.' },
        { id: 'limeciclina', rotulo: 'Limeciclina oral', texto: 'Limeciclina oral, associada ao tratamento tópico.' },
        { id: 'aco', rotulo: 'Anticoncepcional combinado', texto: 'Anticoncepcional combinado.' },
        { id: 'espironolactona', rotulo: 'Espironolactona', texto: 'Espironolactona.' },
        { id: 'isotretinoina', rotulo: 'Isotretinoína oral', texto: 'Isotretinoína oral.' },
      ] }],
    },
    {
      id: 'orientacoes', rotulo: '4. Orientações',
      fixo: 'Não manipular lesões inflamatórias. Ajustar frequência conforme tolerabilidade cutânea.',
      linhas: [
        // além do kit de rotina (posto em todo diagnóstico): um exame do caso; nada marcado = não solicitar
        { id: 'exames', rotulo: 'Exames', opcoes: [
          { id: 'hormonal', rotulo: 'Perfil hormonal', texto: 'Solicito perfil hormonal.' },
        ] },
        { id: 'retorno', rotulo: 'Retorno', opcoes: [
          { id: '4s', rotulo: '4 semanas', texto: 'Retorno em 4 semanas.', dias: 28 },
          { id: '8s', rotulo: '8 semanas', texto: 'Retorno em 8 semanas.', dias: 56 },
          { id: '12s', rotulo: '12 semanas', texto: 'Retorno em 12 semanas.', dias: 84 },
        ] },
        // mais de um especialista; nada marcado = sem encaminhamento
        { id: 'encaminhamento', rotulo: 'Encaminhamento', prefixo: 'Encaminho para', opcoes: [
          { id: 'gineco', rotulo: 'Ginecologia', texto: 'ginecologia' },
          { id: 'endocrino', rotulo: 'Endocrinologia', texto: 'endocrinologia' },
        ] },
      ],
    },
  ],
  regras: [
    // planeja gravidez: sem retinoide tópico — o ácido azelaico vem primeiro
    { item: 'Planeja gravidez', marca: 'v', linha: 'topico', opcoes: ['azelaico'] },
    // sinais de hiperandrogenismo: investigar (perfil hormonal e ginecologia vêm primeiro)
    { item: 'Irregularidade menstrual ou excesso de pelos', marca: 'v', linha: 'exames', opcoes: ['hormonal'] },
    { item: 'Irregularidade menstrual ou excesso de pelos', marca: 'v', linha: 'encaminhamento', opcoes: ['gineco'] },
  ],
}

export const CONDUTAS: Record<string, ModeloConduta> = { acne: ACNE }
