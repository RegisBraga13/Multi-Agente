// Exame físico por roteiro: partes que abrem e fecham ("Pronto ›"), cada uma com linhas de opções para marcar.
// Pacote de dados da especialidade (o componente é o mesmo para todas). Textos do autor:
// Reumatologia 24/11/2026 (docs/especialidades/reumatologia-exame-fisico.md),
// Dermatologia 26/11/2026 (docs/especialidades/dermatologia-exame-fisico.md),
// Cardiologia, Gastroenterologia, Neurologia, Endocrinologia, Hematologia, Infectologia, Oncologia, Nefrologia,
// Ginecologia, Urologia, Geriatria, Pediatria, Psiquiatria, Otorrinolaringologia, Pneumologia, Hepatologia e Cirurgia Geral 26/11/2026 (docs/especialidades/cardiologia-exame-fisico.md, gastroenterologia-exame-fisico.md).

/** Caixinha de número de uma linha (ex.: PA, FC, dimensões); guardada em "parte.linha#id". `texto`: aceita palavras
 *  (teclado comum no iPad), para os campos curtos que o modelo pede por escrito (ex.: fotorreação, consistência do nódulo). */
export type CampoNumero = { id: string; antes?: string; depois?: string; largura?: number; texto?: boolean }
/**
 * Uma linha do roteiro: `multipla` = marca quantas quiser; senão, uma só (tocar de novo desmarca).
 * `outro`: a última opção ("Outro") abre uma linha para escrever (guardada em "parte.linha#outro").
 * `numeros`: caixinhas de número (só entram se preenchidas). `rotuloTexto`: o nome da linha no texto do exame.
 * `campoProprio`: a linha sai do texto da parte e vira um campo do exame com esse nome (ex.: "Extensão", que o
 * retorno compara em %). `semExclusiva`: nenhuma opção "Não…"/"Sem…" limpa as outras (ex.: "Não depressível" convive com
 * "Tenso").
 */
export type LinhaRoteiro = {
  id: string; rotulo: string; opcoes: string[]; multipla: boolean; grupo?: string
  outro?: boolean; numeros?: CampoNumero[]; rotuloTexto?: string; campoProprio?: string; semExclusiva?: boolean
}
/** `frase(marcadas)`: como a parte entra no texto do exame (só com o que foi marcado). */
export type ParteRoteiro = { id: string; titulo: string; rotuloTexto: string; linhas: LinhaRoteiro[]; ajuda?: string }
export type Roteiro = ParteRoteiro[]
/** O que o médico marcou: "parte.linha" → opções marcadas. */
export type MarcasExame = Record<string, string[]>

const DE = ['D', 'E']
const uma = (id: string, rotulo: string, opcoes: string[], grupo?: string): LinhaRoteiro => ({ id, rotulo, opcoes, multipla: false, grupo })
const varias = (id: string, rotulo: string, opcoes: string[], grupo?: string): LinhaRoteiro => ({ id, rotulo, opcoes, multipla: true, grupo })
const lado = (id: string, rotulo: string, grupo: string) => varias(id, rotulo, DE, grupo)
const sim = (id: string, rotulo: string, grupo: string) => varias(id, rotulo, ['Sim'], grupo)
/** "Outro" no fim da lista, abrindo uma linha para escrever */
const comOutro = (l: LinhaRoteiro, texto?: string): LinhaRoteiro => ({ ...l, opcoes: [...l.opcoes, 'Outro'], outro: true, rotuloTexto: texto ?? l.rotuloTexto })
const texto = (l: LinhaRoteiro, rotuloTexto: string): LinhaRoteiro => ({ ...l, rotuloTexto })

const REUMATOLOGIA: Roteiro = [
  {
    id: 'gals', titulo: 'GALS', rotuloTexto: 'GALS',
    linhas: [
      uma('marcha', 'Marcha', ['Normal', 'Claudicante', 'Assimétrica']),
      uma('bracos', 'Braços', ['Normal', 'Alterado']),
      uma('pernas', 'Pernas', ['Normal', 'Alterado']),
      uma('coluna', 'Coluna', ['Normal', 'Alterada']),
    ],
  },
  {
    id: 'mapa', titulo: 'Mapa articular', rotuloTexto: 'Articulações acometidas', ajuda: 'D = direita · E = esquerda',
    linhas: [
      lado('ombro', 'Ombro', 'MMSS'), lado('cotovelo', 'Cotovelo', 'MMSS'), lado('punho', 'Punho', 'MMSS'),
      lado('mcf', 'MCFs', 'MMSS'), lado('ifp', 'IFPs', 'MMSS'), lado('ifd', 'IFDs', 'MMSS'),
      lado('quadril', 'Quadril', 'MMII'), lado('joelho', 'Joelho', 'MMII'), lado('tornozelo', 'Tornozelo', 'MMII'),
      lado('tarso', 'Mediopé/Tarso', 'MMII'), lado('mtf', 'MTFs', 'MMII'), lado('ifpe', 'IFs (pés)', 'MMII'),
      lado('atm', 'ATM', 'Axial e outras'), lado('ecac', 'EC/AC', 'Axial e outras'),
      sim('cervical', 'Coluna cervical', 'Axial e outras'), sim('toracica', 'Coluna torácica', 'Axial e outras'),
      sim('lombar', 'Coluna lombar', 'Axial e outras'), lado('si', 'Sacroilíacas', 'Axial e outras'),
    ],
  },
  {
    id: 'ipam', titulo: 'IPAM', rotuloTexto: 'IPAM',
    linhas: [
      varias('inspecao', 'Inspeção', ['Edema articular', 'Eritema/rubor', 'Deformidade', 'Atrofia muscular adjacente']),
      varias('palpacao', 'Palpação', ['Calor local', 'Dor à palpação da linha articular', 'Espessamento sinovial', 'Derrame articular', 'Dor em enteses/bursas']),
      uma('adm_ativa', 'ADM ativa', ['Preservada', 'Limitada por dor/fraqueza']),
      uma('adm_passiva', 'ADM passiva', ['Preservada', 'Limitada (bloqueio/contratura)']),
      varias('crepitacao', 'Crepitação', ['Palpável/audível']),
      varias('mao', 'Mão/Punho', ['Phalen', 'Tinel', 'Finkelstein', 'Squeeze MCF/MTF'], 'Manobras positivas'),
      varias('ombro', 'Ombro', ['Neer', 'Hawkins', 'Jobe', 'Patte'], 'Manobras positivas'),
      varias('joelho', 'Joelho', ['Tecla/Rechaço', 'Gaveta ant/post', 'Lachman', 'McMurray'], 'Manobras positivas'),
      varias('coluna', 'Coluna/SI', ['Schober', 'Patrick (FABERE)', 'Gaenslen', 'Lasègue'], 'Manobras positivas'),
    ],
  },
  {
    id: 'padrao', titulo: 'Padrão', rotuloTexto: 'Padrão',
    linhas: [
      uma('numero', 'Número', ['Mono (1)', 'Oligo (2–4)', 'Poli (≥ 5)']),
      uma('simetria', 'Simetria', ['Simétrico', 'Assimétrico']),
      uma('local', 'Localização', ['Periférico', 'Axial', 'Misto']),
      uma('natureza', 'Natureza', ['Inflamatório', 'Mecânico', 'Difuso/Nociplástico']),
    ],
  },
  {
    id: 'extra', titulo: 'Extra-articular', rotuloTexto: 'Extra-articular',
    linhas: [
      varias('achados', 'Achados', ['Psoríase/pitting ungueal', 'Eritema malar/fotossensibilidade', 'Raynaud/esclerodactilia',
        'Úlceras orais ou nasais', 'Olho seco/hiperemia ocular', 'Nódulos subcutâneos/tofos']),
    ],
  },
]

/** Dermatologia (autor, 26/11/2026). Combinado na tela: sem data/hora/examinador/assinatura (o app já sabe);
 * "Outro" abre linha; sinais vitais e dimensões em caixinhas; as "Descrição" viram as Observações do fim;
 * Lesões cutâneas em duas partes (3a e 3b) para caber na tela; 3b ganha Extensão (%) e Gravidade; uma resposta
 * só em estado geral, consciência, fototipo, temperatura, turgor e gravidade. */
