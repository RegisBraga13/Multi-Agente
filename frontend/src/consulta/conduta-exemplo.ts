// Conduta de exemplo (Dermatologia), por diagnóstico (id da hipótese). Simula a IA.
// Grupos 1–3 e as opções vêm da landing (index.html, CONDG/CONDT). O antigo "Seguimento" virou
// "4. Orientações": orientações gerais + solicitação de exames, data de retorno e encaminhamento.
// As regras leem só o "Para relembrar" (texto do item + marca V/F).
import type { ItemReceita, Linha, ModeloConduta } from './conduta'

// itens da receita: nome (DCB), forma (sigla oficial; sem sigla, por extenso), concentração (sem espaço: 300mg),
// quantidade (n, unidade abreviada, feminino?, controlado?), posologia (via abreviada: VO). Valores de exemplo.
// O tempo de tratamento sai do fim da posologia ("…, por 8 semanas." / "Uso contínuo.") e vai para o fim do item.
type Q = [number, string, boolean, boolean?]
function item(via: ItemReceita['via'], nome: string, forma: string, concentracao: string, [n, unidade, feminino, controlado]: Q, texto: string): ItemReceita {
  const m = texto.match(/,? por (\d+) (semanas|dias)\.$/) ?? texto.match(/ (Uso contínuo)\.$/)
  if (!m) throw new Error(`posologia sem tempo de tratamento: ${texto}`)
  const duracao = m[2] === 'semanas' ? `${m[1]}sem` : m[2] === 'dias' ? `${m[1]} dias` : 'uso contínuo'
  return { nome, forma, concentracao, quantidade: { n, unidade, feminino }, via, posologia: texto.slice(0, m.index).replace(/\.?$/, '.'), duracao, ...(controlado ? { controlado } : {}) }
}
const topico = (...a: [string, string, string, Q, string]) => item('topico', ...a)
const oral = (...a: [string, string, string, Q, string]) => item('oral', ...a)
const NOITE = 'à noite, sobre a pele limpa e seca, evitando olhos, cantos do nariz e lábios, por 8 semanas.'

