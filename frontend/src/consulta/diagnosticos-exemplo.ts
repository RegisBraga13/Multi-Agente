// Hipóteses de exemplo (Dermatologia) para os pacientes fictícios da agenda. Simulam a IA:
// cada pista só vale se o termo estiver na seção da história salva. CID-10.
import type { NaoPerder } from './diagnosticos'

type Pista = { lado: 'favor' | 'contra'; texto: string; secao: string; termo: RegExp }
type Modelo = { hipoteses: { id: string; nome: string; cid: string; /** % com todas as pistas presentes */ base: number; pistas: Pista[] }[]; naoPerder: NaoPerder | null }

const ID = 'Identificação'
const QP = 'Queixa principal'
const ANT = 'Antecedentes e alertas'
const EF = 'Exame físico'
const EX = 'Exames complementares'
const a = (texto: string, secao: string, termo: RegExp): Pista => ({ lado: 'favor', texto, secao, termo })
const c = (texto: string, secao: string, termo: RegExp): Pista => ({ lado: 'contra', texto, secao, termo })

export const MODELOS: Record<string, Modelo> = {
  'Mariana Costa': {
    hipoteses: [
      { id: 'acne', nome: 'Acne grau II · papulopustulosa', cid: 'L70.0', base: 64, pistas: [a('Comedões, pápulas e pústulas', EF, /comed/i), a('Piora antes da menstruação', QP, /menstrua/i), a('Rosto e costas', QP, /costas/i)] },
      { id: 'rosacea', nome: 'Rosácea', cid: 'L71.9', base: 21, pistas: [a('Lesões na região malar', EF, /malar/i), c('Comedões não são da rosácea', EF, /comed/i)] },
      { id: 'perioral', nome: 'Dermatite perioral', cid: 'L71.0', base: 9, pistas: [a('Pápulas e pústulas na face', EF, /pústula/i), c('Acomete também o dorso', EF, /dorso/i)] },
    ],
    naoPerder: null,
  },
  'João Pedro Lima': {
    hipoteses: [
      { id: 'psoriase', nome: 'Psoríase vulgar', cid: 'L40.0', base: 72, pistas: [a('Escamas prateadas', EF, /prateada/i), a('Cotovelos e joelhos, simétrica', EF, /cotovelos/i), c('Unhas sem depressões', EF, /sem depress/i)] },
      { id: 'numular', nome: 'Eczema numular', cid: 'L30.0', base: 14, pistas: [a('Placas eritematosas', EF, /eritematosa/i), c('Escamas prateadas', EF, /prateada/i)] },
      { id: 'liquen', nome: 'Líquen simples crônico', cid: 'L28.0', base: 8, pistas: [a('Áreas de apoio', EF, /cotovelos/i), c('Simétricas e bem delimitadas', EF, /delimitad/i)] },
    ],
    naoPerder: { nome: 'Artrite psoriásica', cid: 'L40.5', porque: 'Psoríase em placas pode vir com artrite.', como: 'Perguntar dor, inchaço e rigidez nas articulações.' },
  },
  'Beatriz Almeida': {
    hipoteses: [
      { id: 'comedoniana', nome: 'Acne comedoniana · grau I', cid: 'L70.0', base: 68, pistas: [a('Comedões abertos e fechados', EF, /comed/i), a('Adolescente', ID, /\b1\d anos/)] },
      { id: 'cosmetica', nome: 'Acne cosmética', cid: 'L70.8', base: 20, pistas: [a('Restrita à testa', EF, /testa|fronte/i)] },
      { id: 'foliculite', nome: 'Foliculite', cid: 'L73.9', base: 7, pistas: [a('Pápulas', EF, /pápula/i), c('Comedões não são da foliculite', EF, /comed/i)] },
    ],
    naoPerder: null,
  },
  'Carlos Henrique Rocha': {
    hipoteses: [
      { id: 'melanoma', nome: 'Melanoma do tronco', cid: 'C43.5', base: 46, pistas: [a('Assimétrica, bordas irregulares, duas cores', EF, /assim/i), a('Mudou de cor e cresceu', QP, /mudou/i), a('Maior que 6 mm', EF, /8 mm/i), c('Outros nevos sem atipia', EF, /sem atipia/i)] },
      { id: 'nevo', nome: 'Nevo atípico do tronco', cid: 'D22.5', base: 34, pistas: [a('Bordas irregulares', EF, /irregular/i), a('Outros nevos no corpo', EF, /nevos/i), c('Mudou de cor e cresceu', QP, /mudou/i)] },
      { id: 'queratose', nome: 'Ceratose seborreica', cid: 'L82', base: 12, pistas: [a('Mais de 60 anos', ID, /\b[6-9]\d anos/), c('Mudança recente de cor e tamanho', QP, /mudou/i)] },
    ],
    naoPerder: { nome: 'Melanoma', cid: 'C43.5', porque: 'Lesão que mudou, assimétrica e maior que 6 mm (ABCDE).', como: 'Dermatoscopia; na dúvida, biópsia excisional.' },
  },
  'Fernanda Oliveira': {
    hipoteses: [
      { id: 'melasma', nome: 'Melasma', cid: 'L81.1', base: 74, pistas: [a('Surgiu depois da gravidez', QP, /gravidez/i), a('Malar e lábio superior, simétrica', EF, /simétric/i)] },
      { id: 'pos-inflamatoria', nome: 'Hiperpigmentação pós-inflamatória', cid: 'L81.0', base: 14, pistas: [a('Máculas acastanhadas', EF, /acastanhad/i), c('Sem inflamação descrita', EF, /sem eritema/i)] },
      { id: 'efelides', nome: 'Efélides', cid: 'L81.2', base: 6, pistas: [a('Máculas na face', EF, /face/i), c('Bordas irregulares e confluentes', EF, /irregular/i)] },
    ],
    naoPerder: null,
  },
  'Rafael Monteiro': {
    hipoteses: [
      { id: 'androgenetica', nome: 'Alopecia androgenética', cid: 'L64.9', base: 80, pistas: [a('Entradas e vértice', EF, /frontotemporais/i), a('Miniaturização dos fios', EF, /miniaturiza/i), a('Lenta, há 2 anos', QP, /2 anos/i)] },
      { id: 'efluvio', nome: 'Eflúvio telógeno', cid: 'L65.0', base: 10, pistas: [a('Queda de cabelo', QP, /queda/i), c('Localizada nas entradas', QP, /entradas/i)] },
      { id: 'areata', nome: 'Alopecia areata', cid: 'L63.9', base: 5, pistas: [a('Queda localizada', QP, /entradas/i), c('Miniaturização, sem placa lisa', EF, /miniaturiza/i)] },
    ],
    naoPerder: null,
  },
  'Luíza Fernandes': {
    hipoteses: [
      { id: 'rosacea', nome: 'Rosácea eritematotelangiectásica', cid: 'L71.9', base: 62, pistas: [a('Piora com sol e calor', QP, /calor/i), a('Eritema com telangiectasias', EF, /telangiect/i), a('Centro da face', EF, /centrofacial/i)] },
      { id: 'seborreica', nome: 'Dermatite seborreica', cid: 'L21.9', base: 15, pistas: [a('Eritema facial', EF, /eritema/i), c('Telangiectasias', EF, /telangiect/i)] },
      { id: 'lupus', nome: 'Lúpus eritematoso sistêmico', cid: 'M32.9', base: 9, pistas: [a('Bochechas, piora com sol', QP, /sol/i), c('Telangiectasias, típicas de rosácea', EF, /telangiect/i)] },
    ],
    naoPerder: { nome: 'Lúpus eritematoso sistêmico', cid: 'M32.9', porque: 'Vermelhidão nas bochechas que piora com sol.', como: 'Perguntar dor nas juntas e aftas; FAN se suspeitar.' },
  },
  'Antônio Barbosa': {
    hipoteses: [
      { id: 'cbc', nome: 'Carcinoma basocelular', cid: 'C44.3', base: 70, pistas: [a('Pápula perolada com telangiectasias', EF, /perolad/i), a('Não cicatriza há 3 meses', QP, /não cicatriza/i), a('Carcinoma basocelular em 2024', EX, /basocelular/i)] },
      { id: 'cec', nome: 'Carcinoma espinocelular', cid: 'C44.3', base: 18, pistas: [a('Ulceração central', EF, /ulcera/i), a('Dano solar crônico', EF, /dano solar/i), c('Borda perolada', EF, /perolad/i)] },
      { id: 'actinica', nome: 'Ceratose actínica', cid: 'L57.0', base: 7, pistas: [a('Dano solar crônico', EF, /dano solar/i), c('Ferida que não cicatriza', QP, /não cicatriza/i)] },
    ],
    naoPerder: { nome: 'Carcinoma espinocelular', cid: 'C44.3', porque: 'Ferida que não cicatriza em pele com dano solar.', como: 'Biópsia antes de qualquer tratamento.' },
  },
  'Camila Sampaio': {
    hipoteses: [
      { id: 'irritativa', nome: 'Dermatite de contato irritativa', cid: 'L24.9', base: 52, pistas: [a('Piora ao lavar louça', QP, /louça/i), a('Pele ressecada com fissuras', EF, /fissura/i)] },
      { id: 'disidrose', nome: 'Disidrose', cid: 'L30.1', base: 30, pistas: [a('Vesículas nas palmas', EF, /vesícula/i), a('Rinite (atopia)', ANT, /rinite/i)] },
      { id: 'alergica', nome: 'Dermatite de contato alérgica', cid: 'L23.9', base: 12, pistas: [a('Coceira', QP, /coceira/i), c('Piora com água e detergente', QP, /louça/i)] },
    ],
    naoPerder: null,
  },
  'Gustavo Nogueira': {
    hipoteses: [
      { id: 'onicomicose', nome: 'Onicomicose', cid: 'B35.1', base: 70, pistas: [a('Unha grossa e amarelada', EF, /amarel/i), a('Descamação entre os dedos', EF, /entre os dedos/i)] },
      { id: 'psoriase-ungueal', nome: 'Psoríase ungueal', cid: 'L40.8', base: 15, pistas: [a('Espessamento da unha', EF, /espessamento/i), c('Uma unha só', EF, /uma unha/i)] },
      { id: 'trauma', nome: 'Onicodistrofia traumática', cid: 'L60.8', base: 8, pistas: [a('Hálux, área de trauma', EF, /hálux/i), c('Descamação entre os dedos', EF, /entre os dedos/i)] },
    ],
    naoPerder: null,
  },
  'Helena Martins': {
    hipoteses: [
      { id: 'alergica', nome: 'Dermatite de contato alérgica', cid: 'L23.9', base: 40, pistas: [a('Coceira', QP, /coçam/i), a('Área exposta, antebraço', EF, /antebraço/i)] },
      { id: 'numular', nome: 'Eczema numular', cid: 'L30.0', base: 28, pistas: [a('Placa eritematosa', EF, /eritematosa/i), c('Sem vesículas', EF, /sem vesícula/i)] },
      { id: 'tinea', nome: 'Tinha do corpo', cid: 'B35.4', base: 18, pistas: [a('Lesão única', EF, /uma área/i)] },
    ],
    naoPerder: null,
  },
  'Pedro Cavalcante': {
    hipoteses: [
      { id: 'verruga', nome: 'Verruga vulgar', cid: 'B07', base: 85, pistas: [a('Superfície rugosa', EF, /rugosa/i), a('Pontos escuros na superfície', EF, /pontos escuros/i)] },
      { id: 'molusco', nome: 'Molusco contagioso', cid: 'B08.1', base: 7, pistas: [a('Várias pápulas', EF, /pápula/i), c('Superfície rugosa (molusco é liso)', EF, /rugosa/i)] },
      { id: 'calo', nome: 'Calosidade', cid: 'L84', base: 4, pistas: [a('Hiperceratose', EF, /hiperceratós/i), c('Pontos escuros', EF, /pontos escuros/i)] },
    ],
    naoPerder: null,
  },
  'Juliana Teixeira': {
    hipoteses: [
      { id: 'seborreica', nome: 'Dermatite seborreica', cid: 'L21.0', base: 66, pistas: [a('Descamação fina', EF, /descamação fina/i), a('Também nos sulcos nasogenianos', EF, /nasogenian/i)] },
      { id: 'psoriase', nome: 'Psoríase do couro cabeludo', cid: 'L40.0', base: 18, pistas: [a('Descamação no couro cabeludo', EF, /couro cabeludo/i), c('Escamas finas, não espessas', EF, /fina/i)] },
      { id: 'tinea', nome: 'Tinha do couro cabeludo', cid: 'B35.0', base: 5, pistas: [a('Descamação no couro cabeludo', EF, /couro cabeludo/i), c('Sem queda de cabelo', EF, /sem queda/i)] },
    ],
    naoPerder: null,
  },
}