const DERMATOLOGIA: Roteiro = [
  {
    id: 'geral', titulo: 'Avaliação geral', rotuloTexto: 'Avaliação geral',
    linhas: [
      comOutro(uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido'])),
      comOutro(uma('consciencia', 'Consciência', ['Alerta', 'Sonolento', 'Confuso'])),
      { ...varias('vitais', 'Sinais vitais', []), numeros: [
        { id: 'pa', antes: 'PA', depois: 'mmHg', largura: 64 }, { id: 'fc', antes: 'FC', depois: 'bpm' },
        { id: 'fr', antes: 'FR', depois: 'irpm' }, { id: 'temp', antes: 'T', depois: '°C' }, { id: 'spo2', antes: 'SpO₂', depois: '%' },
      ] },
    ],
  },
  {
    id: 'pele', titulo: 'Pele', rotuloTexto: 'Pele',
    linhas: [
      uma('fototipo', 'Fototipo', ['I', 'II', 'III', 'IV', 'V', 'VI', 'Não avaliado']),
      varias('hidratacao', 'Hidratação', ['Adequada', 'Ressecada', 'Muito ressecada', 'Oleosa', 'Mista']),
      comOutro(varias('coloracao', 'Coloração', ['Habitual', 'Palidez', 'Eritema', 'Cianose', 'Icterícia', 'Hiperpigmentação', 'Hipopigmentação'])),
      uma('temperatura', 'Temperatura', ['Habitual', 'Aumentada', 'Diminuída', 'Não avaliada']),
      texto(uma('turgor', 'Turgor', ['Preservados', 'Reduzidos', 'Não avaliados']), 'Turgor e elasticidade'),
      comOutro(varias('textura', 'Textura', ['Habitual', 'Áspera', 'Lisa', 'Espessada', 'Atrófica', 'Descamação', 'Liquenificação']), 'Textura e superfície'),
      comOutro(varias('achados', 'Achados', ['Sem lesões evidentes', 'Lesões presentes', 'Cicatrizes', 'Estrias', 'Atrofia', 'Alterações vasculares'])),
    ],
  },
  {
    id: 'lesoes', titulo: 'Lesões', rotuloTexto: 'Lesões',
    linhas: [
      comOutro(varias('primaria', 'Primária', ['Mácula', 'Mancha', 'Pápula', 'Placa', 'Nódulo', 'Tumor', 'Vesícula', 'Bolha', 'Pústula', 'Cisto', 'Urtica', 'Púrpura', 'Petéquia', 'Equimose', 'Telangiectasia']), 'Lesão primária'),
      comOutro(varias('secundaria', 'Secundária', ['Escama', 'Crosta', 'Erosão', 'Escoriação', 'Fissura', 'Úlcera', 'Cicatriz', 'Atrofia', 'Liquenificação', 'Esclerose', 'Necrose']), 'Lesão secundária'),
      varias('numero', 'Número', ['Única', 'Poucas', 'Múltiplas', 'Disseminadas', 'Agrupadas', 'Simétricas', 'Assimétricas', 'Localizadas']),
      comOutro(varias('arranjo', 'Arranjo', ['Linear', 'Anular', 'Policíclico', 'Reticulado', 'Serpiginoso', 'Herpetiforme', 'Zosteriforme', 'Confluente'])),
      comOutro(varias('cor', 'Cor', ['Eritematosa', 'Castanha', 'Enegrecida', 'Violácea', 'Hipocrômica', 'Acrômica', 'Amarelada'])),
    ],
  },
  {
    id: 'local', titulo: 'Local e aspecto', rotuloTexto: 'Local e aspecto',
    linhas: [
      comOutro(varias('localizacao', 'Localização', ['Couro cabeludo', 'Face', 'Pálpebras', 'Lábios', 'Orelhas', 'Pescoço', 'Tronco anterior', 'Dorso', 'Axilas', 'Braços', 'Antebraços', 'Mãos', 'Palmas', 'Unhas', 'Coxas', 'Pernas', 'Pés', 'Plantas', 'Dobras', 'Genitais', 'Região perianal', 'Mucosas'])),
      comOutro(varias('distribuicao', 'Distribuição', ['Fotoexposta', 'Flexural', 'Extensora', 'Acral', 'Intertriginosa', 'Dermatomérica', 'Generalizada'])),
      { ...uma('dimensoes', 'Dimensões', ['mm', 'cm', 'Não medidas']), numeros: [{ id: 'a', largura: 44 }, { id: 'b', antes: '×', largura: 44 }] },
      { ...varias('extensao', 'Extensão', []), numeros: [{ id: 'pct', depois: '% do corpo', largura: 48 }], campoProprio: 'Extensão' },
      uma('gravidade', 'Gravidade', ['Leve', 'Moderada', 'Grave']),
      comOutro(varias('contornos', 'Contornos', ['Bem definidos', 'Mal definidos', 'Regulares', 'Irregulares', 'Elevados', 'Infiltrados']), 'Contornos e limites'),
      comOutro(varias('superficie', 'Superfície', ['Lisa', 'Brilhante', 'Áspera', 'Verrucosa', 'Ceratósica', 'Umbilicada', 'Erosada', 'Ulcerada', 'Com escamas', 'Com crostas'])),
      comOutro(varias('palpacao', 'Palpação', ['Plana', 'Elevada', 'Deprimida', 'Infiltrada', 'Endurecida', 'Flutuante', 'Móvel', 'Aderida', 'Dolorosa', 'Pruriginosa'])),
    ],
  },
  {
    id: 'anexos', titulo: 'Anexos', rotuloTexto: 'Anexos',
    linhas: [
      comOutro(varias('couro', 'Couro cab.', ['Sem alterações', 'Eritema', 'Descamação', 'Crostas', 'Pústulas', 'Cicatrizes'], 'Cabelos'), 'Couro cabeludo'),
      comOutro(varias('cabelos', 'Densidade', ['Preservadas', 'Rarefação difusa', 'Rarefação localizada', 'Alopecia cicatricial', 'Alopecia não cicatricial'], 'Cabelos'), 'Distribuição e densidade dos cabelos'),
      comOutro(varias('hastes', 'Hastes', ['Sem alterações aparentes', 'Fragilidade', 'Quebra', 'Alteração de calibre'], 'Cabelos'), 'Hastes capilares'),
      comOutro(varias('unhas', 'Unhas', ['Sem alterações', 'Alteração de cor', 'Espessamento', 'Onicólise', 'Descolamento', 'Estrias', 'Pitting', 'Fragilidade', 'Distrofia'], 'Unhas')),
      comOutro(varias('unhas_onde', 'Onde', ['Uma unha', 'Múltiplas unhas', 'Mãos', 'Pés'], 'Unhas'), 'Unhas acometidas'),
      comOutro(varias('pelos', 'Pelos', ['Distribuição preservada', 'Hipertricose', 'Hirsutismo', 'Hipotricose', 'Alopecia localizada'], 'Pelos')),
    ],
  },
  {
    id: 'mucosas', titulo: 'Mucosas', rotuloTexto: 'Mucosas',
    linhas: [
      comOutro(varias('examinadas', 'Examinadas', ['Oral', 'Ocular', 'Nasal', 'Genital', 'Não examinadas']), 'Mucosas examinadas'),
      comOutro(varias('achados', 'Achados', ['Sem alterações', 'Eritema', 'Máculas', 'Pápulas', 'Vesículas', 'Erosões', 'Úlceras', 'Placas', 'Pigmentação'])),
    ],
  },
  {
    id: 'linfonodos', titulo: 'Linfonodos', rotuloTexto: 'Linfonodos',
    linhas: [
      comOutro(varias('cadeias', 'Cadeias', ['Cervicais', 'Submandibulares', 'Axilares', 'Inguinais']), 'Cadeias avaliadas'),
      varias('achados', 'Achados', ['Não palpáveis', 'Palpáveis', 'Dolorosos', 'Indolores', 'Móveis', 'Aderidos']),
    ],
  },
  {
    id: 'registro', titulo: 'Registro fotográfico', rotuloTexto: 'Registro de imagem',
    linhas: [
      varias('imagem', 'Registro', ['Fotografias realizadas', 'Dermatoscopia realizada', 'Sem registro de imagem']),
    ],
  },
]

/** Caixinhas de sinais vitais, iguais em todos os roteiros que as têm. */
const VITAIS: CampoNumero[] = [
  { id: 'pa', antes: 'PA', depois: 'mmHg', largura: 64 }, { id: 'fc', antes: 'FC', depois: 'bpm' },
  { id: 'fr', antes: 'FR', depois: 'irpm' }, { id: 'temp', antes: 'T', depois: '°C' }, { id: 'spo2', antes: 'SpO₂', depois: '%' },
]
const MEDIDAS: CampoNumero[] = [
  { id: 'peso', antes: 'Peso', depois: 'kg' }, { id: 'altura', antes: 'Altura', depois: 'cm' }, { id: 'imc', antes: 'IMC', depois: 'kg/m²' },
]
const numeros = (id: string, rotulo: string, campos: CampoNumero[], rotuloTexto?: string): LinhaRoteiro => ({ ...varias(id, rotulo, []), numeros: campos, rotuloTexto })
const PULSO = ['Presente', 'Reduzido', 'Ausente', 'Não avaliado']
const pulso = (id: string, rotulo: string, lado: 'D' | 'E') =>
  texto(uma(`${id}_${lado.toLowerCase()}`, rotulo, PULSO, lado === 'D' ? 'Direito' : 'Esquerdo'), `${rotulo} ${lado}`)

/** Cardiologia (autor, 26/11/2026), no mesmo esqueleto da Dermatologia: sem examinador/assinatura; "Outro" abre linha;
 * números em caixinhas; as "Localização", "Descrição" e "Outros achados" vão para as Observações do fim;
 * o exame cardiovascular em duas partes (Coração · Sopros) e os pulsos numa parte própria, para caber na tela. */
const CARDIOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      uma('braco', 'Braço', ['Direito', 'Esquerdo']),
      texto(uma('posicao', 'Posição', ['Sentado', 'Deitado', 'Em pé']), 'Posição da PA'),
      numeros('ortostatica', 'PA ortost.', [{ id: 'deitado', antes: 'Deitado', largura: 64 }, { id: 'empe', antes: 'Em pé', depois: 'mmHg', largura: 64 }], 'PA ortostática'),
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      numeros('medidas', 'Medidas', [...MEDIDAS, { id: 'ca', antes: 'CA', depois: 'cm' }]),
    ],
  },
  {
    id: 'geral', titulo: 'Aspecto geral e perfusão', rotuloTexto: 'Aspecto geral e perfusão',
    linhas: [
      comOutro(uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido'])),
      comOutro(uma('consciencia', 'Consciência', ['Alerta', 'Sonolento', 'Confuso'])),
      texto(varias('perfusao', 'Perfusão', ['Adequada', 'Reduzida', 'Extremidades frias', 'Cianose', 'Palidez']), 'Perfusão periférica'),
      { ...uma('tec', 'Ench. capilar', ['Não avaliado']), numeros: [{ id: 's', depois: 's', largura: 36 }], rotuloTexto: 'Tempo de enchimento capilar' },
      texto(uma('jugular', 'Turg. jugular', ['Ausente', 'Presente', 'Não avaliada']), 'Turgência jugular'),
    ],
  },
  {
    id: 'coracao', titulo: 'Coração', rotuloTexto: 'Exame cardiovascular',
    linhas: [
      texto(uma('ictus', 'Ictus', ['Não visível', 'Não palpável', 'Palpável']), 'Ictus cordis'),
      texto(uma('fremitos', 'Frêmitos', ['Ausentes', 'Presentes']), 'Impulsões ou frêmitos'),
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      varias('bulhas', 'Bulhas', ['Normofonéticas', 'Hipofonéticas', 'Hiperfonéticas', 'B1 alterada', 'B2 alterada', 'B3 presente', 'B4 presente', 'Desdobramento']),
      texto(uma('atrito', 'Atrito', ['Ausente', 'Presente', 'Não avaliado']), 'Atrito pericárdico'),
    ],
  },
  {
    id: 'sopros', titulo: 'Sopros', rotuloTexto: 'Sopros',
    linhas: [
      uma('sopros', 'Sopros', ['Ausentes', 'Presentes']),
      comOutro(varias('foco', 'Foco', ['Aórtico', 'Pulmonar', 'Tricúspide', 'Mitral'])),
      uma('intensidade', 'Intensidade', ['I/VI', 'II/VI', 'III/VI', 'IV/VI', 'V/VI', 'VI/VI']),
      varias('momento', 'Momento', ['Sistólico', 'Diastólico', 'Contínuo']),
    ],
  },
  {
    id: 'respiratorio', titulo: 'Respiratório', rotuloTexto: 'Exame respiratório',
    linhas: [
      comOutro(varias('padrao', 'Padrão', ['Eupneico', 'Taquipneico', 'Dispneico', 'Uso de musculatura acessória']), 'Padrão respiratório'),
      texto(uma('expansibilidade', 'Expansib.', ['Simétrica', 'Assimétrica', 'Reduzida', 'Não avaliada']), 'Expansibilidade torácica'),
      comOutro(varias('ausculta', 'Ausculta', ['MV presente bilateralmente', 'MV reduzido', 'MV ausente', 'Estertores', 'Sibilos', 'Roncos']), 'Ausculta pulmonar'),
    ],
  },
  {
    id: 'abdome', titulo: 'Abdome', rotuloTexto: 'Abdome',
    linhas: [
      comOutro(uma('inspecao', 'Inspeção', ['Plano', 'Globoso', 'Distendido'])),
      varias('ausculta', 'Ausculta', ['RHA presentes', 'RHA reduzidos', 'RHA aumentados', 'RHA ausentes', 'Sopros abdominais', 'Não avaliada']),
      comOutro(varias('palpacao', 'Palpação', ['Flácido', 'Tenso', 'Indolor', 'Doloroso', 'Hepatomegalia', 'Hepatomegalia dolorosa', 'Ascite suspeita'])),
    ],
  },
  {
    id: 'extremidades', titulo: 'Extremidades', rotuloTexto: 'Extremidades',
    linhas: [
      { ...uma('edema', 'Edema', ['Ausente', 'Presente']), numeros: [{ id: 'grau', antes: 'grau', depois: '/4+', largura: 32 }] },
      texto(varias('edema_tipo', 'Distribuição', ['Unilateral', 'Bilateral', 'Simétrico', 'Assimétrico']), 'Distribuição do edema'),
      texto(uma('tec', 'Ench. capilar', ['Até 2 segundos', 'Prolongado', 'Não avaliado']), 'Enchimento capilar'),
      texto(uma('troficas', 'Tróficas', ['Ausentes', 'Presentes']), 'Alterações tróficas, cianose ou temperatura'),
    ],
  },
  {
    id: 'pulsos', titulo: 'Pulsos', rotuloTexto: 'Pulsos periféricos',
    linhas: (['D', 'E'] as const).flatMap((l) => [
      pulso('carotideo', 'Carotídeo', l), pulso('radial', 'Radial', l), pulso('femoral', 'Femoral', l),
      pulso('pedioso', 'Pedioso', l), pulso('tibial', 'Tibial post.', l),
    ]),
  },
  {
    id: 'carotidas', titulo: 'Carótidas', rotuloTexto: 'Exame vascular cervical',
    linhas: [
      texto(uma('pulsos', 'Pulsos', ['Simétricos', 'Assimetria', 'Não avaliadas']), 'Pulsos carotídeos'),
      texto(uma('sopro', 'Sopro', ['Sem sopro', 'Sopro auscultado']), 'Sopro carotídeo'),
    ],
  },
]

/** Gastroenterologia (autor, 26/11/2026), mesmo esqueleto: abdome em duas partes (Inspeção e ausculta · Palpação);
 * os sinais específicos (Murphy, descompressão, Giordano) em linhas de Ausente/Presente (não pesquisado = nada marcado). */
const GASTROENTEROLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [numeros('vitais', 'Sinais vitais', VITAIS), numeros('medidas', 'Medidas', MEDIDAS)],
  },
  {
    id: 'geral', titulo: 'Aspecto geral', rotuloTexto: 'Aspecto geral',
    linhas: [
      comOutro(uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido'])),
      comOutro(uma('consciencia', 'Consciência', ['Alerta', 'Sonolento', 'Confuso'])),
      varias('hidratacao', 'Hidratação', ['Adequada', 'Reduzida', 'Mucosas secas', 'Não avaliada']),
      comOutro(varias('coloracao', 'Coloração', ['Habitual', 'Pálida', 'Ictérica', 'Cianótica'])),
      comOutro(uma('nutricional', 'Nutricional', ['Sem alteração aparente', 'Baixo peso', 'Sobrepeso', 'Obesidade', 'Caquexia aparente']), 'Estado nutricional'),
    ],
  },
  {
    id: 'cabeca', titulo: 'Boca e pescoço', rotuloTexto: 'Cabeça, boca e pescoço',
    linhas: [
      texto(varias('mucosa', 'Mucosa oral', ['Úmida', 'Ressecada', 'Pálida', 'Ictérica', 'Lesões', 'Não avaliada']), 'Mucosa oral'),
      comOutro(varias('orofaringe', 'Orofaringe', ['Sem alterações aparentes', 'Hiperemia', 'Lesões'])),
      texto(uma('linfonodos', 'Linfonodos', ['Não palpáveis', 'Palpáveis', 'Não avaliados']), 'Linfonodos cervicais'),
    ],
  },
  {
    id: 'abdome_insp', titulo: 'Abdome: inspeção e ausculta', rotuloTexto: 'Abdome (inspeção, ausculta e percussão)',
    linhas: [
      comOutro(varias('contorno', 'Contorno', ['Plano', 'Globoso', 'Distendido', 'Escavado', 'Assimétrico']), 'Inspeção'),
      comOutro(varias('pele', 'Pele', ['Sem alterações aparentes', 'Cicatrizes', 'Estrias', 'Circulação colateral', 'Equimoses', 'Lesões']), 'Pele e cicatrizes'),
      texto(uma('hernias', 'Hérnias', ['Não', 'Sim']), 'Hérnias visíveis'),
      texto(uma('rha', 'RHA', ['Presentes', 'Aumentados', 'Reduzidos', 'Ausentes', 'Não avaliados']), 'Ruídos hidroaéreos'),
      texto(uma('sopros', 'Sopros', ['Ausentes', 'Presentes']), 'Sopros abdominais'),
      comOutro(varias('percussao', 'Percussão', ['Predomínio timpânico', 'Predomínio maciço', 'Macicez localizada', 'Macicez móvel', 'Não avaliada'])),
    ],
  },
  {
    id: 'abdome_palp', titulo: 'Abdome: palpação', rotuloTexto: 'Abdome (palpação)',
    linhas: [
      { ...varias('abdome', 'Abdome', ['Flácido', 'Tenso', 'Depressível', 'Não depressível', 'Indolor', 'Doloroso', 'Defesa', 'Rigidez']), semExclusiva: true },
      texto(uma('dor', 'Dor', ['Ausente', 'Presente']), 'Dor à palpação'),
      comOutro(varias('massas', 'Massas', ['Não palpáveis', 'Massa palpável', 'Hepatomegalia', 'Esplenomegalia', 'Não avaliadas']), 'Massas ou visceromegalias'),
      texto(uma('murphy', 'Murphy', ['Ausente', 'Presente'], 'Sinais específicos'), 'Sinal de Murphy'),
      texto(uma('descompressao', 'Descompr.', ['Ausente', 'Presente'], 'Sinais específicos'), 'Descompressão brusca'),
      texto(uma('giordano', 'Giordano', ['Ausente', 'Presente'], 'Sinais específicos'), 'Giordano'),
      uma('ascite', 'Ascite', ['Sem sinais clínicos', 'Suspeita clínica', 'Presente', 'Não avaliada'], 'Sinais específicos'),
    ],
  },
  {
    id: 'anorretal', titulo: 'Anorretal', rotuloTexto: 'Região anorretal',
    linhas: [
      varias('feito', 'Exame', ['Não examinada', 'Inspeção realizada', 'Toque retal realizado']),
      comOutro(varias('inspecao', 'Inspeção', ['Sem alterações aparentes', 'Fissura', 'Hemorroidas', 'Fístula', 'Lesão / massa', 'Prolapso']), 'Inspeção perianal'),
      varias('toque', 'Toque retal', ['Sem alterações palpáveis', 'Dor', 'Massa', 'Fezes na ampola', 'Sangue', 'Não realizado']),
    ],
  },
  {
    id: 'extremidades', titulo: 'Extremidades e pele', rotuloTexto: 'Extremidades e pele',
    linhas: [
      { ...uma('edema', 'Edema', ['Ausente', 'Presente']), numeros: [{ id: 'grau', antes: 'grau', depois: '/4+', largura: 32 }] },
      texto(uma('lesoes', 'Petéquias', ['Ausentes', 'Presentes']), 'Petéquias, equimoses ou lesões cutâneas'),
    ],
  },
]

/** Caixinhas D e E (texto curto ou número), para os achados por lado do exame neurológico e endocrinológico. */
const ladoDE = (largura = 40, texto = false, depois?: string): CampoNumero[] => [{ id: 'd', antes: 'D', largura, texto }, { id: 'e', antes: 'E', largura, texto, depois }]
const porLado = (id: string, rotulo: string, opcoes: string[], lado: 'D' | 'E', multipla = false) =>
  texto({ ...(multipla ? varias : uma)(`${id}_${lado.toLowerCase()}`, rotulo, opcoes, lado === 'D' ? 'Direito' : 'Esquerdo') }, `${rotulo} ${lado}`)

/** Neurologia (autor, 26/11/2026): pares cranianos em duas partes; força MRC e reflexos em caixinhas D/E; as
 * "Descrição", "Localização" e "Distribuição do déficit" vão para as Observações do fim. */
const NEUROLOGIA: Roteiro = [
  { id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais', linhas: [numeros('vitais', 'Sinais vitais', VITAIS)] },
  {
    id: 'mental', titulo: 'Estado mental e linguagem', rotuloTexto: 'Estado mental e linguagem',
    linhas: [
      uma('vigilia', 'Vigília', ['Alerta', 'Sonolento', 'Estupor', 'Coma', 'Não avaliada']),
      texto(varias('orientacao', 'Orientado', ['Pessoa', 'Tempo', 'Espaço', 'Não avaliada']), 'Orientação'),
      texto(uma('atencao', 'Atenção', ['Preservadas ao exame breve', 'Alteradas', 'Não avaliadas']), 'Atenção e memória'),
      texto(varias('fala', 'Fala', ['Sem alterações nos itens testados', 'Disartria', 'Alteração de fluência', 'Alteração de compreensão', 'Alteração de nomeação', 'Alteração de repetição']), 'Fala e linguagem'),
    ],
  },
  {
    id: 'nc_olhos', titulo: 'Pares I a VI', rotuloTexto: 'Pares cranianos I a VI',
    linhas: [
      texto(uma('olfato', 'Olfato (I)', ['Preservado', 'Alterado', 'Não avaliado']), 'Olfato'),
      numeros('acuidade', 'Acuidade (II)', [{ id: 'od', antes: 'OD', largura: 56, texto: true }, { id: 'oe', antes: 'OE', largura: 56, texto: true }], 'Acuidade visual'),
      numeros('campos', 'Campos', [{ id: 't', largura: 220, texto: true }], 'Campos por confrontação'),
      uma('fundoscopia', 'Fundoscopia', ['Sem alterações descritas', 'Alterada', 'Não realizada']),
      { ...uma('pupilas', 'Pupilas', ['Isocoria', 'Anisocoria']), numeros: [{ id: 'od', antes: 'OD', largura: 36 }, { id: 'oe', antes: 'OE', largura: 36, depois: 'mm' }] },
      numeros('fotorreacao', 'Fotorreação', ladoDE(70, true)),
      texto(uma('motilidade', 'Motilidade', ['Completa', 'Limitada']), 'Motilidade ocular'),
      varias('olhos', 'Achados', ['Ptose', 'Diplopia', 'Nistagmo']),
    ],
  },
  {
    id: 'nc_face', titulo: 'Pares V a XII', rotuloTexto: 'Pares cranianos V a XII',
    linhas: [
      numeros('sens_facial', 'Sens. facial', ladoDE(80, true), 'Sensibilidade facial'),
      numeros('mastigacao', 'Mastigação', [{ id: 't', largura: 160, texto: true }]),
      { ...uma('mimica', 'Mímica', ['Simétrica', 'Assimétrica']), numeros: [{ id: 'lado', antes: 'lado e segmentos', largura: 140, texto: true }] },
      texto(uma('audicao', 'Audição', ['Sem assimetria aparente', 'Reduzida à D', 'Reduzida à E', 'Não avaliada']), 'Audição'),
      numeros('bulbares', 'IX e X', [{ id: 'voz', antes: 'Voz', largura: 90, texto: true }, { id: 'palato', antes: 'Palato', largura: 90, texto: true }, { id: 'degl', antes: 'Deglutição', largura: 90, texto: true }]),
      numeros('xi', 'Ombros (XI)', ladoDE(70, true), 'Rotação da cabeça e elevação dos ombros'),
      texto(varias('lingua', 'Língua (XII)', ['Central', 'Desvio', 'Atrofia', 'Fasciculações']), 'Língua'),
    ],
  },
  {
    id: 'motricidade', titulo: 'Motricidade', rotuloTexto: 'Motricidade',
    linhas: [
      varias('trofismo', 'Trofismo', ['Preservado', 'Atrofia', 'Fasciculações', 'Não avaliado']),
      varias('tonus', 'Tônus', ['Preservado', 'Hipotonia', 'Espasticidade', 'Rigidez', 'Não avaliado']),
      texto(varias('involuntarios', 'Involuntários', ['Ausentes ao exame', 'Tremor', 'Mioclonias', 'Distonia', 'Coreia', 'Tiques']), 'Movimentos involuntários'),
      texto(uma('bracos', 'Braços estend.', ['Sem queda', 'Queda/pronação à D', 'Queda/pronação à E', 'Não realizada']), 'Prova dos braços estendidos'),
    ],
  },
  {
    id: 'forca', titulo: 'Força (MRC 0–5)', rotuloTexto: 'Força muscular (MRC)', ajuda: 'D = direita · E = esquerda · flex / ext',
    linhas: [
      numeros('ombro', 'Abd. ombro', ladoDE(32), 'Abdução do ombro'),
      numeros('cotovelo', 'Cotovelo', [{ id: 'df', antes: 'D', largura: 32 }, { id: 'de', antes: '/', largura: 32 }, { id: 'ef', antes: 'E', largura: 32 }, { id: 'ee', antes: '/', largura: 32 }], 'Flexão/extensão do cotovelo'),
      numeros('punho', 'Punho/dedos', [{ id: 'df', antes: 'D', largura: 32 }, { id: 'de', antes: '/', largura: 32 }, { id: 'ef', antes: 'E', largura: 32 }, { id: 'ee', antes: '/', largura: 32 }], 'Extensão do punho/abdução dos dedos'),
      numeros('quadril', 'Flex. quadril', ladoDE(32), 'Flexão do quadril'),
      numeros('joelho', 'Joelho', [{ id: 'de', antes: 'D', largura: 32 }, { id: 'df', antes: '/', largura: 32 }, { id: 'ee', antes: 'E', largura: 32 }, { id: 'ef', antes: '/', largura: 32 }], 'Extensão/flexão do joelho'),
      numeros('tornozelo', 'Tornozelo', [{ id: 'dd', antes: 'D', largura: 32 }, { id: 'dp', antes: '/', largura: 32 }, { id: 'ed', antes: 'E', largura: 32 }, { id: 'ep', antes: '/', largura: 32 }], 'Dorsiflexão/flexão plantar do tornozelo'),
    ],
  },
  {
    id: 'reflexos', titulo: 'Reflexos', rotuloTexto: 'Reflexos', ajuda: 'Profundos de 0 a 4+',
    linhas: [
      numeros('bicipital', 'Bicipital', ladoDE(36, true)), numeros('tricipital', 'Tricipital', ladoDE(36, true)),
      numeros('braquio', 'Braquiorradial', ladoDE(36, true)), numeros('patelar', 'Patelar', ladoDE(36, true)),
      numeros('aquileu', 'Aquileu', ladoDE(36, true)),
      texto(uma('plantar_d', 'Plantar D', ['Flexora', 'Extensora', 'Indiferente', 'Não testada']), 'Resposta plantar D'),
      texto(uma('plantar_e', 'Plantar E', ['Flexora', 'Extensora', 'Indiferente', 'Não testada']), 'Resposta plantar E'),
      { ...uma('clonus', 'Clônus', ['Ausente', 'Presente', 'Não pesquisado']), numeros: [{ id: 'lado', antes: 'lado', largura: 60, texto: true }] },
    ],
  },
  {
    id: 'sensibilidade', titulo: 'Sensibilidade', rotuloTexto: 'Sensibilidade',
    linhas: [
      texto(varias('testada', 'Testada', ['Tato', 'Dor', 'Temperatura', 'Vibração', 'Propriocepção']), 'Modalidades testadas'),
      varias('achados', 'Achados', ['Preservada nas modalidades testadas', 'Reduzida', 'Ausente', 'Alodinia']),
      varias('distribuicao', 'Distribuição', ['Hemicorpo', 'Dermátomo', 'Território de nervo', 'Distal simétrica', 'Nível sensitivo']),
    ],
  },
  {
    id: 'coordenacao', titulo: 'Coordenação', rotuloTexto: 'Coordenação',
    linhas: [
      numeros('index', 'Índex-nariz', ladoDE(80, true)),
      numeros('calcanhar', 'Calc.-joelho', ladoDE(80, true), 'Calcanhar-joelho'),
      numeros('alternados', 'Alternados', ladoDE(80, true), 'Movimentos alternados rápidos'),
      varias('achados', 'Achados', ['Sem alterações nos testes realizados', 'Dismetria', 'Disdiadococinesia', 'Tremor de intenção']),
    ],
  },
  {
    id: 'marcha', titulo: 'Marcha e meníngeos', rotuloTexto: 'Marcha, equilíbrio e sinais meníngeos',
    linhas: [
      varias('marcha', 'Marcha', ['Sem alterações aparentes', 'Base alargada', 'Hemiparética', 'Escarvante', 'Passos curtos', 'Com apoio', 'Não avaliada']),
      texto(uma('tandem', 'Tandem', ['Preservada', 'Alterada', 'Não realizada']), 'Marcha em tandem'),
      uma('romberg', 'Romberg', ['Negativo', 'Positivo', 'Não realizado']),
      texto(uma('nuca', 'Rigidez nuca', ['Ausente', 'Presente', 'Não pesquisada']), 'Rigidez de nuca'),
    ],
  },
]

/** Endocrinologia (autor, 26/11/2026): pés por lado (D/E) numa parte própria; nódulo em caixinhas; as "Descrição" e
 * "Distribuição de gordura" vão para as Observações do fim. */
const PE = (l: 'D' | 'E') => [
  porLado('pele', 'Pele e unhas', ['Íntegras', 'Calo', 'Fissura', 'Úlcera'], l, true),
  porLado('forma', 'Forma e temp.', ['Deformidade', 'Quente', 'Frio'], l, true),
  porLado('pedioso', 'Pedioso', ['Presente', 'Reduzido', 'Ausente'], l),
  porLado('tibial', 'Tibial post.', ['Presente', 'Reduzido', 'Ausente'], l),
  porLado('monofilamento', 'Monofilamento', ['Percebido em todos os pontos', 'Não percebido em 1 ou mais', 'Não testado'], l),
  porLado('vibratoria', 'Vibratória', ['Preservada', 'Reduzida', 'Ausente', 'Não testada'], l),
]
const ENDOCRINOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais e antropometria',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      numeros('medidas', 'Medidas', [...MEDIDAS, { id: 'ca', antes: 'CA', depois: 'cm' }]),
      numeros('ortostatismo', 'Ortostatismo', [
        { id: 'pa_deitado', antes: 'Deitado', largura: 64 }, { id: 'fc_deitado', antes: 'FC', largura: 36 },
        { id: 'pa_pe', antes: 'Em pé', largura: 64 }, { id: 'fc_pe', antes: 'FC', largura: 36 }, { id: 'min', antes: 'após', depois: 'min', largura: 32 },
      ]),
    ],
  },
  {
    id: 'pele', titulo: 'Aspecto geral e pele', rotuloTexto: 'Aspecto geral e pele',
    linhas: [
      comOutro(uma('consciencia', 'Consciência', ['Alerta', 'Sonolência', 'Confusão'])),
      comOutro(varias('hidratacao', 'Hidratação', ['Preservada', 'Mucosas secas'])),
      varias('achados', 'Achados', ['Acantose nigricante', 'Acrocórdons', 'Estrias violáceas largas', 'Equimoses', 'Hiperpigmentação', 'Vitiligo', 'Pele seca', 'Edema', 'Xantomas']),
    ],
  },
  {
    id: 'tireoide', titulo: 'Tireoide e olhos', rotuloTexto: 'Tireoide, pescoço e olhos',
    linhas: [
      varias('tireoide', 'Tireoide', ['Sem aumento palpável', 'Aumento difuso', 'Aumento assimétrico', 'Nódulo palpável', 'Dor à palpação', 'Não avaliada']),
      numeros('nodulo', 'Nódulo', [
        { id: 'local', antes: 'local', largura: 90, texto: true }, { id: 'cm', antes: '', depois: 'cm', largura: 36 },
        { id: 'consist', antes: 'consist.', largura: 80, texto: true }, { id: 'mob', antes: 'mobil.', largura: 70, texto: true },
      ]),
      texto(uma('linfonodos', 'Linfonodos', ['Sem linfonodomegalia palpável', 'Palpáveis', 'Não avaliados']), 'Linfonodos cervicais'),
      varias('olhos', 'Olhos', ['Sem alterações nos itens examinados', 'Retração palpebral', 'Proptose', 'Limitação da motilidade', 'Diplopia ao exame', 'Não avaliados']),
      numeros('campos', 'Campos visuais', [{ id: 't', largura: 220, texto: true }], 'Campos visuais por confrontação'),
    ],
  },
  {
    id: 'cv_neuro', titulo: 'Coração e neuromuscular', rotuloTexto: 'Cardiovascular, neuromuscular e musculoesquelético',
    linhas: [
      texto(varias('ausculta', 'Ausculta', ['Bulhas normofonéticas', 'Sopro', 'Ritmo irregular']), 'Ausculta cardíaca'),
      uma('tremor', 'Tremor', ['Ausente ao exame', 'Presente', 'Não avaliado']),
      texto(uma('forca', 'Força prox.', ['Preservada', 'Reduzida', 'Não avaliada']), 'Força proximal'),
      texto(uma('reflexos', 'Reflexos', ['Preservados', 'Vivos', 'Reduzidos', 'Relaxamento lentificado', 'Não avaliados']), 'Reflexos profundos'),
      texto(varias('coluna', 'Coluna/marcha', ['Cifose', 'Dor vertebral localizada', 'Alteração da marcha']), 'Coluna e marcha'),
    ],
  },
  { id: 'pes', titulo: 'Pés', rotuloTexto: 'Pés', linhas: [...PE('D'), ...PE('E')] },
  {
    id: 'dirigido', titulo: 'Exame dirigido', rotuloTexto: 'Exame dirigido',
    linhas: [varias('dirigido', 'Examinado', ['Distribuição de pelos e acne', 'Ginecomastia', 'Secreção mamilar', 'Locais de aplicação de insulina'])],
  },
]

