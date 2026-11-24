import { describe, expect, it } from 'vitest'
import { agendaDoDia } from '../modulo/exemplo'
import { conteudoDaConsulta } from './exemplo'
import { atualizarHistoria, identificacaoHda, montarHistoria, montarHistoriaEvolucao, secoesDaConsultaAnterior, secoesDaEvolucaoParaDD } from './historia'
import { FORMULARIO_VAZIO, textoDoFormulario } from './formulario-consulta'
import { partesPreConsulta } from '../medico/pre-consulta'

const agora = new Date(2026, 10, 16, 7, 0)
const antonio = agendaDoDia('2026-11-16', agora).find((x) => x.paciente.nome === 'Antônio Barbosa')!
const c = conteudoDaConsulta(antonio, 'dermatologia')
const exame = c.exame.map((x) => ({ rotulo: x.rotulo, valor: x.valor }))
const texto = 'Médico: Me conta.\nPaciente: Ferida no nariz que não cicatriza há 3 meses.\nMédico: Usa remédio?\nPaciente: AAS 100 mg.\n'

describe('montarHistoria', () => {
  const contexto = { falas: c.falas, sinais: [{ texto: 'Ferida não cicatriza há >4 sem', resposta: 'v' as const }, { texto: 'Outro sinal', resposta: 'f' as const }] }
  const h = montarHistoria(antonio, agora, texto, exame, c.complementares, contexto)

  it('o nome do paciente não aparece na história (fica só no cabeçalho do prontuário)', () => {
    expect(h.map((s) => s.texto).join(' ')).not.toContain(antonio.paciente.nome)
    expect(h[0].texto).toBe('Paciente, 73 anos') // consulta/retorno e presencial/online não ajudam no DD nem no tratamento
  })
  it('tem as seis seções da landing, na ordem', () => {
    expect(h.map((s) => s.rotulo)).toEqual(['Identificação', 'Queixa principal', 'História da doença atual', 'Antecedentes e alertas', 'Exame físico', 'Exames complementares'])
  })
  it('a história atual vem só das falas do paciente, em linguagem médica corrida (como na landing)', () => {
    const hda = h[2].texto
    expect(hda.startsWith('Paciente, 73 anos, refere ferida no nariz que não cicatriza há 3 meses.')).toBe(true)
    expect(hda).not.toContain('Me conta')
  })
  it('a queixa abre a HDA mesmo quando foi dita depois de outras falas', () => {
    const fora = ['Médico: Toma anticoagulante?', 'Paciente: AAS 100 mg.', 'Médico: Me conta.', 'Paciente: Ferida no nariz que não cicatriza há 3 meses.'].join(String.fromCharCode(10))
    expect(montarHistoria(antonio, agora, fora, exame, [], contexto)[2].texto.startsWith('Paciente, 73 anos, refere ferida no nariz')).toBe(true)
  })
  it('pergunta respondida entra contextualizada (HDA ou antecedentes); sem resposta não entra', () => {
    const p = (texto: string, secao: 'hda' | 'ant') => ({ texto, sim: `${texto} sim.`, nao: `${texto} não.`, secao })
    const h2 = montarHistoria(antonio, agora, texto, exame, [], { ...contexto, perguntas: [
      { pergunta: p('Gravidez', 'hda'), resposta: 'nao' as const },
      { pergunta: p('Anticoagulante', 'ant'), resposta: 'sim' as const },
    ] })
    expect(h2[2].texto.endsWith('Gravidez não.')).toBe(true)
    expect(h2[3].texto).toContain('Anticoagulante sim.')
    expect(h[2].texto).not.toContain('Gravidez')
  })
  it('fala do paciente fora do roteiro entra como relato; remédios ficam nos antecedentes', () => {
    expect(h[2].texto).toContain('Relata: AAS 100 mg.')
    const roteiro = c.falas.map((f) => `${f.quem}: ${f.texto}`).join(String.fromCharCode(10))
    const hda = montarHistoria(antonio, agora, roteiro, exame, [], contexto)[2].texto
    expect(hda).toContain('Sangramento ao trauma leve, com formação de crosta.')
    expect(hda).not.toMatch(/AAS|Atenolol|Sulfa/i)
  })
  it('anamnese escrita à mão (sem falas) entra inteira, depois da identificação (se o médico não começou por "Paciente")', () => {
    expect(montarHistoria(antonio, agora, 'Lesão no nariz há 3 meses.', exame, [])[2].texto).toBe('Paciente, 73 anos. Lesão no nariz há 3 meses.')
    expect(montarHistoria(antonio, agora, 'Paciente refere lesão no nariz.', exame, [])[2].texto).toBe('Paciente refere lesão no nariz.')
  })
  it('o exame físico usa os valores salvos (inclusive editados) e pula campos vazios', () => {
    const editado = exame.map((x) => (x.rotulo === 'Localização' ? { ...x, valor: 'Asa nasal direita' } : x.rotulo === 'Extensão' ? { ...x, valor: '' } : x))
    const ef = montarHistoria(antonio, agora, texto, editado, [])[4].texto
    expect(ef).toContain('em asa nasal direita')
    expect(ef).not.toContain('cerca de 6 mm')
  })
  it('exames complementares: ausente vira "não encontrado no laudo", inferido pede conferência; sem exames diz isso', () => {
    expect(h[5].texto).toContain('Margens: não encontrado no laudo')
    expect(montarHistoria(antonio, agora, texto, exame, [])[5].texto).toBe('Nenhum exame trazido.')
  })
  it('alergia da ficha e sinal de alerta marcado V entram em antecedentes e alertas; F não entra', () => {
    expect(h[3].texto).toContain('Alergia a sulfa (falta de ar).')
    expect(h[3].texto).toContain('Alerta: ferida não cicatriza há >4 sem.')
    expect(h[3].texto).not.toContain('outro sinal')
  })
  it('exames complementares: laudo (biópsia) numa linha só; laboratório, um resultado por linha', () => {
    expect(h[5].texto).toBe('Biópsia anterior (2024): Diagnóstico: Carcinoma basocelular nodular; Local: Região malar esquerda; Margens: não encontrado no laudo.')
  })
  it('sigla no remédio não vira minúscula (AAS)', () => {
    expect(h[3].texto).toContain('Em uso de AAS 100 mg')
  })
})

