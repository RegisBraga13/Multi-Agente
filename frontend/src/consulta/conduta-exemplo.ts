// Conduta de exemplo (Dermatologia), por diagnóstico (id da hipótese). Simula a IA.
// Grupos 1–3 e as opções vêm da landing (index.html, CONDG/CONDT). O antigo "Seguimento" virou
// "4. Orientações": orientações gerais + solicitação de exames, data de retorno e encaminhamento.
// As regras leem só o "Para relembrar" (texto do item + marca V/F).
import type { ItemReceita, ModeloConduta } from './conduta'

// itens da receita: nome (DCB), forma (sigla oficial; sem sigla, por extenso), concentração (sem espaço: 300mg),
// quantidade (n, unidade abreviada, feminino?, controlado?), posologia (via abreviada: VO). Valores de exemplo.
type Q = [number, string, boolean, boolean?]
const topico = (nome: string, forma: string, concentracao: string, [n, unidade, feminino, controlado]: Q, posologia: string): ItemReceita =>
  ({ nome, forma, concentracao, quantidade: { n, unidade, feminino }, via: 'topico', posologia, ...(controlado ? { controlado } : {}) })
const oral = (nome: string, forma: string, concentracao: string, [n, unidade, feminino, controlado]: Q, posologia: string): ItemReceita =>
  ({ nome, forma, concentracao, quantidade: { n, unidade, feminino }, via: 'oral', posologia, ...(controlado ? { controlado } : {}) })
const NOITE = 'à noite, sobre a pele limpa e seca, evitando olhos, cantos do nariz e lábios, por 8 semanas.'