/** Linfonodos: igual na Hematologia e na Oncologia. */
const LINFONODO: CampoNumero[] = [
  { id: 'local', antes: 'local', largura: 100, texto: true }, { id: 'cm', depois: 'cm', largura: 36 },
  { id: 'consist', antes: 'consist.', largura: 80, texto: true }, { id: 'mob', antes: 'mobil.', largura: 70, texto: true },
]

/** Hematologia (autor, 26/11/2026): uma parte por área do modelo; tamanho do linfonodo e fígado/baço abaixo do rebordo em
 * caixinhas; as "Descrição" vão para as Observações do fim. */
const HEMATOLOGIA: Roteiro = [
  { id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais', linhas: [numeros('vitais', 'Sinais vitais', VITAIS), numeros('peso', 'Peso', [{ id: 'kg', depois: 'kg' }])] },
  {
    id: 'geral', titulo: 'Estado geral e perfusão', rotuloTexto: 'Estado geral e perfusão',
    linhas: [
      uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido']),
      numeros('perfusao', 'Perfusão', [{ id: 't', largura: 160, texto: true }], 'Perfusão periférica'),
      numeros('tec', 'Ench. capilar', [{ id: 's', depois: 's', largura: 36 }], 'Tempo de enchimento capilar'),
    ],
  },
  {
    id: 'pele', titulo: 'Pele e mucosas', rotuloTexto: 'Pele e mucosas',
    linhas: [varias('achados', 'Achados', ['Palidez', 'Icterícia', 'Petéquias', 'Púrpura', 'Equimoses', 'Sangramento ativo'])],
  },
  {
    id: 'linfonodos', titulo: 'Linfonodos', rotuloTexto: 'Linfonodos',
    linhas: [
      texto(varias('cadeias', 'Examinadas', ['Cervicais', 'Supraclaviculares', 'Axilares', 'Inguinais']), 'Cadeias examinadas'),
      uma('achado', 'Achado', ['Sem linfonodomegalia nas cadeias examinadas', 'Linfonodomegalia']),
      numeros('linfonodo', 'Linfonodo', LINFONODO),
      uma('dor', 'Dor', ['Indolor', 'Doloroso']),
    ],
  },
  {
    id: 'cardiopulmonar', titulo: 'Coração e pulmões', rotuloTexto: 'Cardiopulmonar',
    linhas: [varias('achados', 'Achados', ['Taquicardia', 'Sopro', 'Estertores', 'Esforço respiratório'])],
  },
  {
    id: 'abdome', titulo: 'Abdome', rotuloTexto: 'Abdome',
    linhas: [
      varias('achados', 'Achados', ['Indolor', 'Doloroso', 'Fígado palpável', 'Baço palpável', 'Massa palpável']),
      numeros('rebordo', 'Abaixo rebordo', [{ id: 'figado', antes: 'fígado', depois: 'cm', largura: 36 }, { id: 'baco', antes: 'baço', depois: 'cm', largura: 36 }], 'Abaixo do rebordo costal'),
    ],
  },
  {
    id: 'extremidades', titulo: 'Extremidades', rotuloTexto: 'Extremidades',
    linhas: [
      varias('achados', 'Achados', ['Edema unilateral', 'Edema bilateral', 'Assimetria', 'Calor', 'Dor', 'Empastamento']),
      numeros('medida', 'Medida', [{ id: 't', largura: 200, texto: true }], 'Lado e medida comparativa'),
    ],
  },
  {
    id: 'dirigido', titulo: 'Exame dirigido', rotuloTexto: 'Exame dirigido',
    linhas: [varias('dirigido', 'Examinado', ['Articulações', 'Neurológico', 'Locais de punção ou cateter'])],
  },
]

/** Infectologia (autor, 26/11/2026): uma parte por área do modelo; "Possível foco" e as descrições vão para as
 * Observações do fim. */
const INFECTOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      { ...uma('oxigenio', 'Oxigênio', ['Ar ambiente', 'O₂']), numeros: [{ id: 'fluxo', depois: 'L/min', largura: 36 }], rotuloTexto: 'SpO₂ em' },
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e perfusão', rotuloTexto: 'Estado geral, hidratação e perfusão',
    linhas: [
      varias('achados', 'Achados', ['Alerta', 'Confusão', 'Sonolência', 'Mucosas secas', 'Extremidades frias', 'Moteamento']),
      numeros('tec', 'Ench. capilar', [{ id: 's', depois: 's', largura: 36 }], 'Tempo de enchimento capilar'),
    ],
  },
  {
    id: 'pele', titulo: 'Pele e mucosas', rotuloTexto: 'Pele e mucosas',
    linhas: [varias('achados', 'Achados', ['Exantema', 'Petéquias/púrpura', 'Vesículas', 'Úlcera', 'Eritema/calor', 'Flutuação', 'Secreção', 'Necrose'])],
  },
  {
    id: 'orofaringe', titulo: 'Orofaringe e linfonodos', rotuloTexto: 'Orofaringe e linfonodos',
    linhas: [varias('achados', 'Achados', ['Hiperemia', 'Exsudato', 'Úlceras', 'Placas orais', 'Linfonodomegalia'])],
  },
  {
    id: 'respiratorio', titulo: 'Respiratório', rotuloTexto: 'Respiratório',
    linhas: [{ ...varias('achados', 'Achados', ['Sem esforço', 'Esforço respiratório', 'Murmúrio reduzido', 'Estertores', 'Sibilos']), semExclusiva: true }],
  },
  {
    id: 'cardiovascular', titulo: 'Cardiovascular', rotuloTexto: 'Cardiovascular',
    linhas: [uma('ritmo', 'Ritmo', ['Regular', 'Irregular']), uma('sopro', 'Sopro', ['Ausente', 'Presente'])],
  },
  {
    id: 'abdome', titulo: 'Abdome e urinário', rotuloTexto: 'Abdome e aparelho urinário',
    linhas: [varias('achados', 'Achados', ['Dor localizada', 'Defesa', 'Hepatomegalia', 'Esplenomegalia', 'Punho-percussão lombar dolorosa'])],
  },
  {
    id: 'neuro', titulo: 'Neurológico', rotuloTexto: 'Neurológico dirigido',
    linhas: [varias('achados', 'Achados', ['Rigidez de nuca', 'Alteração da consciência', 'Déficit focal'])],
  },
  {
    id: 'dispositivos', titulo: 'Articulações e dispositivos', rotuloTexto: 'Articulações e dispositivos',
    linhas: [varias('achados', 'Achados', ['Articulação quente, dolorosa ou com pouco movimento', 'Cateter, ferida operatória ou prótese com eritema, dor ou secreção'])],
  },
]