describe('atualizarHistoria', () => {
  const geradas = [{ rotulo: 'A', texto: 'a1' }, { rotulo: 'B', texto: 'b1' }, { rotulo: 'C', texto: 'c1' }]
  const atuais = ['a1', 'b1 editado pelo médico', 'c1']
  it('só reescreve as seções cuja origem mudou; mantém as edições do médico nas demais', () => {
    const novas = [{ rotulo: 'A', texto: 'a2' }, { rotulo: 'B', texto: 'b1' }, { rotulo: 'C', texto: 'c1' }]
    const r = atualizarHistoria(geradas, atuais, novas)
    expect(r.textos).toEqual(['a2', 'b1 editado pelo médico', 'c1'])
    expect(r.mudou).toEqual([true, false, false])
  })
  it('nada mudou: nada é reescrito', () => {
    expect(atualizarHistoria(geradas, atuais, geradas).mudou).toEqual([false, false, false])
  })
  it('seção editada pelo médico cuja origem mudou: o texto dele fica, a IA sugere ao lado', () => {
    const novas = [{ rotulo: 'A', texto: 'a1' }, { rotulo: 'B', texto: 'b2' }, { rotulo: 'C', texto: 'c1' }]
    const r = atualizarHistoria(geradas, atuais, novas)
    expect(r.textos[1]).toBe('b1 editado pelo médico')
    expect(r.mudou[1]).toBe(false)
    expect(r.sugestoes).toEqual([null, 'b2', null])
  })
})