const ACNE: ModeloConduta = {
  grupos: [
    {
      id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
        { id: 'oleosa', rotulo: 'Rotina para pele oleosa/acneica', texto: 'Rotina para pele oleosa/acneica. Limpeza suave 2×/dia, hidratante não comedogênico e fotoproteção oil-free. Evitar espremer pápulas e pústulas.', receita: [
          topico('Sabonete facial para pele oleosa/acneica', 'GEL', '', [1, 'fr.', false], 'Lavar o rosto 2 vezes ao dia (manhã e noite) e enxaguar bem. Uso contínuo.'),
          topico('Hidratante facial não comedogênico', 'gel-creme', '', [1, 'bisn.', true], 'Aplicar fina camada no rosto pela manhã, após a limpeza. Uso contínuo.'),
          topico('Protetor solar facial toque seco', 'loção', 'FPS 50', [1, 'fr.', false], 'Aplicar no rosto pela manhã; reaplicar a cada 2 - 3h se exposto ao sol. Uso contínuo.'),
        ] },
        { id: 'sensivel', rotulo: 'Rotina para pele sensível', texto: 'Rotina para pele sensível. Limpeza suave 1×/dia, hidratante calmante não comedogênico e fotoproteção oil-free.', receita: [
          topico('Sabonete facial para pele sensível', 'GEL', '', [1, 'fr.', false], 'Lavar o rosto 1 vez ao dia, à noite, com água fria ou morna. Uso contínuo.'),
          topico('Hidratante facial calmante não comedogênico', 'CREM', '', [1, 'bisn.', true], 'Aplicar fina camada no rosto 2 vezes ao dia (manhã e noite), se houver ressecamento. Uso contínuo.'),
          topico('Protetor solar facial mineral', 'loção', 'FPS 50', [1, 'fr.', false], 'Aplicar no rosto pela manhã; reaplicar a cada 2 - 3h se exposto ao sol. Uso contínuo.'),
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
          receita: [topico('Peróxido de benzoíla', 'GEL', '5%', [1, 'bisn. 60g', true], `Aplicar camada fina nas áreas com lesões (pode descolorir tecidos) ${NOITE}`)] },
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
          receita: [oral('Etinilestradiol + drospirenona', 'COMP', '0,03mg + 3mg', [2, 'cart. com 21 COMP', true], 'Tomar 1 COMP VO ao dia, no mesmo horário, 21 dias com pausa de 7 dias entre as cartelas, por 8 semanas.')] },
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
        { id: 'retorno', rotulo: 'Avaliação', opcoes: [
          { id: '4s', rotulo: '4 semanas', texto: 'Avaliação em 4 semanas.', dias: 28 },
          { id: '8s', rotulo: '8 semanas', texto: 'Avaliação em 8 semanas.', dias: 56 },
          { id: '12s', rotulo: '12 semanas', texto: 'Avaliação em 12 semanas.', dias: 84 },
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

// Modelos de conduta de exemplo para o retorno e a lesão nova (simulação; a IA verdadeira virá depois).
const RETORNO: Linha = { id: 'retorno', rotulo: 'Avaliação', opcoes: [
  { id: '4s', rotulo: '4 semanas', texto: 'Avaliação em 4 semanas.', dias: 28 },
  { id: '8s', rotulo: '8 semanas', texto: 'Avaliação em 8 semanas.', dias: 56 },
  { id: '12s', rotulo: '12 semanas', texto: 'Avaliação em 12 semanas.', dias: 84 },
] }
const RETORNO_CURTO: Linha = { id: 'retorno', rotulo: 'Avaliação', opcoes: [
  { id: '1s', rotulo: '1 semana', texto: 'Avaliação em 1 semana, com o resultado.', dias: 7 },
  { id: '2s', rotulo: '2 semanas', texto: 'Avaliação em 2 semanas, com o resultado.', dias: 14 },
  { id: '4s', rotulo: '4 semanas', texto: 'Avaliação em 4 semanas, com o resultado.', dias: 28 },
] }

const PSORIASE: ModeloConduta = {
  grupos: [
    { id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
      { id: 'hidratacao', rotulo: 'Hidratação e banhos mornos', texto: 'Hidratação diária da pele e banhos mornos e curtos. Evitar traumas e coçar as placas.', receita: [
        topico('Hidratante corporal com ureia', 'CREM', '10%', [1, 'fr.', false], 'Aplicar no corpo 2 vezes ao dia (manhã e noite). Uso contínuo.'),
      ] },
    ] }] },
    { id: 'topico', rotulo: '2. Tratamento tópico', linhas: [{ id: 'topico', rotulo: null, opcoes: [
      { id: 'clobetasol', rotulo: 'Clobetasol 0,05%', texto: 'Clobetasol 0,05% nas placas; uso noturno por tempo limitado.',
        receita: [topico('Propionato de clobetasol', 'CREM', '0,05%', [1, 'bisn. 30g', true], 'Aplicar fina camada nas placas 1 vez ao dia, à noite, por 4 semanas.')] },
      { id: 'calcipotriol', rotulo: 'Calcipotriol + betametasona', texto: 'Calcipotriol + betametasona nas placas; uso diário.',
        receita: [topico('Calcipotriol + dipropionato de betametasona', 'POM', '50mcg/g + 0,5mg/g', [1, 'bisn. 30g', true], 'Aplicar fina camada nas placas 1 vez ao dia, por 4 semanas.')] },
      { id: 'tacrolimo', rotulo: 'Tacrolimo 0,1%', texto: 'Tacrolimo 0,1% em áreas sensíveis.',
        receita: [topico('Tacrolimo', 'POM', '0,1%', [1, 'bisn. 30g', true], 'Aplicar fina camada nas áreas sensíveis 2 vezes ao dia, por 4 semanas.')] },
    ] }] },
    { id: 'sistemico', rotulo: '3. Tratamento sistêmico', linhas: [{ id: 'sistemico', rotulo: null, opcoes: [
      { id: 'metotrexato', rotulo: 'Metotrexato', texto: 'Metotrexato semanal, com controle laboratorial.',
        receita: [oral('Metotrexato', 'COMP', '2,5mg', [24, 'COMP', false], 'Tomar 4 COMP VO, 1 vez por semana, sempre no mesmo dia, por 6 semanas.')] },
      { id: 'acitretina', rotulo: 'Acitretina', texto: 'Acitretina oral.',
        receita: [oral('Acitretina', 'CAP', '25mg', [30, 'CAP', true, true], 'Tomar 1 CAP VO, 1 vez ao dia, junto com uma refeição, por 30 dias.')] },
    ] }] },
    { id: 'orientacoes', rotulo: '4. Orientações', fixo: 'Evitar traumas e manter a pele hidratada.', linhas: [
      { id: 'exames', rotulo: 'Exames', opcoes: [{ id: 'hepatico', rotulo: 'Função hepática e hemograma', texto: 'Solicito função hepática e hemograma.' }] },
      RETORNO,
      { id: 'encaminhamento', rotulo: 'Encaminhamento', prefixo: 'Encaminho para', opcoes: [{ id: 'reumato', rotulo: 'Reumatologia', texto: 'reumatologia' }] },
    ] },
  ],
  regras: [],
}

/** Lesão nova ou suspeita (melanoma, nevo, ceratose, carcinoma): primeiro investigar; sem tratamento antes do resultado. */
const INVESTIGACAO: ModeloConduta = {
  grupos: [
    { id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
      { id: 'foto', rotulo: 'Fotoproteção e vigilância', texto: 'Fotoproteção rigorosa. Não manipular a lesão e observar mudanças de cor, tamanho ou sangramento.', receita: [
        topico('Protetor solar facial e corporal', 'loção', 'FPS 50', [1, 'fr.', false], 'Aplicar nas áreas expostas pela manhã; reaplicar a cada 2 - 3h se exposto ao sol. Uso contínuo.'),
      ] },
    ] }] },
    { id: 'topico', rotulo: '2. Tratamento tópico', linhas: [{ id: 'topico', rotulo: null, opcoes: [
      { id: 'aguardar', rotulo: 'Aguardar o resultado', texto: 'Sem tratamento tópico até o resultado da investigação.' },
    ] }] },
    { id: 'sistemico', rotulo: '3. Tratamento sistêmico', linhas: [{ id: 'sistemico', rotulo: null, opcoes: [
      { id: 'paracetamol', rotulo: 'Paracetamol, se dor', texto: 'Paracetamol, se dor.',
        receita: [oral('Paracetamol', 'COMP', '750mg', [15, 'COMP', false], 'Tomar 1 COMP VO a cada 8 horas, se dor, por 5 dias.')] },
    ] }] },
    { id: 'orientacoes', rotulo: '4. Orientações', fixo: 'Investigar a lesão antes de qualquer tratamento.', linhas: [
      { id: 'exames', rotulo: 'Exames', opcoes: [
        { id: 'dermatoscopia', rotulo: 'Dermatoscopia digital', texto: 'Solicito dermatoscopia digital da lesão.' },
        { id: 'biopsia', rotulo: 'Biópsia da lesão', texto: 'Solicito biópsia da lesão com exame anatomopatológico.' },
      ] },
      RETORNO_CURTO,
      { id: 'encaminhamento', rotulo: 'Encaminhamento', prefixo: 'Encaminho para', opcoes: [
        { id: 'cirurgia', rotulo: 'Cirurgia dermatológica', texto: 'cirurgia dermatológica' },
        { id: 'oncologia', rotulo: 'Oncologia', texto: 'oncologia' },
      ] },
    ] },
  ],
  regras: [],
}