const ACNE: ModeloConduta = {
  grupos: [
    {
      id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
        { id: 'oleosa', rotulo: 'Rotina para pele oleosa/acneica', texto: 'Rotina para pele oleosa/acneica. Limpeza suave 2×/dia, hidratante não comedogênico e fotoproteção oil-free. Evitar espremer pápulas e pústulas.', receita: [
          topico('Sabonete facial para pele oleosa/acneica', 'GEL', '', [1, 'fr.', false], 'Lavar o rosto 2 vezes ao dia (manhã e noite) e enxaguar bem.'),
          topico('Hidratante facial não comedogênico', 'gel-creme', '', [1, 'bisn.', true], 'Aplicar fina camada no rosto pela manhã, após a limpeza.'),
          topico('Protetor solar facial toque seco', 'loção', 'FPS 50', [1, 'fr.', false], 'Aplicar no rosto pela manhã; reaplicar a cada 2 - 3h se exposto ao sol.'),
        ] },
        { id: 'sensivel', rotulo: 'Rotina para pele sensível', texto: 'Rotina para pele sensível. Limpeza suave 1×/dia, hidratante calmante não comedogênico e fotoproteção oil-free.', receita: [
          topico('Sabonete facial para pele sensível', 'GEL', '', [1, 'fr.', false], 'Lavar o rosto 1 vez ao dia, à noite, com água fria ou morna.'),
          topico('Hidratante facial calmante não comedogênico', 'CREM', '', [1, 'bisn.', true], 'Aplicar fina camada no rosto 2 vezes ao dia (manhã e noite), se houver ressecamento.'),
          topico('Protetor solar facial mineral', 'loção', 'FPS 50', [1, 'fr.', false], 'Aplicar no rosto pela manhã; reaplicar a cada 2 - 3h se exposto ao sol.'),
        ] },
      ] }],
    },
    {
      id: 'topico', rotulo: '2. Tratamento tópico', linhas: [{ id: 'topico', rotulo: null, opcoes: [
        { id: 'adapaleno-bpo', rotulo: 'Adapaleno + peróxido de benzoíla', texto: 'Adapaleno + peróxido de benzoíla. Combinação preferencial; uso noturno, conforme tolerância.',
          receita: [topico('Adapaleno + peróxido de benzoíla', 'GEL', '0,1% + 2,5%', [1, 'bisn. 30g', true], `Aplicar camada fina no rosto ${NOITE}`)] },
        { id: 'bpo-clinda', rotulo: 'Peróxido de benzoíla + clindamicina', texto: 'Peróxido de benzoíla + clindamicina. Uso noturno, conforme tolerância.',
          receita: [topico('Peróxido de benzoíla + fosfato de clindamicina', 'GEL', '5% + 1%', [1, 'bisn. 25g', true], `Aplicar camada fina nas áreas com lesões ${NOITE}`)] },
        { id: 'tretinoina-clinda', rotulo: 'Tretinoína + clindamicina', texto: 'Tretinoína + clindamicina. Uso noturno, conforme tolerância.',
          receita: [topico('Tretinoína + fosfato de clindamicina', 'GEL', '0,025% + 1%', [1, 'bisn. 30g', true], `Aplicar camada fina no rosto ${NOITE}`)] },
        { id: 'azelaico', rotulo: 'Ácido azelaico', texto: 'Ácido azelaico. Uso 2×/dia, conforme tolerância; sem retinoide tópico.',
          receita: [topico('Ácido azelaico', 'GEL', '15%', [1, 'bisn. 30g', true], 'Aplicar camada fina no rosto 2 vezes ao dia (manhã e noite), sobre a pele limpa e seca, por 8 semanas.')] },
        { id: 'bpo', rotulo: 'Peróxido de benzoíla isolado', texto: 'Peróxido de benzoíla isolado. Uso noturno, conforme tolerância.',
          receita: [topico('Peróxido de benzoíla', 'GEL', '5%', [1, 'bisn. 60g', true], `Aplicar camada fina nas áreas com lesões ${NOITE} Pode descolorir tecidos.`)] },
        { id: 'adapaleno', rotulo: 'Adapaleno isolado', texto: 'Adapaleno isolado. Uso noturno, conforme tolerância.',
          receita: [topico('Adapaleno', 'GEL', '0,1%', [1, 'bisn. 30g', true], `Aplicar camada fina no rosto ${NOITE}`)] },
      ] }],
    },
    {
      id: 'sistemico', rotulo: '3. Tratamento sistêmico', linhas: [{ id: 'sistemico', rotulo: null, opcoes: [
        { id: 'doxiciclina', rotulo: 'Doxiciclina oral', texto: 'Doxiciclina oral, associada ao tratamento tópico.',
          receita: [oral('Cloridrato de doxiciclina', 'COMP', '100mg', [56, 'COMP', false], 'Tomar 1 COMP VO, 1 vez ao dia, após uma refeição e com um copo de água, por 8 semanas.')] },
        { id: 'limeciclina', rotulo: 'Limeciclina oral', texto: 'Limeciclina oral, associada ao tratamento tópico.',
          receita: [oral('Limeciclina', 'CAP', '300mg', [56, 'CAP', true], 'Tomar 1 CAP VO, 1 vez ao dia, por 8 semanas.')] },
        { id: 'aco', rotulo: 'Anticoncepcional combinado', texto: 'Anticoncepcional combinado.',
          receita: [oral('Etinilestradiol + drospirenona', 'COMP', '0,03mg + 3mg', [2, 'cart. com 21 COMP', true], 'Tomar 1 COMP VO ao dia, sempre no mesmo horário, por 21 dias; pausa de 7 dias entre as cartelas.')] },
        { id: 'espironolactona', rotulo: 'Espironolactona', texto: 'Espironolactona.',
          receita: [oral('Espironolactona', 'COMP', '100mg', [30, 'COMP', false], 'Tomar 1 COMP VO, 1 vez ao dia, pela manhã, por 30 dias.')] },
        { id: 'isotretinoina', rotulo: 'Isotretinoína oral', texto: 'Isotretinoína oral.',
          receita: [oral('Isotretinoína', 'CAP', '20mg', [30, 'CAP', true, true], 'Tomar 1 CAP VO, 1 vez ao dia, junto com uma refeição, por 30 dias.')] },
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