describe('identificação na HDA (dados da ficha)', () => {
  it('idade + estado civil + profissão; o que não foi respondido não entra', () => {
    expect(identificacaoHda(52, { sexo: 'M', estadoCivil: 'casado', profissao: 'Comerciante' })).toBe('Paciente, 52 anos, casado, comerciante')
    expect(identificacaoHda(54, { sexo: 'M', estadoCivil: 'divorciado', profissao: 'Desempregado' })).toBe('Paciente, 54 anos, divorciado, desempregado')
    expect(identificacaoHda(34, { sexo: 'F', estadoCivil: 'viuvo', profissao: '' })).toBe('Paciente, 34 anos, viúva')
    expect(identificacaoHda(30, { sexo: 'I', estadoCivil: 'uniao-estavel', profissao: 'Professor' })).toBe('Paciente, 30 anos, em união estável, professor')
    expect(identificacaoHda(30, { sexo: 'I', estadoCivil: 'solteiro', profissao: '' })).toBe('Paciente, 30 anos, solteiro(a)')
    expect(identificacaoHda(73, { sexo: 'M', estadoCivil: '', profissao: '' })).toBe('Paciente, 73 anos')
    expect(identificacaoHda(40, null)).toBe('Paciente, 40 anos')
  })
  it('o João (ficha: casado, comerciante) abre a HDA assim', () => {
    const joao = agendaDoDia('2026-11-13', agora).find((x) => x.paciente.nome === 'João Pedro Lima')!
    const cj = conteudoDaConsulta({ ...joao, tipo: 'consulta' }, 'dermatologia')
    const fala = 'Paciente: Placas vermelhas com descamação nos cotovelos e joelhos.'
    expect(montarHistoria(joao, agora, fala, [], [], { falas: cj.falas, sinais: [] })[2].texto).toMatch(/^Paciente, 52 anos, casado, comerciante, refere /)
  })
})

describe('história com o formulário salvo na anamnese (exemplo aprovado pelo autor, 19/11/2026)', () => {
  // pedido real vira atendimento sem roteiro de exemplo
  const at = { ...agendaDoDia('2026-11-17', new Date(2026, 10, 17, 7))[0], paciente: { id: 'p', nome: 'Marcya Braga', nascimento: '1979-10-19' } }
  const partes = partesPreConsulta('dermatologia')
  const form = {
    dados: { ...FORMULARIO_VAZIO.dados, nomeCompleto: 'Marcya Braga', nascimento: '1979-10-19', sexo: 'F' as const, estadoCivil: 'casado' as const, profissao: 'Educadora física', trabalhoExposto: 'sim' as const },
    respostas: {
      alergias: 'Dipirona', queixa: 'Manchas no rosto', local: 'Rosto', desde_quando: '2 anos', mudou: 'Não', sintomas: ['Nenhum dos três'],
      cor_pele: 'Morena clara', reacao_sol: 'Raramente queimar e bronzear fácil', protetor: 'Às vezes', bronzeamento: 'Não', familia: ['Dermatite atópica'],
    },
    fotos: {},
  }
  const caixa = textoDoFormulario(partes, form, new Date(2026, 10, 19))
  const agora = new Date(2026, 10, 19)

  it('HDA e antecedentes em linguagem de prontuário; o texto do formulário não é colado', () => {
    const h = montarHistoria(at, agora, caixa, [], [], { falas: [], sinais: [], formulario: { ...form, partes } })
    expect(h[1].texto).toBe('Manchas no rosto')
    expect(h[2].texto).toBe('Paciente, 47 anos, casada, educadora física, refere manchas no rosto há 2 anos, sem mudança de cor, tamanho ou formato, '
      + 'sem prurido, dor ou sangramento. Trabalha exposta ao sol; usa protetor solar às vezes; nega bronzeamento artificial.')
    expect(h[3].texto).toBe('Alergia a dipirona. Pele morena clara, raramente queima e bronzeia fácil. História familiar de dermatite atópica.')
    expect(h[3].texto).not.toMatch(/Nega comorbidades|uso contínuo/)
  })

  it('o que foi escrito depois do formulário continua na HDA', () => {
    const h = montarHistoria(at, agora, `${caixa}\n\nPiora no verão.`, [], [], { falas: [], sinais: [], formulario: { ...form, partes } })
    expect(h[2].texto.endsWith('nega bronzeamento artificial. Piora no verão.')).toBe(true)
  })
})