/** Oncologia (autor, 26/11/2026): ECOG junto dos sinais vitais; sítio tumoral com dimensões em caixinhas. */
const ONCOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais e ECOG', rotuloTexto: 'Sinais vitais, medidas e ECOG',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      numeros('medidas', 'Medidas', [{ id: 'peso', antes: 'Peso', depois: 'kg' }, { id: 'altura', antes: 'Altura', depois: 'cm' }, { id: 'variacao', antes: 'variação', largura: 140, texto: true }]),
      uma('ecog', 'ECOG', ['0', '1', '2', '3', '4', 'Não avaliado']),
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e nutrição', rotuloTexto: 'Estado geral e nutrição',
    linhas: [
      uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido']),
      varias('nutricao', 'Nutrição', ['Perda de massa muscular aparente', 'Sinais de desidratação']),
    ],
  },
  {
    id: 'pele', titulo: 'Pele e mucosas', rotuloTexto: 'Pele e mucosas',
    linhas: [varias('achados', 'Achados', ['Palidez', 'Icterícia', 'Mucosite', 'Exantema', 'Petéquias ou equimoses'])],
  },
  {
    id: 'linfonodos', titulo: 'Linfonodos', rotuloTexto: 'Linfonodos',
    linhas: [
      texto(varias('cadeias', 'Examinadas', ['Cervicais', 'Supraclaviculares', 'Axilares', 'Inguinais']), 'Cadeias examinadas'),
      uma('achado', 'Achado', ['Sem aumento palpável nas cadeias examinadas', 'Linfonodomegalia']),
      numeros('linfonodo', 'Linfonodo', LINFONODO),
    ],
  },
  {
    id: 'cardiopulmonar', titulo: 'Coração e pulmões', rotuloTexto: 'Cardiopulmonar',
    linhas: [varias('achados', 'Achados', ['Taquicardia', 'Sopro', 'Esforço respiratório', 'Murmúrio vesicular reduzido', 'Estertores'])],
  },
  {
    id: 'abdome', titulo: 'Abdome', rotuloTexto: 'Abdome',
    linhas: [varias('achados', 'Achados', ['Indolor', 'Doloroso', 'Massa palpável', 'Hepatomegalia', 'Esplenomegalia', 'Sinais de ascite'])],
  },
  {
    id: 'extremidades', titulo: 'Extremidades e neurológico', rotuloTexto: 'Extremidades e exame neurológico dirigido',
    linhas: [
      varias('achados', 'Achados', ['Edema', 'Assimetria', 'Linfedema', 'Alteração da marcha', 'Déficit motor ou sensitivo']),
      numeros('lado', 'Lado', [{ id: 't', largura: 200, texto: true }], 'Lado e intensidade'),
    ],
  },
  {
    id: 'sitio', titulo: 'Sítio tumoral ou acesso', rotuloTexto: 'Sítio tumoral, cicatriz ou acesso venoso',
    linhas: [
      numeros('regiao', 'Região', [{ id: 't', largura: 220, texto: true }], 'Região examinada'),
      varias('achados', 'Achados', ['Massa', 'Ulceração', 'Sangramento', 'Eritema', 'Secreção']),
      { ...uma('dimensoes', 'Dimensões', ['mm', 'cm']), numeros: [{ id: 'a', largura: 44 }, { id: 'b', antes: '×', largura: 44 }] },
    ],
  },
]

/** Nefrologia (autor, 26/11/2026): peso seco e diurese junto dos sinais vitais; acesso de diálise e rim transplantado
 * numa parte própria. */
const NEFROLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais e diurese', rotuloTexto: 'Sinais vitais, peso e diurese',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      uma('braco', 'Braço', ['Direito', 'Esquerdo']),
      texto(uma('posicao', 'Posição', ['Sentado', 'Deitado', 'Em pé']), 'Posição da PA'),
      numeros('peso', 'Peso', [{ id: 'atual', antes: 'atual', depois: 'kg' }, { id: 'seco', antes: 'seco', depois: 'kg' }]),
      numeros('diurese', 'Diurese', [{ id: 'ml', depois: 'mL', largura: 56 }, { id: 'h', antes: 'em', depois: 'h', largura: 36 }]),
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e perfusão', rotuloTexto: 'Estado geral e perfusão',
    linhas: [
      varias('achados', 'Achados', ['Alerta', 'Sonolência', 'Confusão', 'Mucosas secas', 'Extremidades frias']),
      numeros('tec', 'Ench. capilar', [{ id: 's', depois: 's', largura: 36 }], 'Tempo de enchimento capilar'),
    ],
  },
  {
    id: 'volemia', titulo: 'Estado volêmico', rotuloTexto: 'Estado volêmico',
    linhas: [
      varias('achados', 'Achados', ['Sem sinais clínicos de congestão', 'Turgência jugular', 'Edema periférico', 'Edema sacral', 'Sinais de ascite']),
      numeros('edema', 'Edema', [{ id: 'grau', antes: 'grau', depois: '/4+', largura: 32 }, { id: 'local', antes: 'local e simetria', largura: 160, texto: true }]),
    ],
  },
  {
    id: 'cardiopulmonar', titulo: 'Coração e pulmões', rotuloTexto: 'Cardiopulmonar',
    linhas: [
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      varias('achados', 'Achados', ['Sopro', 'Atrito pericárdico', 'Estertores', 'Esforço respiratório']),
    ],
  },
  {
    id: 'abdome', titulo: 'Abdome e trato urinário', rotuloTexto: 'Abdome e trato urinário',
    linhas: [
      varias('achados', 'Achados', ['Indolor', 'Doloroso', 'Distensão suprapúbica', 'Punho-percussão lombar dolorosa']),
      numeros('lado', 'Lado', [{ id: 't', largura: 200, texto: true }], 'Lado e localização'),
    ],
  },
  {
    id: 'pele', titulo: 'Pele e extremidades', rotuloTexto: 'Pele e extremidades',
    linhas: [
      varias('achados', 'Achados', ['Palidez', 'Escoriações', 'Púrpura', 'Lesões cutâneas']),
      numeros('pulsos', 'Pulsos', [{ id: 't', largura: 200, texto: true }], 'Pulsos periféricos'),
    ],
  },
  {
    id: 'acesso', titulo: 'Acesso de diálise ou enxerto', rotuloTexto: 'Acesso de diálise ou enxerto',
    linhas: [
      texto(uma('fistula', 'Fístula', ['Frêmito presente', 'Frêmito reduzido', 'Frêmito ausente']), 'Fístula ou enxerto vascular'),
      texto(varias('cateter', 'Cateter', ['Eritema', 'Dor', 'Secreção']), 'Cateter de diálise'),
      texto(uma('enxerto', 'Rim transpl.', ['Indolor', 'Doloroso']), 'Rim transplantado à palpação'),
    ],
  },
]

/** Exame íntimo (Ginecologia e Urologia): consentimento e quem estava presente, junto dos sinais vitais. */
const VITAIS_INTIMO: LinhaRoteiro[] = [
  numeros('vitais', 'Sinais vitais', [VITAIS[0], VITAIS[1], VITAIS[3], { id: 'peso', antes: 'Peso', depois: 'kg' }]),
  { ...uma('intimo', 'Exame íntimo', ['Consentimento registrado', 'Não realizado']), numeros: [{ id: 'motivo', antes: 'motivo', largura: 150, texto: true }] },
  numeros('presente', 'Presente', [{ id: 't', largura: 200, texto: true }], 'Acompanhante ou profissional presente'),
]

/** Ginecologia (autor, 26/11/2026): útero em caixinhas (posição, tamanho, mobilidade, dor); POP-Q em caixinha. */
const GINECOLOGIA: Roteiro = [
  { id: 'vitais', titulo: 'Sinais vitais e consentimento', rotuloTexto: 'Sinais vitais e exame íntimo', linhas: VITAIS_INTIMO },
  {
    id: 'abdome', titulo: 'Estado geral e abdome', rotuloTexto: 'Estado geral e abdome',
    linhas: [varias('achados', 'Achados', ['Palidez', 'Distensão', 'Dor à palpação', 'Defesa', 'Massa palpável'])],
  },
  {
    id: 'mamas', titulo: 'Mamas e axilas', rotuloTexto: 'Mamas e axilas',
    linhas: [
      varias('achados', 'Achados', ['Sem alterações nos itens examinados', 'Nódulo', 'Retração', 'Secreção mamilar', 'Alteração cutânea', 'Linfonodo palpável']),
      numeros('local', 'Local', [{ id: 'lado', antes: 'lado', largura: 40, texto: true }, { id: 'onde', antes: 'onde', largura: 120, texto: true }, { id: 'cm', depois: 'cm', largura: 36 }], 'Lado, localização e tamanho'),
    ],
  },
  {
    id: 'vulva', titulo: 'Vulva e períneo', rotuloTexto: 'Vulva e períneo',
    linhas: [varias('achados', 'Achados', ['Sem alterações visíveis', 'Eritema', 'Fissura', 'Úlcera', 'Lesão pigmentada', 'Massa', 'Atrofia'])],
  },
  {
    id: 'especular', titulo: 'Exame especular', rotuloTexto: 'Exame especular',
    linhas: [
      { ...varias('achados', 'Achados', ['Colo visualizado', 'Visualização limitada', 'Corrimento', 'Sangramento', 'Lesão cervical ou vaginal', 'Sangramento ao toque']) },
      numeros('aspecto', 'Aspecto', [{ id: 't', largura: 220, texto: true }], 'Origem, aspecto e quantidade'),
    ],
  },
  {
    id: 'toque', titulo: 'Toque bimanual', rotuloTexto: 'Toque bimanual',
    linhas: [
      numeros('utero', 'Útero', [
        { id: 'posicao', antes: 'posição', largura: 80, texto: true }, { id: 'tamanho', antes: 'tamanho', largura: 70, texto: true },
        { id: 'mobilidade', antes: 'mobil.', largura: 70, texto: true }, { id: 'dor', antes: 'dor', largura: 60, texto: true },
      ]),
      varias('achados', 'Achados', ['Dor à mobilização do colo', 'Dor anexial', 'Massa anexial']),
      numeros('anexo', 'Anexo', [{ id: 'lado', antes: 'lado', largura: 40, texto: true }, { id: 'cm', antes: '', depois: 'cm', largura: 50, texto: true }], 'Lado e dimensões'),
    ],
  },
  {
    id: 'assoalho', titulo: 'Assoalho pélvico', rotuloTexto: 'Assoalho pélvico',
    linhas: [
      varias('achados', 'Achados', ['Prolapso observado', 'Perda urinária ao esforço observada', 'Dor à palpação']),
      numeros('popq', 'POP-Q', [{ id: 't', largura: 200, texto: true }], 'Compartimento e grau (POP-Q)'),
    ],
  },
]

/** Urologia (autor, 26/11/2026): punho-percussão por lado; toque retal com volume em caixinha; resíduo pós-miccional junto
 * dos dispositivos. */
const UROLOGIA: Roteiro = [
  { id: 'vitais', titulo: 'Sinais vitais e consentimento', rotuloTexto: 'Sinais vitais e exame íntimo', linhas: VITAIS_INTIMO },
  {
    id: 'abdome', titulo: 'Abdome e flancos', rotuloTexto: 'Abdome e flancos',
    linhas: [
      { ...varias('achados', 'Abdome', ['Sem dor à palpação', 'Dor abdominal', 'Dor suprapúbica', 'Distensão suprapúbica', 'Massa palpável']), semExclusiva: true },
      texto(uma('ppl_d', 'Punho-perc. D', ['Sem dor', 'Dolorosa']), 'Punho-percussão lombar D'),
      texto(uma('ppl_e', 'Punho-perc. E', ['Sem dor', 'Dolorosa']), 'Punho-percussão lombar E'),
    ],
  },
  {
    id: 'inguinal', titulo: 'Região inguinal', rotuloTexto: 'Região inguinal',
    linhas: [
      varias('achados', 'Achados', ['Hérnia', 'Linfonodos palpáveis', 'Dor']),
      numeros('lado', 'Lado', [{ id: 't', largura: 160, texto: true }]),
    ],
  },
  {
    id: 'genitalia', titulo: 'Genitália e períneo', rotuloTexto: 'Genitália externa e períneo',
    linhas: [varias('achados', 'Achados', ['Sem alterações visíveis', 'Lesão', 'Eritema', 'Edema', 'Secreção uretral', 'Alteração do meato ou prepúcio'])],
  },
  {
    id: 'escroto', titulo: 'Escroto e testículos', rotuloTexto: 'Escroto, testículos e epidídimos',
    linhas: [
      varias('achados', 'Achados', ['Dor', 'Massa', 'Aumento de volume', 'Alteração da posição testicular']),
      numeros('lado', 'Lado e local', [{ id: 't', largura: 220, texto: true }], 'Lado e localização (intra ou extratesticular)'),
    ],
  },
  {
    id: 'toque', titulo: 'Toque retal', rotuloTexto: 'Toque retal',
    linhas: [
      numeros('volume', 'Volume', [{ id: 'g', depois: 'g', largura: 44 }], 'Volume prostático estimado'),
      texto(varias('prostata', 'Próstata', ['Lisa', 'Nódulo', 'Assimetria', 'Endurecimento', 'Dor']), 'Próstata'),
    ],
  },
  {
    id: 'dispositivos', titulo: 'Dispositivos e resíduo', rotuloTexto: 'Dispositivos urinários e resíduo',
    linhas: [
      varias('dispositivos', 'Dispositivos', ['Sonda vesical', 'Cistostomia', 'Nefrostomia']),
      numeros('aspecto', 'Drenagem', [{ id: 't', largura: 220, texto: true }], 'Drenagem, urina e local de inserção'),
      numeros('residuo', 'Resíduo', [{ id: 'ml', depois: 'mL', largura: 56 }], 'Resíduo pós-miccional'),
    ],
  },
]