/** Efeito colateral ou reação ao tratamento (dermatite de contato, irritação, farmacodermia). */
const REACAO: ModeloConduta = {
  grupos: [
    { id: 'cuidados', rotulo: '1. Cuidados básicos', linhas: [{ id: 'cuidados', rotulo: null, opcoes: [
      { id: 'suspender', rotulo: 'Suspender o produto suspeito', texto: 'Suspender o produto suspeito até a pele melhorar. Evitar novos produtos na área.', receita: [
        topico('Hidratante calmante sem perfume', 'CREM', '', [1, 'bisn.', true], 'Aplicar na área afetada 2 vezes ao dia. Uso contínuo.'),
      ] },
    ] }] },
    { id: 'topico', rotulo: '2. Tratamento tópico', linhas: [{ id: 'topico', rotulo: null, opcoes: [
      { id: 'hidrocortisona', rotulo: 'Hidrocortisona 1%', texto: 'Hidrocortisona 1% na área afetada; uso curto.',
        receita: [topico('Hidrocortisona', 'CREM', '1%', [1, 'bisn. 30g', true], 'Aplicar fina camada na área afetada 2 vezes ao dia, por 7 dias.')] },
      { id: 'tacrolimo', rotulo: 'Tacrolimo 0,1%', texto: 'Tacrolimo 0,1% na área afetada.',
        receita: [topico('Tacrolimo', 'POM', '0,1%', [1, 'bisn. 30g', true], 'Aplicar fina camada na área afetada 2 vezes ao dia, por 14 dias.')] },
    ] }] },
    { id: 'sistemico', rotulo: '3. Tratamento sistêmico', linhas: [{ id: 'sistemico', rotulo: null, opcoes: [
      { id: 'loratadina', rotulo: 'Loratadina', texto: 'Loratadina, se coceira.',
        receita: [oral('Loratadina', 'COMP', '10mg', [10, 'COMP', false], 'Tomar 1 COMP VO, 1 vez ao dia, se coceira, por 10 dias.')] },
    ] }] },
    { id: 'orientacoes', rotulo: '4. Orientações', fixo: 'Anotar qual produto ou remédio foi usado antes da reação.', linhas: [RETORNO_CURTO] },
  ],
  regras: [],
}

export const CONDUTAS: Record<string, ModeloConduta> = {
  acne: ACNE, psoriase: PSORIASE,
  melanoma: INVESTIGACAO, nevo: INVESTIGACAO, queratose: INVESTIGACAO, cbc: INVESTIGACAO,
  'novo-melanoma': INVESTIGACAO, 'novo-nevo': INVESTIGACAO, 'novo-queratose': INVESTIGACAO, 'novo-cbc': INVESTIGACAO,
  'novo-contato': REACAO, 'novo-irritativa': REACAO, 'novo-farmaco': REACAO,
}