describe('História da evolução (retorno)', () => {
  const joao = agendaDoDia('2026-11-18', agora).find((x) => x.tipo === 'retorno')!
  const cj = conteudoDaConsulta(joao, 'dermatologia')
  const gravado = 'Médico: Como o senhor está desde a última consulta?\nPaciente: Melhorou bastante, as placas dos cotovelos quase sumiram. Passo a pomada toda noite.\n'
  const sim = (texto: string) => cj.perguntas.find((p) => p.texto === texto)!
  const evolucao = (anamnese: string, perguntas: { pergunta: (typeof cj.perguntas)[number]; resposta: 'sim' | 'nao' }[] = [], exame: { rotulo: string; valor: string }[] = []) =>
    montarHistoriaEvolucao(anamnese, exame, [], { falas: cj.falas, sinais: [], perguntas })

  it('três blocos: Evolução, Exame e Exames', () => {
    expect(evolucao(gravado).map((s) => s.rotulo)).toEqual(['Evolução', 'Exame', 'Exames'])
  })
  it('abre com "Paciente relata ...", sem idade, estado civil nem profissão (já estão no prontuário)', () => {
    const [e] = evolucao(gravado)
    expect(e.texto).toBe('Paciente relata melhora importante das placas, com uso regular da pomada à noite.')
    expect(e.texto).not.toMatch(/anos|casado|comerciante/)
  })
  it('anamnese escrita à mão também abre com "Paciente relata"; se o médico já escreveu, não repete', () => {
    expect(evolucao('melhora das placas, pouca coceira')[0].texto).toBe('Paciente relata melhora das placas, pouca coceira.')
    expect(evolucao('Paciente informa piora.')[0].texto).toBe('Paciente informa piora.')
  })
  it('respostas Sim/Não entram, mas sem repetir "melhora" que o relato já disse', () => {
    const perguntas = [{ pergunta: sim('Melhorou?'), resposta: 'sim' as const }, { pergunta: sim('Usa o remédio direitinho?'), resposta: 'sim' as const }, { pergunta: sim('Teve efeito colateral?'), resposta: 'nao' as const }]
    expect(evolucao(gravado, perguntas)[0].texto).toBe(
      'Paciente relata melhora importante das placas, com uso regular da pomada à noite. Refere uso regular da medicação prescrita. Nega efeitos colaterais.',
    )
  })
  it('Exame compara com a consulta anterior; sem nada colhido, "Não registrado."', () => {
    expect(evolucao(gravado)[1].texto).toBe('Não registrado.')
    const exame = [{ rotulo: 'Aspecto atual das lesões', valor: 'Placas residuais, sem descamação' }, { rotulo: 'Comparado à consulta anterior', valor: 'Redução importante' }, { rotulo: 'Observações', valor: '' }]
    expect(evolucao(gravado, [], exame)[1].texto).toBe('Placas residuais, sem descamação. Em relação à consulta anterior: redução importante.')
    expect(evolucao(gravado)[2].texto).toBe('Nenhum exame novo.')
  })
})

describe('História da evolução: aprofundamento', () => {
  const joao = agendaDoDia('2026-11-18', agora).find((x) => x.tipo === 'retorno')!
  const cj = conteudoDaConsulta(joao, 'dermatologia')
  const efeito = cj.perguntas.find((p) => p.texto === 'Teve efeito colateral?')!
  const [qual, quando, parou, continua] = efeito.aprofundar!
  it('as respostas de aprofundamento entram em seguida; resposta aberta vazia não entra', () => {
    const perguntas = [
      { pergunta: efeito, resposta: 'sim' as const },
      { pergunta: qual, resposta: 'sim' as const, texto: 'ardência na pele' },
      { pergunta: quando, resposta: 'sim' as const, texto: '  ' },
      { pergunta: parou, resposta: 'nao' as const },
      { pergunta: continua, resposta: 'sim' as const },
    ]
    expect(montarHistoriaEvolucao('melhora das placas', [], [], { falas: cj.falas, sinais: [], perguntas })[0].texto).toBe(
      'Paciente relata melhora das placas. Refere efeito colateral com a medicação. Efeito: ardência na pele. Manteve o uso do medicamento. Efeito ainda presente.',
    )
  })
  it('resposta aberta escrita com maiúscula entra no meio da frase: "Início: primeiros dias."; sigla fica', () => {
    const perguntas = [
      { pergunta: efeito, resposta: 'sim' as const },
      { pergunta: qual, resposta: 'sim' as const, texto: 'Sonolência leve com a loratadina.' },
      { pergunta: quando, resposta: 'sim' as const, texto: 'Primeiros dias' },
    ]
    expect(montarHistoriaEvolucao('melhora', [], [], { falas: cj.falas, sinais: [], perguntas })[0].texto).toBe(
      'Paciente relata melhora. Refere efeito colateral com a medicação. Efeito: sonolência leve com a loratadina. Início: primeiros dias.',
    )
    const sigla = [{ pergunta: efeito, resposta: 'sim' as const }, { pergunta: qual, resposta: 'sim' as const, texto: 'AINE causou gastrite' }]
    expect(montarHistoriaEvolucao('melhora', [], [], { falas: cj.falas, sinais: [], perguntas: sigla })[0].texto).toContain('Efeito: AINE causou gastrite.')
  })
})