const caixa = (id: string, rotulo: string, largura: number, rotuloTexto?: string) => numeros(id, rotulo, [{ id: 't', largura, texto: true }], rotuloTexto)

/** Geriatria (autor, 26/11/2026): ortostatismo em caixinhas (PA/FC deitado, em pé 1 e 3 min); os instrumentos
 * (4AT, Mini-Cog, Katz, Lawton, TUG) em caixinhas: preenchido = aplicado. */
const GERIATRIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais e peso', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      numeros('medidas', 'Medidas', [MEDIDAS[0], MEDIDAS[1]]),
      caixa('variacao', 'Variação', 200, 'Variação de peso e intervalo'),
    ],
  },
  {
    id: 'ortostatismo', titulo: 'Ortostatismo', rotuloTexto: 'Ortostatismo (PA/FC)',
    linhas: [
      numeros('pa', 'PA/FC', [
        { id: 'deitado', antes: 'deitado', largura: 80, texto: true }, { id: 'um', antes: '1 min', largura: 80, texto: true },
        { id: 'tres', antes: '3 min', largura: 80, texto: true },
      ], 'PA/FC'),
      caixa('sintomas', 'Sintomas', 200),
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e nutrição', rotuloTexto: 'Estado geral e nutrição',
    linhas: [
      uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido']),
      varias('achados', 'Achados', ['Mucosas secas', 'Perda aparente de massa muscular']),
    ],
  },
  {
    id: 'vigilia', titulo: 'Vigília, atenção e comunicação', rotuloTexto: 'Vigília, atenção e comunicação',
    linhas: [
      varias('achados', 'Achados', ['Alerta', 'Sonolência', 'Desatenção', 'Desorientação', 'Dificuldade de comunicação']),
      caixa('habitual', 'Habitual', 220, 'Diferença em relação ao habitual'),
    ],
  },
  {
    id: 'sentidos', titulo: 'Visão, audição e boca', rotuloTexto: 'Visão, audição e cavidade oral',
    linhas: [varias('achados', 'Achados', ['Dificuldade visual observada', 'Dificuldade auditiva observada', 'Prótese dentária', 'Alteração da dentição ou mucosa'])],
  },
  {
    id: 'cardiopulmonar', titulo: 'Coração e pulmões', rotuloTexto: 'Cardiopulmonar',
    linhas: [varias('achados', 'Achados', ['Ritmo irregular', 'Sopro', 'Estertores', 'Sibilos', 'Esforço respiratório'])],
  },
  {
    id: 'abdome', titulo: 'Abdome e extremidades', rotuloTexto: 'Abdome e extremidades',
    linhas: [
      varias('achados', 'Achados', ['Dor à palpação', 'Distensão', 'Edema', 'Alterações nos pés']),
      caixa('local', 'Local', 200),
    ],
  },
  {
    id: 'pele', titulo: 'Pele', rotuloTexto: 'Pele',
    linhas: [
      varias('achados', 'Achados', ['Equimoses', 'Ferida', 'Lesão por pressão']),
      caixa('local', 'Local e tamanho', 200, 'Localização e dimensões'),
    ],
  },
  {
    id: 'marcha', titulo: 'Força, marcha e equilíbrio', rotuloTexto: 'Força, marcha e equilíbrio',
    linhas: [
      texto(uma('levantar', 'Levantar', ['Sem apoio', 'Usa os braços', 'Precisa de ajuda']), 'Levanta da cadeira'),
      varias('marcha', 'Marcha', ['Instável', 'Usa dispositivo de apoio']),
      caixa('detalhe', 'Detalhes', 220, 'Lado, padrão e grau de assistência'),
    ],
  },
  {
    id: 'instrumentos', titulo: 'Instrumentos', rotuloTexto: 'Instrumentos', ajuda: 'Preencha só os aplicados',
    linhas: [
      numeros('escores', 'Resultado', [
        { id: '4at', antes: '4AT', largura: 36 }, { id: 'minicog', antes: 'Mini-Cog', largura: 36 }, { id: 'katz', antes: 'Katz', largura: 36 },
        { id: 'lawton', antes: 'Lawton', largura: 36 }, { id: 'tug', antes: 'TUG', depois: 's', largura: 40 },
      ], 'Resultados'),
    ],
  },
]

/** Pediatria (autor, 26/11/2026): idade corrigida, medidas e curva numa parte; sinais vitais com PA quando indicada;
 * fontanela, otoscopia e reflexo vermelho por lado em caixinhas. */
const PEDIATRIA: Roteiro = [
  {
    id: 'medidas', titulo: 'Medidas e curva', rotuloTexto: 'Medidas',
    linhas: [
      caixa('corrigida', 'Idade corrig.', 100, 'Idade corrigida'),
      numeros('medidas', 'Medidas', [
        { id: 'peso', antes: 'Peso', depois: 'kg' }, { id: 'altura', antes: 'Compr./altura', depois: 'cm' },
        { id: 'imc', antes: 'IMC', depois: 'kg/m²' }, { id: 'pc', antes: 'PC', depois: 'cm' },
      ]),
      caixa('curva', 'Curva', 240, 'Curva, percentil ou escore Z e trajetória'),
    ],
  },
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais',
    linhas: [numeros('vitais', 'Sinais vitais', [VITAIS[3], VITAIS[1], VITAIS[2], VITAIS[4], VITAIS[0]])],
  },
  {
    id: 'geral', titulo: 'Estado geral e hidratação', rotuloTexto: 'Estado geral, hidratação e perfusão',
    linhas: [
      varias('achados', 'Achados', ['Alerta e interativo', 'Irritável', 'Sonolento', 'Mucosas secas', 'Extremidades frias']),
      numeros('tec', 'Ench. capilar', [{ id: 's', depois: 's', largura: 36 }], 'Tempo de enchimento capilar'),
    ],
  },
  {
    id: 'pele', titulo: 'Pele e mucosas', rotuloTexto: 'Pele e mucosas',
    linhas: [
      varias('achados', 'Achados', ['Palidez', 'Icterícia', 'Cianose', 'Exantema', 'Petéquias', 'Equimoses']),
      caixa('local', 'Local e aspecto', 200, 'Localização e aspecto'),
    ],
  },
  {
    id: 'cabeca', titulo: 'Cabeça e pescoço', rotuloTexto: 'Cabeça e pescoço',
    linhas: [
      uma('fontanela', 'Fontanela', ['Plana', 'Abaulada', 'Deprimida']),
      numeros('otoscopia', 'Otoscopia', ladoDE(110, true)),
      caixa('orofaringe', 'Orofaringe', 200),
      caixa('linfonodos', 'Linfonodos', 200),
      numeros('reflexo', 'Reflexo verm.', ladoDE(90, true), 'Reflexo vermelho'),
    ],
  },
  {
    id: 'respiratorio', titulo: 'Respiratório', rotuloTexto: 'Respiratório',
    linhas: [
      varias('esforco', 'Esforço', ['Sem esforço', 'Tiragens', 'Batimento de asas nasais', 'Gemência', 'Estridor']),
      varias('ausculta', 'Ausculta', ['Sibilos', 'Estertores']),
      caixa('local', 'Lado e local', 200, 'Lado e localização'),
    ],
  },
  {
    id: 'cardiovascular', titulo: 'Cardiovascular', rotuloTexto: 'Cardiovascular',
    linhas: [
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      varias('sopro', 'Sopro', ['Presente']),
      caixa('bulhas', 'Bulhas e sopro', 200),
      caixa('pulsos', 'Pulsos', 200, 'Pulsos periféricos e femorais'),
    ],
  },
  {
    id: 'abdome', titulo: 'Abdome', rotuloTexto: 'Abdome',
    linhas: [
      varias('achados', 'Achados', ['Flácido', 'Distendido', 'Indolor', 'Doloroso', 'Defesa', 'Massa ou visceromegalia']),
      caixa('regiao', 'Região', 200),
    ],
  },
  {
    id: 'neuro', titulo: 'Neurológico e locomotor', rotuloTexto: 'Neurológico e musculoesquelético',
    linhas: [
      varias('achados', 'Achados', ['Movimentos simétricos', 'Assimetria', 'Hipotonia', 'Hipertonia', 'Alteração da marcha']),
      caixa('idade', 'Para a idade', 220, 'Achados conforme a idade'),
    ],
  },
  {
    id: 'dirigido', titulo: 'Exame dirigido', rotuloTexto: 'Exame dirigido',
    linhas: [
      varias('examinado', 'Examinado', ['Quadris', 'Coluna', 'Genitália', 'Estadiamento puberal']),
      caixa('achados', 'Achados', 240),
    ],
  },
]

/** Psiquiatria (autor, 26/11/2026): exame do estado mental por domínios; o exame físico dirigido no fim. */
const PSIQUIATRIA: Roteiro = [
  {
    id: 'apresentacao', titulo: 'Apresentação e atitude', rotuloTexto: 'Apresentação e atitude',
    linhas: [
      uma('autocuidado', 'Autocuidado', ['Preservado', 'Prejuízo aparente']),
      uma('atitude', 'Atitude', ['Cooperativo', 'Reservado', 'Hostil']),
    ],
  },
  {
    id: 'vigilia', titulo: 'Vigília, orientação e atenção', rotuloTexto: 'Vigília, orientação e atenção',
    linhas: [
      uma('vigilia', 'Vigília', ['Alerta', 'Sonolento', 'Flutuante']),
      texto(varias('orientado', 'Orientado em', ['Pessoa', 'Tempo', 'Espaço']), 'Orientado em'),
      caixa('atencao', 'Atenção', 220, 'Atenção e teste utilizado'),
    ],
  },
  {
    id: 'psicomotricidade', titulo: 'Psicomotricidade', rotuloTexto: 'Psicomotricidade',
    linhas: [varias('achados', 'Achados', ['Sem alterações observadas', 'Lentificação', 'Agitação', 'Inquietação', 'Tremor', 'Movimentos involuntários'])],
  },
  {
    id: 'fala', titulo: 'Fala', rotuloTexto: 'Fala',
    linhas: [varias('achados', 'Achados', ['Espontânea', 'Escassa', 'Acelerada', 'Pressionada', 'Latência aumentada', 'Mutismo'])],
  },
  {
    id: 'humor', titulo: 'Humor e afeto', rotuloTexto: 'Humor e afeto',
    linhas: [
      caixa('relatado', 'Humor relatado', 200),
      uma('afeto', 'Afeto', ['Amplo', 'Restrito', 'Embotado', 'Lábil']),
      caixa('congruencia', 'Congruência', 200, 'Congruência e reatividade'),
    ],
  },
  {
    id: 'curso', titulo: 'Curso e forma do pensamento', rotuloTexto: 'Curso e forma do pensamento',
    linhas: [varias('achados', 'Achados', ['Linear', 'Circunstancial', 'Tangencial', 'Fuga de ideias', 'Bloqueios', 'Desorganizado'])],
  },
  {
    id: 'conteudo', titulo: 'Conteúdo do pensamento', rotuloTexto: 'Conteúdo do pensamento',
    linhas: [
      varias('achados', 'Achados', ['Preocupações predominantes', 'Obsessões', 'Ideias delirantes']),
      caixa('temas', 'Temas', 240, 'Temas, convicção e repercussão'),
    ],
  },
  {
    id: 'sensopercepcao', titulo: 'Sensopercepção', rotuloTexto: 'Sensopercepção',
    linhas: [
      varias('achados', 'Achados', ['Sem alterações referidas', 'Alucinações', 'Ilusões']),
      caixa('modalidade', 'Modalidade', 240, 'Modalidade, contexto e repercussão'),
    ],
  },
  {
    id: 'critica', titulo: 'Memória, crítica e juízo', rotuloTexto: 'Memória, crítica e juízo',
    linhas: [
      caixa('memoria', 'Memória', 220, 'Memória (testada)'),
      caixa('reconhece', 'Crítica', 220, 'Reconhecimento das alterações'),
      caixa('juizo', 'Juízo', 220, 'Capacidade de avaliar consequências e decidir'),
    ],
  },
  {
    id: 'fisico', titulo: 'Exame físico dirigido', rotuloTexto: 'Exame físico dirigido',
    linhas: [
      numeros('vitais', 'Sinais vitais', [VITAIS[0], VITAIS[1], VITAIS[3], { id: 'peso', antes: 'Peso', depois: 'kg' }]),
      comOutro(varias('achados', 'Achados', ['Tremor', 'Rigidez', 'Acatisia', 'Marcha alterada'])),
    ],
  },
]