describe('História da evolução: extensão das lesões', () => {
  const anteriores = [{ data: '2026-09-18', exameFisico: 'Placas eritematodescamativas. BSA estimada em 4%.' }]
  const ext = (valor: string, ant = anteriores) =>
    montarHistoriaEvolucao('melhora', [{ rotulo: 'Extensão', valor }], [], { falas: [], sinais: [], anteriores: ant })[1].texto
  it('compara com a consulta anterior, em pontos percentuais', () => {
    expect(ext('1')).toBe('Extensão das lesões: 1% (consulta anterior, 18/09: 4%), redução de 3 pontos percentuais.')
    expect(ext('6,5%')).toBe('Extensão das lesões: 6,5% (consulta anterior, 18/09: 4%), aumento de 2,5 pontos percentuais.')
    expect(ext('4%')).toBe('Extensão das lesões: 4% (consulta anterior, 18/09: 4%), sem alteração.')
  })
  it('sem medida anterior, só o valor; texto que não é número entra como está', () => {
    expect(ext('1', [])).toBe('Extensão das lesões: 1%.')
    expect(ext('quase nada')).toBe('Extensão das lesões: quase nada.')
  })
})

describe('secoesDaConsultaAnterior (o retorno lê o prontuário)', () => {
  it('devolve as seções com os rótulos da história clínica, só as que têm texto', () => {
    const dados = { qp: 'Placas.', hda: 'Há 2 anos.', ap: 'Hipertensão.', hp: '', hf: '', exameFisico: 'BSA 4%.', examesTexto: '' }
    expect(secoesDaConsultaAnterior(dados)).toEqual([
      { rotulo: 'Queixa principal', texto: 'Placas.' },
      { rotulo: 'História da doença atual', texto: 'Há 2 anos.' },
      { rotulo: 'Antecedentes e alertas', texto: 'Hipertensão.' },
      { rotulo: 'Exame físico', texto: 'BSA 4%.' },
    ])
  })
})

describe('secoesDaEvolucaoParaDD (diagnósticos do retorno partem só da evolução de hoje)', () => {
  it('a evolução entra com os rótulos da história clínica, como numa primeira consulta', () => {
    expect(secoesDaEvolucaoParaDD([
      { rotulo: 'Evolução', texto: 'Paciente relata melhora.' },
      { rotulo: 'Exame', texto: 'Placas residuais.' },
      { rotulo: 'Exames', texto: 'Nenhum exame novo.' },
    ])).toEqual([
      { rotulo: 'História da doença atual', texto: 'Paciente relata melhora.' },
      { rotulo: 'Exame físico', texto: 'Placas residuais.' },
      { rotulo: 'Exames complementares', texto: 'Nenhum exame novo.' },
    ])
  })
})

describe('História da evolução: extensão anterior gravada como número', () => {
  it('usa o número do prontuário, não o texto do exame físico', () => {
    const anteriores = [{ data: '2026-09-18', exameFisico: 'Placas bem delimitadas (sem número no texto).', extensaoPct: 4 }]
    expect(montarHistoriaEvolucao('melhora', [{ rotulo: 'Extensão', valor: '1' }], [], { falas: [], sinais: [], anteriores })[1].texto)
      .toBe('Extensão das lesões: 1% (consulta anterior, 18/09: 4%), redução de 3 pontos percentuais.')
  })
})