/** Otorrinolaringologia (autor, 26/11/2026): otoscopia por lado em caixinhas e achados; Weber e Rinne numa parte. */
const OTORRINOLARINGOLOGIA: Roteiro = [
  { id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais', linhas: [numeros('vitais', 'Sinais vitais', VITAIS)] },
  {
    id: 'geral', titulo: 'Estado geral, voz e respiração', rotuloTexto: 'Estado geral, voz e respiração',
    linhas: [
      varias('respiracao', 'Respiração', ['Sem esforço respiratório', 'Esforço respiratório', 'Estridor']),
      { ...varias('voz', 'Voz', ['Disfonia', 'Voz abafada']), rotuloTexto: 'Voz' },
      caixa('secrecoes', 'Secreções', 220, 'Manejo de secreções'),
    ],
  },
  {
    id: 'orelhas', titulo: 'Orelhas e mastoides', rotuloTexto: 'Orelhas e mastoides',
    linhas: [
      varias('achados', 'Pavilhão', ['Sem alterações visíveis', 'Dor', 'Eritema', 'Edema']),
      caixa('lado', 'Lado', 120),
    ],
  },
  {
    id: 'otoscopia', titulo: 'Otoscopia', rotuloTexto: 'Otoscopia',
    linhas: [
      numeros('conduto', 'Conduto', ladoDE(120, true)),
      numeros('membrana', 'Membrana timp.', ladoDE(120, true), 'Membrana timpânica'),
      varias('achados', 'Achados', ['Cerume obstrutivo', 'Secreção', 'Abaulamento', 'Retração', 'Perfuração', 'Visualização limitada']),
      caixa('lado', 'Lado', 120),
    ],
  },
  {
    id: 'audicao', titulo: 'Avaliação auditiva', rotuloTexto: 'Avaliação auditiva',
    linhas: [
      uma('weber', 'Weber', ['Central', 'Lateraliza à D', 'Lateraliza à E']),
      numeros('rinne', 'Rinne', ladoDE(90, true)),
    ],
  },
  {
    id: 'nariz', titulo: 'Nariz e rinoscopia', rotuloTexto: 'Nariz e rinoscopia anterior',
    linhas: [
      varias('achados', 'Achados', ['Desvio septal', 'Edema de cornetos', 'Secreção', 'Crostas', 'Sangramento ativo', 'Massa visível']),
      caixa('local', 'Lado e local', 220, 'Lado, local e aspecto'),
    ],
  },
  {
    id: 'orofaringe', titulo: 'Boca e orofaringe', rotuloTexto: 'Cavidade oral e orofaringe',
    linhas: [
      varias('achados', 'Achados', ['Trismo', 'Exsudato', 'Assimetria tonsilar', 'Abaulamento peritonsilar', 'Desvio da úvula', 'Lesão de mucosa']),
      caixa('local', 'Local', 220, 'Local e descrição'),
    ],
  },
  {
    id: 'pescoco', titulo: 'Pescoço', rotuloTexto: 'Pescoço',
    linhas: [
      varias('achados', 'Achados', ['Linfonodo palpável', 'Massa cervical', 'Dor', 'Edema']),
      numeros('massa', 'Local', [
        { id: 'local', antes: 'local e lado', largura: 120, texto: true }, { id: 'cm', depois: 'cm', largura: 36 },
        { id: 'consistencia', antes: 'consist. e mobil.', largura: 120, texto: true },
      ], 'Local, tamanho, consistência e mobilidade'),
    ],
  },
  {
    id: 'vestibular', titulo: 'Vestibular ou endoscópico', rotuloTexto: 'Exame vestibular ou endoscópico',
    linhas: [
      varias('achados', 'Achados', ['Nistagmo', 'Alteração da marcha']),
      caixa('teste', 'Teste e achados', 240, 'Teste ou procedimento, lado e achados'),
    ],
  },
]

/** Pneumologia (autor, 26/11/2026): SpO₂ em ar ambiente ou oxigênio junto dos sinais vitais; SpO₂ ao esforço numa parte própria. */
const PNEUMOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais e oxigênio', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      texto(uma('o2', 'SpO₂ em', ['Ar ambiente', 'Oxigênio']), 'SpO₂ em'),
      caixa('fluxo', 'Disp. e fluxo', 180, 'Dispositivo e fluxo de oxigênio'),
      numeros('medidas', 'Medidas', MEDIDAS),
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e esforço', rotuloTexto: 'Estado geral e esforço respiratório',
    linhas: [varias('achados', 'Achados', ['Eupneia', 'Taquipneia', 'Musculatura acessória', 'Tiragens', 'Fala entrecortada', 'Cianose'])],
  },
  {
    id: 'torax', titulo: 'Inspeção e palpação', rotuloTexto: 'Inspeção e palpação do tórax',
    linhas: [
      uma('expansibilidade', 'Expansibilidade', ['Simétrica', 'Reduzida à D', 'Reduzida à E']),
      caixa('fremito', 'Frêmito', 200, 'Frêmito toracovocal'),
    ],
  },
  {
    id: 'percussao', titulo: 'Percussão', rotuloTexto: 'Percussão',
    linhas: [
      varias('achados', 'Achados', ['Som claro pulmonar', 'Macicez', 'Hipersonoridade']),
      caixa('regiao', 'Região e lado', 200),
    ],
  },
  {
    id: 'ausculta', titulo: 'Ausculta', rotuloTexto: 'Ausculta',
    linhas: [
      uma('mv', 'Murmúrio', ['Presente bilateral', 'Reduzido', 'Abolido']),
      varias('ruidos', 'Ruídos', ['Sibilos', 'Roncos', 'Estertores', 'Atrito pleural']),
      caixa('local', 'Lado e fase', 220, 'Lado, região e fase respiratória'),
    ],
  },
  {
    id: 'cardiovascular', titulo: 'Coração e extremidades', rotuloTexto: 'Cardiovascular e extremidades',
    linhas: [varias('achados', 'Achados', ['Ritmo irregular', 'Sopro', 'Turgência jugular', 'Edema', 'Assimetria de MMII', 'Baqueteamento digital'])],
  },
  {
    id: 'dessaturacao', titulo: 'SpO₂ ao esforço', rotuloTexto: 'SpO₂ ao esforço',
    linhas: [
      numeros('teste', 'Teste', [
        { id: 'nome', antes: 'teste', largura: 100, texto: true }, { id: 'basal', antes: 'basal', depois: '%' }, { id: 'menor', antes: 'menor', depois: '%' },
      ], 'Teste e SpO₂'),
      caixa('sintomas', 'Sintomas', 200),
    ],
  },
]

/** Hepatologia (autor, 26/11/2026): asterixe e ascite com "não pesquisada"; fígado e baço na palpação. */
const HEPATOLOGIA: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [
      numeros('vitais', 'Sinais vitais', VITAIS),
      numeros('medidas', 'Medidas', [MEDIDAS[0], { id: 'ca', antes: 'Circ. abdominal', depois: 'cm' }]),
    ],
  },
  {
    id: 'geral', titulo: 'Estado geral e nutrição', rotuloTexto: 'Estado geral, nutrição e perfusão',
    linhas: [
      uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido']),
      varias('achados', 'Achados', ['Perda aparente de massa muscular', 'Perfusão periférica reduzida']),
    ],
  },
  {
    id: 'vigilia', titulo: 'Vigília e cognição', rotuloTexto: 'Vigília e cognição',
    linhas: [
      varias('achados', 'Achados', ['Alerta', 'Sonolento', 'Desatento', 'Desorientado']),
      uma('asterixe', 'Asterixe', ['Presente', 'Ausente', 'Não pesquisada']),
      caixa('habitual', 'Habitual', 220, 'Comparação com o estado habitual'),
    ],
  },
  {
    id: 'pele', titulo: 'Pele, olhos e mucosas', rotuloTexto: 'Pele, olhos e mucosas',
    linhas: [
      varias('achados', 'Achados', ['Icterícia', 'Palidez', 'Escoriações', 'Aranhas vasculares', 'Eritema palmar', 'Equimoses']),
      caixa('local', 'Local', 200, 'Local e descrição'),
    ],
  },
  {
    id: 'inspecao', titulo: 'Inspeção e percussão', rotuloTexto: 'Inspeção e percussão abdominal',
    linhas: [
      varias('achados', 'Achados', ['Distensão', 'Circulação colateral', 'Hérnia umbilical', 'Macicez móvel']),
      texto(uma('ascite', 'Ascite', ['Presente', 'Ausente', 'Não pesquisada']), 'Sinais clínicos de ascite'),
    ],
  },
  {
    id: 'palpacao', titulo: 'Palpação abdominal', rotuloTexto: 'Palpação abdominal',
    linhas: [
      varias('achados', 'Achados', ['Indolor', 'Dor localizada', 'Dor difusa', 'Defesa', 'Fígado palpável', 'Baço palpável']),
      caixa('local', 'Local e extensão', 240, 'Local, extensão abaixo do rebordo costal e características'),
    ],
  },
  {
    id: 'extremidades', titulo: 'Extremidades e pulmões', rotuloTexto: 'Extremidades e ausculta pulmonar',
    linhas: [
      varias('achados', 'Achados', ['Edema periférico', 'MV reduzido em base', 'Estertores']),
      caixa('lado', 'Lado e grau', 200, 'Lado, extensão e grau'),
    ],
  },
]

/** Cirurgia Geral (autor, 26/11/2026): "se examinado/indicado" vira ajuda da parte; locais e dimensões em caixinhas. */
const CIRURGIA_GERAL: Roteiro = [
  {
    id: 'vitais', titulo: 'Sinais vitais', rotuloTexto: 'Sinais vitais e medidas',
    linhas: [numeros('vitais', 'Sinais vitais', VITAIS), numeros('medidas', 'Medidas', [MEDIDAS[0], MEDIDAS[1]])],
  },
  {
    id: 'geral', titulo: 'Estado geral e perfusão', rotuloTexto: 'Estado geral e perfusão',
    linhas: [
      uma('estado', 'Estado geral', ['Bom', 'Regular', 'Comprometido']),
      varias('achados', 'Achados', ['Palidez', 'Icterícia', 'Mucosas secas', 'Perfusão periférica reduzida']),
      numeros('tec', 'TEC', [{ id: 's', depois: 's' }], 'Tempo de enchimento capilar'),
    ],
  },
  {
    id: 'cardiopulmonar', titulo: 'Cardiopulmonar', rotuloTexto: 'Cardiopulmonar', ajuda: 'Se examinado',
    linhas: [
      uma('ritmo', 'Ritmo', ['Regular', 'Irregular']),
      varias('achados', 'Achados', ['Sopro', 'Esforço respiratório', 'Estertores']),
    ],
  },
  {
    id: 'abdome_insp', titulo: 'Abdome: inspeção e ausculta', rotuloTexto: 'Abdome (inspeção e ausculta)',
    linhas: [
      uma('contorno', 'Contorno', ['Plano', 'Globoso', 'Distendido']),
      varias('achados', 'Achados', ['Cicatriz', 'Estoma', 'Abaulamento']),
      texto(uma('rha', 'RHA', ['Presentes', 'Aumentados', 'Reduzidos', 'Ausentes', 'Não avaliados']), 'Ruídos hidroaéreos'),
    ],
  },
  {
    id: 'abdome_palp', titulo: 'Abdome: percussão e palpação', rotuloTexto: 'Abdome (percussão e palpação)',
    linhas: [
      varias('percussao', 'Percussão', ['Predomínio timpânico', 'Macicez localizada']),
      varias('palpacao', 'Palpação', ['Flácido', 'Dor localizada', 'Dor difusa', 'Defesa involuntária', 'Rigidez', 'Massa palpável']),
      caixa('local', 'Local e intensidade', 240, 'Local, intensidade e descrição'),
    ],
  },
  {
    id: 'sinais', titulo: 'Sinais dirigidos', rotuloTexto: 'Sinais dirigidos', ajuda: 'Se pesquisados',
    linhas: [
      texto(uma('murphy', 'Murphy', ['Positivo', 'Negativo', 'Não pesquisado']), 'Sinal de Murphy'),
      texto(uma('descompressao', 'Descompressão', ['Dor presente', 'Dor ausente', 'Não pesquisada']), 'Descompressão brusca'),
      caixa('local', 'Local', 200),
    ],
  },
  {
    id: 'parede', titulo: 'Parede abdominal e virilhas', rotuloTexto: 'Parede abdominal e regiões inguinais',
    linhas: [
      caixa('local', 'Local e lado', 200),
      varias('achados', 'Achados', ['Abaulamento ao esforço', 'Redutível', 'Irredutível', 'Doloroso', 'Pele alterada sobre o abaulamento']),
      caixa('posicao', 'Posição e medidas', 240, 'Posição do exame e dimensões'),
    ],
  },
  {
    id: 'ferida', titulo: 'Ferida, dreno ou estoma', rotuloTexto: 'Ferida operatória, dreno ou estoma',
    linhas: [
      caixa('local', 'Local', 200, 'Local da ferida'),
      varias('ferida', 'Ferida', ['Bordas coaptadas', 'Abertura', 'Eritema', 'Calor', 'Secreção', 'Sangramento']),
      numeros('dreno', 'Dreno', [{ id: 'ml', antes: 'Débito', depois: 'mL', largura: 48 }, { id: 'h', antes: 'em', depois: 'h', largura: 36 },
        { id: 'aspecto', antes: 'aspecto', largura: 140, texto: true }]),
      caixa('estoma', 'Estoma', 240, 'Estoma (cor, perfusão e débito)'),
    ],
  },
  {
    id: 'pele_anal', titulo: 'Pele ou região anorretal', rotuloTexto: 'Pele ou região anorretal', ajuda: 'Se indicado',
    linhas: [
      caixa('exame', 'Exame feito', 200, 'Exame realizado'),
      varias('achados', 'Achados', ['Nódulo', 'Flutuação', 'Eritema', 'Secreção', 'Fissura', 'Sangramento']),
      caixa('local', 'Local e medidas', 240, 'Local, dimensões e características'),
    ],
  },
]

const ROTEIROS: Partial<Record<string, Roteiro>> = {
  reumatologia: REUMATOLOGIA, dermatologia: DERMATOLOGIA, cardiologia: CARDIOLOGIA, gastroenterologia: GASTROENTEROLOGIA,
  neurologia: NEUROLOGIA, endocrinologia: ENDOCRINOLOGIA, hematologia: HEMATOLOGIA, infectologia: INFECTOLOGIA,
  oncologia: ONCOLOGIA, nefrologia: NEFROLOGIA, ginecologia: GINECOLOGIA, urologia: UROLOGIA,
  geriatria: GERIATRIA, pediatria: PEDIATRIA, psiquiatria: PSIQUIATRIA, otorrinolaringologia: OTORRINOLARINGOLOGIA,
  pneumologia: PNEUMOLOGIA, hepatologia: HEPATOLOGIA, 'cirurgia-geral': CIRURGIA_GERAL,
}

/** O roteiro do exame da especialidade; undefined = exame com campos de texto (especialidade sem roteiro). */
export const roteiroDoExame = (especialidade: string): Roteiro | undefined => ROTEIROS[especialidade]

export const chaveDaLinha = (parte: ParteRoteiro, linha: LinhaRoteiro) => `${parte.id}.${linha.id}`

/** Opção que exclui as outras da linha ("Sem alterações", "Não examinadas", "Não palpáveis"…), como o "Nenhum desses"
 * do formulário: marcá-la limpa as outras; marcar outra a desmarca. */
export const exclusiva = (opcao: string) => /^(Sem |Não )/.test(opcao)

/** Marca ou desmarca: em linha de uma resposta, a nova troca a anterior; tocar de novo desmarca. */
export function alternarMarca(marcas: MarcasExame, chave: string, opcao: string, multipla: boolean, comExclusiva = true): MarcasExame {
  const atuais = marcas[chave] ?? []
  const excl = (o: string) => comExclusiva && exclusiva(o)
  const novas = atuais.includes(opcao)
    ? atuais.filter((o) => o !== opcao)
    : !multipla || excl(opcao) ? [opcao] : [...atuais.filter((o) => !excl(o)), opcao]
  const resto = Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== chave && !(k === `${chave}#outro` && !novas.includes('Outro'))))
  return novas.length ? { ...resto, [chave]: novas } : resto
}

/** Escreve numa caixinha (número ou "Outro"): vazio apaga. */
export function escreverCampo(marcas: MarcasExame, chave: string, valor: string): MarcasExame {
  const resto = Object.fromEntries(Object.entries(marcas).filter(([k]) => k !== chave))
  return valor.trim() ? { ...resto, [chave]: [valor] } : resto
}

// siglas ("ADM", "MCFs") e números romanos (fototipo "I", "V") ficam como estão
const minuscula = (t: string) => (/^[A-ZÀ-Ú]{2}/.test(t) || /^[IVX]+$/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const lista = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
const ponto = (t: string) => (t.endsWith('.') ? t : `${t}.`)
/** concordância do GALS: "braços normais", "pernas alteradas", "coluna alterada" */
const FEMININO_PLURAL = new Set(['pernas'])
const PLURAL = new Set(['bracos', 'pernas'])
function estadoGals(linha: LinhaRoteiro, valor: string): string {
  const v = valor.toLowerCase()
  if (linha.id === 'marcha') return `marcha ${v}`
  const plural = PLURAL.has(linha.id)
  const feminino = FEMININO_PLURAL.has(linha.id) || linha.id === 'coluna'
  const base = v === 'normal' ? (plural ? 'normais' : 'normal') : feminino ? (plural ? 'alteradas' : 'alterada') : plural ? 'alterados' : 'alterado'
  return `${linha.rotulo.toLowerCase()} ${base}`
}

const valorCampo = (marcas: MarcasExame, chave: string) => marcas[chave]?.[0]?.trim() ?? ''

/** As opções marcadas da linha, com o "Outro" trocado pelo que o médico escreveu (sem texto, fica de fora). */
function marcadasDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string[] {
  const chave = chaveDaLinha(parte, l)
  const outro = valorCampo(marcas, `${chave}#outro`)
  return (marcas[chave] ?? []).flatMap((o) => (l.outro && o === 'Outro' ? (outro ? [outro] : []) : [o]))
}

/** Caixinhas de número em texto: "PA 120/80 mmHg, FC 80 bpm"; dimensões "12 × 8 mm"; vazio = "". */
function numerosDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string {
  if (!l.numeros) return ''
  const chave = chaveDaLinha(parte, l)
  const cheios = l.numeros.map((n) => ({ n, v: valorCampo(marcas, `${chave}#${n.id}`) })).filter((x) => x.v)
  if (l.id === 'dimensoes') {
    if (!cheios.length) return ''
    const unidade = (marcas[chave] ?? []).find((o) => o === 'mm' || o === 'cm') ?? ''
    return [cheios.map((x) => x.v).join(' × '), unidade].filter(Boolean).join(' ')
  }
  // caixinha que começa com "/" continua a anterior ("D 5/4" na força flexão/extensão)
  return cheios.reduce<string[]>((partes, { n, v }) => {
    const valor = `${v}${/^[%/]/.test(n.depois ?? '') ? '' : n.depois ? ' ' : ''}${n.depois ?? ''}`
    if (n.antes === '/' && partes.length) partes[partes.length - 1] += `/${valor}`
    else partes.push([n.antes, valor].filter(Boolean).join(' '))
    return partes
  }, []).join(', ')
}

/** O que a linha diz, em texto: números e opções ("12 × 8 mm"; "ressecada, oleosa"); "" = nada. */
function valorDaLinha(parte: ParteRoteiro, l: LinhaRoteiro, marcas: MarcasExame): string {
  const numeros = numerosDaLinha(parte, l, marcas)
  const opcoes = marcadasDaLinha(parte, l, marcas).filter((o) => !(l.id === 'dimensoes' && numeros && (o === 'mm' || o === 'cm')))
  return [numeros, lista(opcoes.map(minuscula))].filter(Boolean).join(', ')
}

/** O texto de uma parte, só com o que foi marcado; null = parte não examinada (nada marcado). */
export function textoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string | null {
  const de = (l: LinhaRoteiro) => marcadasDaLinha(parte, l, marcas)
  const linhasDoTexto = parte.linhas.filter((l) => !l.campoProprio)
  const marcadas = linhasDoTexto.filter((l) => valorDaLinha(parte, l, marcas))
  if (!marcadas.length) return null
  switch (parte.id) {
    case 'gals':
      return ponto(minuscula(marcadas.map((l) => estadoGals(l, de(l)[0])).join('; ')).replace(/^./, (c) => c.toUpperCase()))
    case 'mapa':
      // "Ombro D; MCFs D e E; coluna lombar."
      return ponto(marcadas.map((l) => (l.opcoes.length === 1 ? l.rotulo : `${l.rotulo} ${lista(de(l))}`)).map((t, i) => (i ? minuscula(t) : t)).join('; '))
    case 'ipam': {
      const frases: string[] = []
      for (const l of marcadas.filter((x) => !x.grupo)) {
        if (l.id === 'inspecao' || l.id === 'palpacao') frases.push(`${l.rotulo}: ${lista(de(l).map(minuscula))}.`)
        else if (l.id === 'crepitacao') frases.push('Crepitação palpável/audível.')
        else frases.push(`${l.rotulo} ${minuscula(de(l)[0])}.`)
      }
      const manobras = marcadas.filter((x) => x.grupo === 'Manobras positivas')
      if (manobras.length) frases.push(`Manobras positivas: ${manobras.map((l) => `${de(l).join(', ')} (${l.rotulo.toLowerCase().replace('/si', '/SI')})`).join('; ')}.`)
      return frases.join(' ')
    }
    case 'padrao':
      return ponto(marcadas.map((l) => de(l)[0]).map((t, i) => (i ? minuscula(t) : t)).join(', '))
    default:
      // uma linha só (ex.: Extra-articular): as opções; várias (ex.: Dermatologia): "Hidratação: ressecada; cor: …"
      // (uma linha só de caixinhas, como Sinais vitais, vai no formato de várias: "Sinais vitais: PA …")
      if (linhasDoTexto.length === 1 && !linhasDoTexto[0].numeros) return ponto(marcadas.flatMap(de).map((t, i) => (i ? minuscula(t) : t)).join('; '))
      return ponto(marcadas.map((l, i) => `${i ? minuscula(l.rotuloTexto ?? l.rotulo) : (l.rotuloTexto ?? l.rotulo)}: ${valorDaLinha(parte, l, marcas)}`).join('; '))
  }
}

/** As linhas com campo próprio (ex.: Extensão), em texto; vazio = não preenchida. */
function camposProprios(roteiro: Roteiro, marcas: MarcasExame): { rotulo: string; valor: string | null }[] {
  return roteiro.flatMap((p) => p.linhas.filter((l) => l.campoProprio).map((l) => ({ rotulo: l.campoProprio!, valor: valorDaLinha(p, l, marcas) || null })))
}

/** Resumo de uma linha para a parte fechada ("Marcha claudicante · Pernas alteradas"). */
export function resumoDaParte(parte: ParteRoteiro, marcas: MarcasExame): string {
  const proprios = parte.linhas.filter((l) => l.campoProprio).map((l) => valorDaLinha(parte, l, marcas)).filter(Boolean).map((v) => `extensão ${v}`)
  return [(textoDaParte(parte, marcas) ?? '').replace(/\.$/, ''), ...proprios].filter(Boolean).join('; ').replace(/; /g, ' · ')
}

/** A parte tem algo preenchido (marca, número ou campo próprio)? */
export const parteFeita = (parte: ParteRoteiro, marcas: MarcasExame) => parte.linhas.some((l) => valorDaLinha(parte, l, marcas))

/** Retorno: no fim, antes das Observações, a comparação com a consulta anterior (autor, 24/11/2026). */
export const COMPARADO = { chave: 'retorno.comparado', rotulo: 'Comparado à consulta anterior', opcoes: ['Melhor', 'Igual', 'Pior'] }

/** O exame inteiro em campos de texto (parte → texto), como vai para o servidor e para a história. */
export function camposDoRoteiro(roteiro: Roteiro, marcas: MarcasExame, retorno = false): { rotulo: string; valor: string | null }[] {
  const campos = [...roteiro.map((p) => ({ rotulo: p.rotuloTexto, valor: textoDaParte(p, marcas) })), ...camposProprios(roteiro, marcas)]
  return retorno ? [...campos, { rotulo: COMPARADO.rotulo, valor: marcas[COMPARADO.chave]?.[0] ?? null }] : campos
}
