// Consulta (Módulo A): estrutura comum das 4 páginas — topo com o paciente, navegador das etapas,
// Anexos — e a página da etapa atual. Só visual, dados de exemplo; o estado vive na memória da página.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { estiloAlergia } from '../alergia'
import { buscarEspecialidade, type Especialidade } from '../especialidades'
import { Marca, NomeModulo } from '../marca'
import { NaoEncontrada } from '../nao-encontrada'
import { idade } from '../modulo/dia'
import type { Atendimento } from '../modulo/tipos'
import { Anamnese } from './anamnese'
import { ETAPAS, estadoDoServidor, soAlergias, editar, ehEtapa, inicial, oficializar, pendenciasAnamnese, podeOficializar, podeGravar, responderAlerta, situacaoDaEtapa } from './etapas'
import { Exame } from './exame'
import { atualizarHistoria, montarHistoria, montarHistoriaEvolucao, secoesDaConsultaAnterior, secoesDaEvolucaoParaDD, type SecaoHistoria } from './historia'
import { PaginaHistoria } from './historia-pagina'
import { tabelaDeExames } from './exames-tabela'
import { atualizarComReserva, chamarMais, iniciarDiagnosticos, montarDiagnosticos, pendenciasDiagnosticos, type Hipotese, type ItemDD } from './diagnosticos'
import { atualizarResumo, secaoDeAlergias, marcarResumo, montarResumo, type ItemResumo } from './resumo'
import { PaginaDiagnosticos } from './diagnosticos-pagina'
import { atualizarConduta, editarTexto, escolherOpcao, escreverOutro, montarConduta, pendenciasConduta, revelar, type Conduta } from './conduta'
import { PaginaConduta } from './conduta-pagina'
import { alternarEmitir, atualizarAnexos, avancar, definirCampos, editarAnexo, montarAnexos, pendenciasAnexos, type Anexo, type DadosConsulta } from './anexos'
import { PaginaAnexos } from './anexos-pagina'
import { RASCUNHO_INICIAL, erroDeHorario, podeSalvarAnexos, retornoParaEnvio, type RascunhoRetorno } from './retorno'
import { EscolhaRetorno } from './retorno-pagina'
import { dataLocal, gerarAgenda, marcarOcupados, MEDICO_EXEMPLO } from '../medico/exemplo'
import { aplicarEdicoes, atualizarProntuario, cabecalhoProntuario, chave, dadosDaConsulta, edicoesDoMedico, secoesDosDados, type SecaoProntuario } from './prontuario'
import { PaginaProntuario } from './prontuario-pagina'
import { abrirJanelaProntuario, entradas, salvarEntrada, tituloDaConsulta, tituloNovaEntrada, type DadosEntrada, type EntradaProntuario } from '../prontuario/registro'
import { buscarAtendimento, conteudoDaConsulta, type RespostaPergunta } from './exemplo'
import { FORMULARIO_VAZIO, type FormularioConsulta } from './formulario-consulta'
import { partesPreConsulta } from '../medico/pre-consulta'
import { atendimentoDoPedido, atendimentoDoRetorno, precisaIdentificacao } from '../modulo/pedidos'
import { IdentificacaoNaChegada } from './identificacao-chegada'
import { buscarPedido, buscarRetorno, enderecoFoto, ErroServidor, pedidosDaAgenda, retornosDaAgenda, type HorarioOcupado, type PedidoNaAgenda, type RetornoNaAgenda } from '../servidor/agenda'
import { abrirConsultaDoPedido, abrirConsultaDoRetorno, buscarConsulta, gerarHistoria, gerarPerguntas, oficializarEtapa, salvarAnamnese, salvarExame, salvarHistoria as enviarHistoria, gerarDiagnosticos, salvarDiagnosticos as enviarDiagnosticos, gerarConduta, salvarConduta as enviarConduta, listarDocumentos, salvarDocumento, finalizarConsulta, pacienteDoServidor, prontuarioDoPaciente, prontuarioProposto, sinaisDaEspecialidade, type AnamneseServidor, type CondutaServidor, type ConsultaServidor, type DocumentoServidor, type ExameServidor, type DiagnosticosServidor, type HistoriaServidor, type PerguntaServidor, type SinalDoCatalogo } from '../servidor/consulta'
import { adicionarPergunta, atualizarSecoes, avisosDeUrgencia, historiaDaEvolucaoParaServidor, historiaParaServidor, juntarPerguntas, responder, secoesDaEvolucaoDoServidor, secoesDoServidor } from './historia-servidor'
import { BuscaCid } from './busca-cid'
import { PerguntasHistoria } from './perguntas-historia'
import { diagnosticosParaServidor, hipotesesDoServidor, idDaHipotese, itensDoServidor } from './diagnosticos-servidor'
import { aplicarDocumentos, documentoParaServidor, virouEnviado } from './anexos-servidor'
import { bloqueadasDaConduta, condutaDoServidor, condutaParaServidor, urgenciaDaConduta } from './conduta-servidor'
import { anamneseDoServidor, anamneseParaServidor, diaDaConsulta, etapasParaOficializar, exameDoServidor, exameParaServidor } from './servidor-mapa'
import type { Bloco, EstadoConsulta, EtapaId, RespostaAlerta } from './tipos'
import { Cartao, EtiquetaSituacao, Gaveta, ROTULO } from './ui'

export function PaginaConsulta() {
  const { slug = '', atendimento = '', etapa } = useParams()
  const esp = buscarEspecialidade(slug)
  // pedido feito na página do médico: vem do servidor ("pedido-<id>")
  const idPedido = atendimento.startsWith('pedido-') ? atendimento.slice('pedido-'.length) : null
  const [pedido, setPedido] = useState<PedidoNaAgenda | null | 'erro'>(null)
  useEffect(() => {
    if (idPedido) buscarPedido(idPedido).then(setPedido, () => setPedido('erro'))
  }, [idPedido])
  const doServidor = pedido && pedido !== 'erro' ? pedido : null
  // o dia da consulta é o do endereço; o "agora" só decide quem já foi atendido
  // cartão "Retorno" da agenda ("retorno-<id>"): o servidor cria o retorno uma vez; a Evolução e o resto seguem simulados (parte 2)
  const idRetorno = atendimento.startsWith('retorno-') ? atendimento.slice('retorno-'.length) : null
  const [cartao, setCartao] = useState<RetornoNaAgenda | null | 'erro'>(null)
  const [retornoAberto, setRetornoAberto] = useState<ConsultaServidor | 'erro' | null>(null)
  const [anteriores, setAnteriores] = useState<EntradaProntuario[] | 'erro' | null>(null)
  /** retorno: o aceite de gravação é o que o paciente deu na consulta de origem (consulta de origem → pedido) */
  const [origem, setOrigem] = useState<{ gravacaoAutorizada: boolean; alergias: { substancia: string; reacao: string }[]; nascimento: string } | null>(null)
  useEffect(() => {
    if (!idRetorno) return
    buscarRetorno(idRetorno).then((c) => {
      setCartao(c)
      abrirConsultaDoRetorno(idRetorno, slug).then(setRetornoAberto, () => setRetornoAberto('erro'))
      prontuarioDoPaciente(c.pacienteId).then(setAnteriores, () => setAnteriores('erro'))
      // a idade do cabeçalho e dos documentos vem do cadastro do paciente (o cartão da agenda não traz o nascimento)
      const nascimento = pacienteDoServidor(c.pacienteId).then((p) => p.nascimento, () => '')
      buscarConsulta(c.consultaOrigemId).then(async (o) => {
        const ped = o.pedidoId ? await buscarPedido(o.pedidoId) : null
        const anamnese = o.blocos.find((x) => x.etapa === 'anamnese')?.conteudo as AnamneseServidor | undefined
        setOrigem({ gravacaoAutorizada: ped?.transcricao === 'aceita', alergias: anamnese?.alergias ?? [], nascimento: await nascimento })
      }, async () => setOrigem({ gravacaoAutorizada: false, alergias: [], nascimento: await nascimento }))
    }, () => setCartao('erro'))
  }, [idRetorno, slug])
  const doRetorno = cartao && cartao !== 'erro' ? cartao : null
  const at = useMemo(
    () => (idRetorno ? (doRetorno ? atendimentoDoRetorno(doRetorno, new Date(), origem ?? undefined) : undefined)
      : idPedido ? (doServidor ? atendimentoDoPedido(doServidor, new Date()) : undefined) : buscarAtendimento(atendimento, new Date())),
    [atendimento, idPedido, idRetorno, doServidor, doRetorno, origem],
  )
  // pedido real de uma primeira consulta: a consulta nasce e vive no servidor (os atendimentos de exemplo seguem simulados)
  const usaServidor = !!esp && !!doServidor && !precisaIdentificacao(doServidor) && at?.tipo === 'consulta'
  const [aberta, setAberta] = useState<ConsultaServidor | 'erro' | null>(null)
  useEffect(() => {
    if (usaServidor && idPedido) abrirConsultaDoPedido(idPedido, slug).then(setAberta, () => setAberta('erro'))
  }, [usaServidor, idPedido, slug])
  if (idPedido && pedido === null) return <p className="py-16 text-center text-apagado">Abrindo a consulta…</p>
  if (idRetorno) {
    if (cartao === 'erro' || retornoAberto === 'erro' || anteriores === 'erro') return <p className="py-16 text-center text-apagado">Não foi possível abrir o retorno no consultório. Confira a internet e recarregue a página.</p>
    if (!cartao || !retornoAberto || !anteriores || origem === null) return <p className="py-16 text-center text-apagado">Abrindo o retorno…</p>
    if (retornoAberto.finalizadaEm) return <p className="py-16 text-center text-apagado">Este retorno já foi finalizado. O prontuário está salvo.</p>
  }
  if (!esp || esp.status !== 'disponivel' || !at || !ehEtapa(etapa)) return <NaoEncontrada />
  // sem a Identificação a consulta não começa (o médico pode preenchê-la aqui, na chegada)
  if (doServidor && precisaIdentificacao(doServidor)) return <IdentificacaoNaChegada esp={esp} pedido={doServidor} onPronto={setPedido} />
  if (usaServidor && aberta === null) return <p className="py-16 text-center text-apagado">Abrindo a consulta…</p>
  if (aberta && aberta !== 'erro' && aberta.finalizadaEm) return <p className="py-16 text-center text-apagado">Esta consulta já foi finalizada. O prontuário está salvo.</p>
  if (aberta === 'erro') return <p className="py-16 text-center text-apagado">Não foi possível abrir a consulta no consultório. Confira a internet e recarregue a página.</p>
  return <Consulta key={at.id} esp={esp} at={at} etapa={etapa} formulario={doServidor ? formularioDoPedido(doServidor) : null} servidor={usaServidor ? aberta : (retornoAberto && retornoAberto !== 'erro' ? retornoAberto : null)} anteriores={anteriores && anteriores !== 'erro' ? anteriores : undefined} dia={doRetorno?.data} />
}

/** O formulário que o paciente enviou, para o modo Formulário da anamnese. */
function formularioDoPedido(p: PedidoNaAgenda): FormularioConsulta | null {
  const f = p.formulario
  if (!f) return null
  const d = f.dados
  return {
    dados: { ...FORMULARIO_VAZIO.dados, nomeCompleto: d.nomeCompleto, nomeSocial: d.nomeSocial ?? '', nascimento: d.nascimento, sexo: d.sexo, cidade: d.cidade, uf: d.uf, estadoCivil: d.estadoCivil, profissao: d.profissao, trabalhoExposto: d.trabalhoExposto },
    respostas: f.respostas,
    fotos: Object.fromEntries(f.fotos.map((q) => [q, enderecoFoto(p.id, q)])),
  }
}

type Acao = { tipo: 'oficializar' | 'editar'; bloco: Bloco } | { tipo: 'alerta'; id: string; r: RespostaAlerta }

function reduzir(e: EstadoConsulta, a: Acao): EstadoConsulta {
  if (a.tipo === 'alerta') return responderAlerta(e, a.id, a.r)
  return a.tipo === 'oficializar' ? oficializar(e, a.bloco) : editar(e, a.bloco)
}

/** História em branco (a IA falhou): o médico escreve; a segurança parte do que a ficha já sabe. */
function historiaVazia(base: HistoriaServidor | null, ficha: Atendimento['ficha']): HistoriaServidor {
  if (base) return base
  const f = ficha.situacao === 'pronta' ? ficha : null
  return {
    historia: { qp: '', hda: '', ap: '', hp: '', hf: '', exameFisico: '', examesTexto: '' },
    seguranca: { alergias: f?.alergias ?? [], emUso: f?.emUso ?? [], sinais: [] },
    conflitos: [], extrasIa: [], perguntas: [],
  }
}

/** Sem proposta do servidor (falha): as 4 seções abrem em branco para o médico escrever. */
function semProposta(nome: string, cid: string): CondutaServidor {
  return {
    proposta: { urgencia: 'rotina', emergencia: [], tabela: null, ia: null, origem: '', avisos: [], acao: 'REJECT', iaFalhou: true },
    diagnostico: { nome, cid, certeza: 'clinico' }, escolha: {}, textos: ['', '', '', ''], receita: [], livres: [],
  }
}

function Consulta({ esp, at, etapa, formulario, servidor, anteriores, dia: diaDoRetorno }: { esp: Especialidade; at: Atendimento; etapa: EtapaId; formulario: FormularioConsulta | null; servidor: ConsultaServidor | null; /** retorno do servidor: as entradas do prontuário (no lugar das de exemplo locais) */ anteriores?: EntradaProntuario[]; /** retorno do servidor: o dia do cartão */ dia?: string }) {
  const base0 = useMemo(() => conteudoDaConsulta(at, esp.slug), [at, esp.slug])
  /** retorno: a história são as 3 seções da evolução; consulta: as 5 a 7 da história clínica */
  const secoesDaHistoria = (h: HistoriaServidor['historia']) => (at.tipo === 'retorno' ? secoesDaEvolucaoDoServidor(h) : secoesDoServidor(h))
  /** o dia da consulta: nos pedidos reais vem do servidor (o id do atendimento não é uma data) */
  const dia = servidor ? diaDaConsulta(servidor.agendadaPara) : (diaDoRetorno ?? at.id.slice(0, 10))
  const entradasDoPaciente = () => anteriores ?? entradas(at.paciente.id)
  // consulta retomada: o que já estava salvo no servidor volta para os campos (como rascunho: salvar de novo envia e oficializa)
  const retomada = useMemo(() => {
    const bloco = (etapa: 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta') => servidor?.blocos.find((b) => b.etapa === etapa)?.conteudo
    const a = bloco('anamnese') as AnamneseServidor | undefined
    const x = bloco('exame') as ExameServidor | undefined
    const exame = x ? Object.fromEntries(exameDoServidor(x, at.tipo === 'retorno').map((c) => [c.rotulo, c.valor])) : null
    const h = bloco('historia') as HistoriaServidor | undefined
    const d = bloco('diagnosticos') as DiagnosticosServidor | undefined
    const k = bloco('conduta') as CondutaServidor | undefined
    return { anamnese: a ? anamneseDoServidor(a, base0.perguntas) : null, exame, historia: h ?? null, diagnosticos: d ?? null, conduta: k ?? null }
  }, [servidor, base0, at.tipo])
  const conteudo = useMemo(
    () => (retomada.exame ? { ...base0, exame: base0.exame.map((c) => (retomada.exame![c.rotulo] ? { ...c, valor: retomada.exame![c.rotulo], prov: 'confirmado' as const } : c)) } : base0),
    [base0, retomada],
  )
  /** retorno: a consulta anterior do prontuário (suas fotos aparecem ao lado das de hoje) */
  /** no retorno a primeira página é a Evolução (regra 14.1) */
  const nomeDaEtapa = (id: string, nome: string) => (at.tipo === 'retorno' ? ({ 'anamnese-exame': 'Evolução', historia: 'História da evolução' } as Record<string, string>)[id] ?? nome : nome)
  const consultaAnterior = at.tipo === 'retorno' ? entradasDoPaciente().find((e) => e.tipo === 'consulta') : undefined
  const [estado, despachar] = useReducer(reduzir, soAlergias(conteudo.alertas).map((a) => a.id), (ids: string[]) => (servidor ? estadoDoServidor(inicial(ids), servidor.blocos) : inicial(ids)))
  const [anexos, setAnexos] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const navegar = useNavigate()
  const base = `/modulo/${esp.slug}/consulta/${at.id}`
  const atual = ETAPAS.find((x) => x.id === etapa)!

  useEffect(() => { document.title = `${esp.raiz}IA · ${atual.rotulo} · ${at.paciente.nome}` }, [esp, atual, at])
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])
  const fecharAnexos = useCallback(() => setAnexos(false), [])

  // janela do prontuário: abre e fecha a qualquer momento, separada da consulta
  const janela = useRef<Window | null>(null)
  const [janelaAberta, setJanelaAberta] = useState(false)
  useEffect(() => {
    if (!janelaAberta) return
    const t = setInterval(() => { if (!janela.current || janela.current.closed) setJanelaAberta(false) }, 800)
    return () => clearInterval(t)
  }, [janelaAberta])
  const alternarJanela = () => {
    if (janela.current && !janela.current.closed) { janela.current.close(); setJanelaAberta(false); return }
    // consulta real: o prontuário do paciente do servidor (o id do pedido não é o do paciente)
    janela.current = abrirJanelaProntuario(esp.slug, servidor?.pacienteId ?? at.paciente.id)
    setJanelaAberta(!!janela.current)
  }

  const f = at.ficha
  const alergias = f.situacao === 'pronta' ? f.alergias : (at.alergiasDoProntuario ?? [])
  const fazer = (tipo: 'oficializar' | 'editar', bloco: Bloco) => despachar({ tipo, bloco })

  // o que foi salvo na página 1: a história é montada só com isso
  // consulta retomada: começa com o que o servidor já guardou (senão, salvar só uma metade monta a história com a outra vazia)
  const fontes = useRef<{ anamnese: string; perguntas: RespostaPergunta[]; exame: { rotulo: string; valor: string }[]; formulario: FormularioConsulta | null }>({
    anamnese: retomada.anamnese?.texto ?? '',
    perguntas: retomada.anamnese?.perguntas ?? [],
    exame: retomada.exame ? [...conteudo.exame.map((c) => ({ rotulo: c.rotulo, valor: c.valor })), { rotulo: 'Observações', valor: retomada.exame['Observações'] ?? '' }] : [],
    formulario: null,
  })
  /** geradas = última versão da IA; textos = o que está na tela (com as edições do médico); mudou = seções que a IA reescreveu agora */
  const [historia, setHistoria] = useState<{ versao: number; geradas: SecaoHistoria[]; textos: string[]; mudou: boolean[]; sugestoes: (string | null)[] } | null>(() => {
    // consulta retomada: a história guardada no servidor volta como rascunho (salvar a anamnese e o exame de novo a atualiza)
    const secoes = retomada.historia ? secoesDaHistoria(retomada.historia.historia) : null
    return secoes && { versao: 1, geradas: secoes, textos: secoes.map((x) => x.texto), mudou: secoes.map(() => false), sugestoes: secoes.map(() => null) }
  })
  /** consulta real: o último bloco da história que o servidor devolveu (segurança e extras seguem como estavam) */
  const [histBase, setHistBase] = useState<HistoriaServidor | null>(at.tipo === 'retorno' ? null : retomada.historia) // retorno: sem perguntas de segurança na história da evolução
  const [perguntas, setPerguntas] = useState<PerguntaServidor[]>(at.tipo === 'retorno' ? [] : (retomada.historia?.perguntas ?? []))
  const [perguntasEstado, setPerguntasEstado] = useState({ carregando: false, falhou: false })
  const [catalogo, setCatalogo] = useState<SinalDoCatalogo[]>([])
  /** a IA do servidor está montando a história (alguns segundos) */
  const [montando, setMontando] = useState(false)
  /** consulta real: o último bloco dos diagnósticos que o servidor devolveu (dele vêm a certeza, o "não pode perder" e o "rastrear") */
  const [ddBase, setDdBase] = useState<DiagnosticosServidor | null>(retomada.diagnosticos)
  const [montandoDD, setMontandoDD] = useState(false)
  /** consulta real: o último bloco da conduta que o servidor devolveu (proposta, diagnóstico e urgência) */
  const [condBase, setCondBase] = useState<CondutaServidor | null>(retomada.conduta)
  const [montandoConduta, setMontandoConduta] = useState(false)
  /** consulta real: os anexos que o servidor guardou como enviados (voltam como enviados ao recarregar) */
  const [docsServidor, setDocsServidor] = useState<DocumentoServidor[] | null>(null)
  useEffect(() => {
    if (servidor) listarDocumentos(servidor.id).then(setDocsServidor, () => setDocsServidor([]))
  }, [servidor])
  useEffect(() => {
    if (servidor) sinaisDaEspecialidade(esp.slug).then(setCatalogo, () => setCatalogo([]))
  }, [servidor, esp.slug])

  /** Envia a página 1 ao servidor (gravar e oficializar, na ordem que ele exige). Falha: nada fica marcado como salvo. */
  const enviarPagina1 = async (id: string, bloco: 'anamnese' | 'exame') => {
    const f = fontes.current
    if (bloco === 'anamnese') {
      await salvarAnamnese(id, anamneseParaServidor({ texto: f.anamnese, falas: conteudo.falas, ficha: at.ficha, alertas: {}, sinais: [], perguntas: f.perguntas, formulario: f.formulario }))
    } else {
      await salvarExame(id, exameParaServidor(f.exame, at.tipo === 'retorno'))
    }
    const outra = bloco === 'anamnese' ? 'exame' : 'anamnese'
    for (const etapa of etapasParaOficializar(bloco, estado.blocos[outra].estado === 'oficializado')) await oficializarEtapa(id, etapa)
  }

  /** Salvar anamnese ou exame. Com consulta no servidor, só vale depois que o servidor guardou. */
  const salvarPagina1 = (bloco: 'anamnese' | 'exame') => {
    if (!servidor) return concluirPagina1(bloco)
    enviarPagina1(servidor.id, bloco).then(
      () => concluirPagina1(bloco),
      (e: unknown) => setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível salvar. Tente de novo.'),
    )
  }

  /** Consulta real: pede as perguntas contextuais (a história já existe no servidor). Falha: a história segue sem elas. */
  const buscarPerguntas = async (id: string) => {
    setPerguntasEstado({ carregando: true, falhou: false })
    try {
      const q = await gerarPerguntas(id)
      setPerguntas((atuais) => juntarPerguntas(atuais, q.perguntas))
      setPerguntasEstado({ carregando: false, falhou: q.iaFalhou })
    } catch {
      setPerguntasEstado({ carregando: false, falhou: true })
    }
  }

  /** Consulta real: a história vem do servidor. Falha da IA ou da rede: avisa e abre vazia para o médico escrever. */
  const montarDoServidor = async (id: string) => {
    setMontando(true)
    let recebido = historiaVazia(histBase, at.ficha)
    let veio = false
    try {
      const r = await gerarHistoria(id)
      if (r.conteudo) { recebido = r.conteudo; veio = true } else setAviso('A IA não conseguiu; escreva ou tente de novo')
    } catch (e) {
      setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível montar a história. Tente de novo.')
    }
    const novas = secoesDoServidor(recebido.historia)
    setHistBase(recebido)
    setHistoria((h) => h
      ? { versao: h.versao + 1, geradas: novas, ...atualizarSecoes(h.geradas, h.textos, novas) }
      : { versao: 1, geradas: novas, textos: novas.map((x) => x.texto), mudou: novas.map(() => true), sugestoes: novas.map(() => null) })
    setMontando(false)
    if (veio) await buscarPerguntas(id)
  }

  /** Quando a anamnese e o exame ficam salvos, a história é montada e a página dela abre. */
  const concluirPagina1 = (bloco: 'anamnese' | 'exame') => {
    const novo = oficializar(estado, bloco)
    despachar({ tipo: 'oficializar', bloco })
    if (!podeOficializar(estado, 'historia') && podeOficializar(novo, 'historia')) {
      montarHistoriaDaPagina1()
      navegar(`${base}/historia`)
    }
  }

  /** Monta a história com o que a página 1 salvou (ou, numa atualização, mexe só no que mudou). */
  const montarHistoriaDaPagina1 = () => {
    // consulta real: a história vem da IA do servidor; no retorno a tela monta a História da evolução (sem IA) e o servidor só a guarda
    if (servidor && at.tipo !== 'retorno') { void montarDoServidor(servidor.id); return }
    const f = fontes.current
    // os sinais de alerta não saem mais da página 1 (vêm depois da história, como perguntas contextuais)
    const sinais: { texto: string; resposta: RespostaAlerta | null }[] = []
    // retorno: História da evolução (sem identificação, abre com "Paciente relata..."); primeira consulta: história clínica
    const novas = at.tipo === 'retorno'
      ? montarHistoriaEvolucao(f.anamnese, f.exame, conteudo.complementares, { falas: conteudo.falas, sinais: [], perguntas: f.perguntas, anteriores: entradasDoPaciente().map((e) => ({ data: e.data, exameFisico: e.dados.exameFisico, extensaoPct: e.dados.extensaoPct })) })
      : montarHistoria(at, new Date(), f.anamnese, f.exame, conteudo.complementares, { falas: conteudo.falas, sinais, perguntas: f.perguntas, formulario: f.formulario ? { ...f.formulario, partes: partesPreConsulta(esp.slug) } : undefined })
    // primeira vez: tudo novo; depois: a IA mexe só no que mudou
    setHistoria((h) => h
      ? { versao: h.versao + 1, geradas: novas, ...atualizarHistoria(h.geradas, h.textos, novas) }
      : { versao: 1, geradas: novas, textos: novas.map((s) => s.texto), mudou: novas.map(() => true), sugestoes: novas.map(() => null) })
  }

  // consulta retomada direto na página da história: a anamnese e o exame já estão salvos, mas a história ainda não
  // (recarregou antes de salvá-la) → monta agora, como se tivesse acabado de salvar a página 1
  const historiaPedida = useRef(false)
  useEffect(() => {
    if (etapa !== 'historia' || historia || montando || historiaPedida.current || !podeOficializar(estado, 'historia')) return
    historiaPedida.current = true
    montarHistoriaDaPagina1()
  })

  /** Responder ou acrescentar pergunta muda a história (a etapa fica revisada e as seguintes desatualizadas). */
  const mudarPerguntas = (f: (xs: PerguntaServidor[]) => PerguntaServidor[]) => {
    setPerguntas(f)
    if (estado.blocos.historia.estado !== 'revisado_medico') fazer('editar', 'historia')
  }

  /** Diagnósticos: itens = hipóteses da IA à mostra + as do médico, cada uma com a decisão dele; reserva = as que o "+" traz.
   *  resumo = o que pesa na conduta, da história salva (vai para a conduta com V/F). */
  const [dd, setDd] = useState<{ versao: number; itens: ItemDD[]; reserva: Hipotese[]; resumo: ItemResumo[] } | null>(() =>
    // consulta retomada: os diagnósticos e as decisões guardadas voltam como rascunho (sem a reserva do "+")
    retomada.diagnosticos && retomada.historia
      ? { versao: 1, itens: itensDoServidor(retomada.diagnosticos), reserva: [], resumo: montarResumo(at.tipo === 'retorno' ? secoesDaHistoria(retomada.historia.historia) : comAlergiasDaFicha(retomada.historia, secoesDaHistoria(retomada.historia.historia))) }
      : null)
  /** última versão já escrita "ao vivo" de cada página: ao voltar, aparece pronta (não escreve de novo) */
  const [escrita, setEscrita] = useState({ historia: retomada.historia ? 1 : 0, diagnosticos: retomada.diagnosticos ? 1 : 0, prontuario: 0 })
  const escreveu = (pagina: 'historia' | 'diagnosticos' | 'prontuario', versao: number) =>
    setEscrita((e) => (e[pagina] === versao ? e : { ...e, [pagina]: versao }))

  /** Salvar história. Consulta real: o servidor guarda e oficializa primeiro; só então a tela segue. */
  const salvarHistoria = () => {
    const doRetorno = !!servidor && at.tipo === 'retorno'
    if (!servidor || !historia || (!histBase && !doRetorno)) return concluirHistoria()
    const secoes = historia.geradas.map((s, i) => ({ rotulo: s.rotulo, texto: historia.textos[i] }))
    // retorno: a segurança (alergias, remédios) o servidor completa a partir do prontuário
    const bloco = doRetorno ? historiaDaEvolucaoParaServidor(secoes, historiaVazia(null, at.ficha)) : historiaParaServidor(secoes, histBase!, perguntas)
    enviarHistoria(servidor.id, bloco)
      .then(() => oficializarEtapa(servidor.id, 'historia'))
      .then(
        () => concluirHistoria(),
        (e: unknown) => setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível salvar. Tente de novo.'),
      )
  }

  /** Consulta real: o servidor sugere os diagnósticos (lê a história salva e as respostas das perguntas). Falha: abre vazia para o médico escrever. */
  const montarDDDoServidor = async (id: string, salva: SecaoHistoria[]) => {
    setMontandoDD(true)
    let recebido: DiagnosticosServidor | null = null
    try {
      const r = await gerarDiagnosticos(id)
      if (r.conteudo) recebido = r.conteudo; else setAviso('A IA não conseguiu; adicione o diagnóstico à mão')
    } catch (e) {
      setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível sugerir os diagnósticos. Tente de novo.')
    }
    const resumo = montarResumo(salva)
    if (recebido) {
      setDdBase(recebido)
      const hipoteses = hipotesesDoServidor(recebido)
      setDd((d) => d
        ? { versao: d.versao + 1, ...atualizarComReserva(d.itens, hipoteses), resumo: atualizarResumo(d.resumo, resumo) }
        : { versao: 1, ...iniciarDiagnosticos(hipoteses), resumo })
    } else {
      // sem sugestão nova: o que o médico já decidiu fica como está
      setDd((d) => (d ? { ...d, resumo: atualizarResumo(d.resumo, resumo) } : { versao: 1, itens: [], reserva: [], resumo }))
    }
    setMontandoDD(false)
  }

  /** Ao liberar os diagnósticos, a IA sugere (ou atualiza só o que mudou) e a página deles abre. */
  const concluirHistoria = () => {
    const novo = oficializar(estado, 'historia')
    despachar({ tipo: 'oficializar', bloco: 'historia' })
    if (!historia || podeOficializar(estado, 'diagnosticos') || !podeOficializar(novo, 'diagnosticos')) return
    // a IA usa só a história salva: o texto que está na tela, com as edições do médico
    const salva = historia.geradas.map((s, i) => ({ rotulo: s.rotulo, texto: historia.textos[i] }))
    if (servidor) {
      // retorno: o "resumo" da conduta leva também o que o prontuário já tem (regra 14.2); a IA dos diagnósticos lê só a evolução salva
      const anteriorDoServidor = at.tipo === 'retorno' ? entradasDoPaciente().find((e) => e.data < dia && e.dados.diagnosticos.length > 0) : undefined
      const alergiaDoProntuario = at.tipo === 'retorno' ? secaoDeAlergias(at.alergiasDoProntuario ?? []) : null
      void montarDDDoServidor(servidor.id, at.tipo === 'retorno' ? [...(alergiaDoProntuario ? [alergiaDoProntuario] : []), ...(anteriorDoServidor ? secoesDaConsultaAnterior(anteriorDoServidor.dados) : []), ...salva] : comAlergiasDaFicha(histBase, salva))
      navegar(`${base}/diagnosticos`)
      return
    }
    // retorno: os diagnósticos são NOVOS, só da evolução de hoje (como numa primeira consulta, sem repetir o prontuário);
    // "Para relembrar" (alergias, comorbidades, o que não muda) ainda vem do prontuário, junto com a evolução (regra 14.2)
    const retorno = at.tipo === 'retorno'
    const anterior = retorno ? entradasDoPaciente().find((e) => e.data < dia && e.dados.diagnosticos.length > 0) : undefined
    const r = montarDiagnosticos(esp.slug, at.paciente.nome, retorno ? secoesDaEvolucaoParaDD(salva) : salva)
    const resumo = montarResumo(anterior ? [...secoesDaConsultaAnterior(anterior.dados), ...salva] : salva)
    const inicio = iniciarDiagnosticos(r.hipoteses)
    setDd((d) => d
      ? { versao: d.versao + 1, ...atualizarComReserva(d.itens, r.hipoteses), resumo: atualizarResumo(d.resumo, resumo) }
      : { versao: 1, ...inicio, resumo })
    navegar(`${base}/diagnosticos`)
  }

  /** O médico mexeu nos diagnósticos: deixam de estar salvos (e a conduta, se salva, fica desatualizada). */
  const mexerDd = (f: (d: NonNullable<typeof dd>) => NonNullable<typeof dd>) => {
    setDd((d) => d && f(d))
    if (estado.blocos.diagnosticos.estado !== 'revisado_medico') fazer('editar', 'diagnosticos')
  }
  const nosItens = (f: (itens: ItemDD[]) => ItemDD[]) => mexerDd((d) => ({ ...d, itens: f(d.itens) }))

  /** Conduta: sugerida só com os diagnósticos salvos (confirmados) + "Para relembrar". */
  const [conduta, setConduta] = useState<{ versao: number; c: Conduta } | null>(() => {
    // consulta retomada: a conduta guardada volta como rascunho, com as escolhas e os textos de antes
    const b = retomada.conduta
    if (!b) return null
    const c = condutaDoServidor(b, { id: idDaHipotese(b.diagnostico), nome: b.diagnostico.nome, cid: b.diagnostico.cid }, dia, (id) => id)
    return { versao: 1, c: { ...c, escolha: b.escolha, textos: b.textos, editado: b.textos.map(() => true), revelado: b.textos.map(() => true) } }
  })

  /** Salvar diagnósticos. Consulta real: o servidor guarda e oficializa primeiro; só então a tela segue. */
  const salvarDiagnosticos = () => {
    if (!servidor || !dd) return concluirDiagnosticos()
    enviarDiagnosticos(servidor.id, diagnosticosParaServidor(dd.itens, ddBase))
      .then(() => oficializarEtapa(servidor.id, 'diagnosticos'))
      .then(
        () => concluirDiagnosticos(),
        (e: unknown) => setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível salvar. Tente de novo.'),
      )
  }

  /** Consulta real: o servidor monta a conduta (tabela de protocolo ou IA). Falha: as 4 seções abrem em branco para o médico escrever. */
  const montarCondutaDoServidor = async (id: string) => {
    setMontandoConduta(true)
    let recebido: CondutaServidor | null = null
    try {
      const r = await gerarConduta(id)
      recebido = r.conteudo // mesmo sem conduta a revisar, a urgência e a emergência (regra fixa) vêm aqui
      if (!r.gravado && (!recebido || recebido.proposta.iaFalhou)) setAviso('A IA não conseguiu; escreva a conduta')
    } catch (e) {
      setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível montar a conduta. Tente de novo.')
    }
    const principal = dd?.itens.find((x) => x.decisao === 'confirmada')
    const base: CondutaServidor | null = recebido ?? (principal ? semProposta(principal.hip.nome, principal.hip.cid) : null)
    if (base) {
      setCondBase(base)
      const nomeDoSinal = (sid: string) => catalogo.find((x) => x.id === sid)?.texto ?? sid
      const nova = condutaDoServidor(base, { id: idDaHipotese(base.diagnostico), nome: base.diagnostico.nome, cid: base.diagnostico.cid }, dia, nomeDoSinal)
      setConduta((x) => (x ? { versao: x.versao + 1, c: atualizarConduta(x.c, nova) } : { versao: 1, c: nova }))
    }
    setMontandoConduta(false)
  }

  /** Ao liberar a conduta, a IA sugere (ou atualiza só o que mudou) e a página dela abre. */
  const concluirDiagnosticos = () => {
    const novo = oficializar(estado, 'diagnosticos')
    despachar({ tipo: 'oficializar', bloco: 'diagnosticos' })
    if (!dd || podeOficializar(estado, 'conduta') || !podeOficializar(novo, 'conduta')) return
    if (servidor) { void montarCondutaDoServidor(servidor.id); navegar(`${base}/conduta`); return }
    const nova = montarConduta(dd.itens, dd.resumo, dia)
    if (!nova) return
    setConduta((x) => (x ? { versao: x.versao + 1, c: atualizarConduta(x.c, nova) } : { versao: 1, c: nova }))
    navegar(`${base}/conduta`)
  }

  /** O médico mexeu na conduta: deixa de estar salva. */
  /** Receita e anexos: montados só com a conduta salva (dados do paciente e da consulta nos documentos). */
  const [docs, setDocs] = useState<{ versao: number; itens: Anexo[] } | null>(null)
  const dados: DadosConsulta = {
    paciente: at.paciente.nome,
    idade: idade(at.paciente.nascimento, new Date()),
    data: dia.split('-').reverse().join('/'),
    hora: at.inicio,
  }
  // consulta retomada com a conduta já salva: os anexos voltam (os já enviados, como enviados)
  useEffect(() => {
    if (!servidor || docs !== null || !conduta || docsServidor === null) return
    if (estado.blocos.conduta.estado !== 'oficializado' || estado.blocos.conduta.desatualizado) return
    setDocs({ versao: 1, itens: aplicarDocumentos(montarAnexos(conduta.c, dados), docsServidor) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servidor, docs, conduta, docsServidor, estado.blocos.conduta])

  /** Salvar conduta. Consulta real: o servidor guarda e oficializa primeiro; só então a tela segue. */
  const salvarConduta = () => {
    if (!servidor || !conduta || !condBase) return concluirConduta()
    enviarConduta(servidor.id, condutaParaServidor(conduta.c, condBase))
      .then(() => oficializarEtapa(servidor.id, 'conduta'))
      .then(
        () => concluirConduta(),
        (e: unknown) => setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível salvar. Tente de novo.'),
      )
  }

  /** Ao liberar os anexos, a IA monta (ou refaz só o que mudou) e a página deles abre. */
  const concluirConduta = () => {
    const novo = oficializar(estado, 'conduta')
    despachar({ tipo: 'oficializar', bloco: 'conduta' })
    if (!conduta || podeOficializar(estado, 'anexos') || !podeOficializar(novo, 'anexos')) return
    const novos = aplicarDocumentos(montarAnexos(conduta.c, dados), docsServidor ?? [])
    setDocs((x) => (x ? { versao: x.versao + 1, itens: atualizarAnexos(x.itens, novos) } : { versao: 1, itens: novos }))
    navegar(`${base}/anexos`)
  }

  /** Retorno (página 5): só rascunho; vai ao servidor no Finalizar. */
  const [retorno, setRetorno] = useState<RascunhoRetorno>(RASCUNHO_INICIAL)
  const [ocupadosRetorno, setOcupadosRetorno] = useState<HorarioOcupado[]>([])
  const agendaRetorno = useMemo(() => marcarOcupados(gerarAgenda(new Date()), ocupadosRetorno), [ocupadosRetorno])
  // consulta real: os horários já tomados (pedidos e outros retornos) nos próximos dias; sem conexão, a agenda aparece como está
  useEffect(() => {
    if (!servidor || etapa !== 'anexos') return
    const hoje = new Date()
    const de = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1))
    const ate = dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 15))
    Promise.all([pedidosDaAgenda(de, ate), retornosDaAgenda(de, ate)]).then(
      ([pedidos, retornos]) => setOcupadosRetorno([...pedidos.filter((p) => p.status !== 'cancelado'), ...retornos]),
      () => {},
    )
  }, [servidor, etapa])
  /** Mexer no retorno muda o que o prontuário diz: a página dos anexos deixa de estar salva. */
  const mudarRetorno = (r: RascunhoRetorno) => {
    setRetorno(r)
    if (estado.blocos.anexos.estado !== 'revisado_medico') fazer('editar', 'anexos')
  }

  /** O médico mexeu nos anexos: a página deixa de estar finalizada. */
  const mexerDocs = (f: (xs: Anexo[]) => Anexo[]) => {
    setDocs((x) => x && { ...x, itens: f(x.itens) })
    if (estado.blocos.anexos.estado !== 'revisado_medico') fazer('editar', 'anexos')
  }

  /** Prontuário: os dados organizados (o que fica gravado) e o texto na tela, escrito só com o que foi salvo. */
  /** consulta real: o título da entrada ('Consulta N') calculado com as entradas já finalizadas do paciente */
  const [tituloServidor, setTituloServidor] = useState('')
  const [prontuario, setProntuario] = useState<{ versao: number; dados: DadosEntrada; geradas: SecaoProntuario[]; textos: Record<string, string>; mudou: Record<string, boolean> } | null>(null)
  const fotoExemplo = at.paciente.nome === 'Mariana Costa' ? '/img/acne-exemplo.jpg' : null

  /** Consulta real: o servidor monta o prontuário com o que está salvo (sem IA, na hora). Falha: fica nos Anexos e avisa. */
  const montarProntuarioDoServidor = async (id: string) => {
    try {
      const [proposto, anteriores] = await Promise.all([prontuarioProposto(id), prontuarioDoPaciente(servidor!.pacienteId)])
      const dadosP = { ...proposto, retornoMarcado: retornoParaEnvio(retorno) } // o servidor só grava o retorno ao finalizar
      setTituloServidor(tituloNovaEntrada(anteriores, at.tipo))
      const novas = secoesDosDados(dadosP)
      setProntuario((x) => x
        ? { versao: x.versao + 1, dados: dadosP, geradas: novas, ...atualizarProntuario(x.geradas, x.textos, novas) }
        : { versao: 1, dados: dadosP, geradas: novas, textos: Object.fromEntries(novas.flatMap((sec) => sec.linhas.map((l) => [chave(sec, l), l.texto]))), mudou: Object.fromEntries(novas.flatMap((sec) => sec.linhas.map((l) => [chave(sec, l), true]))) })
      navegar(`${base}/prontuario`)
    } catch (e) {
      fazer('editar', 'anexos') // volta a poder salvar os anexos para tentar de novo
      setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível montar o prontuário. Tente de novo.')
    }
  }

  /** Salvar anexos. Ao liberar o prontuário, a IA escreve (ou atualiza só o que mudou) e a página dele abre. */
  const salvarAnexos = () => {
    const novo = oficializar(estado, 'anexos')
    despachar({ tipo: 'oficializar', bloco: 'anexos' })
    if (!historia || !dd || !conduta || podeOficializar(estado, 'prontuario') || !podeOficializar(novo, 'prontuario')) return
    if (servidor) { void montarProntuarioDoServidor(servidor.id); return }
    const salva = historia.geradas.map((s, i) => ({ rotulo: s.rotulo, texto: historia.textos[i] }))
    const fotos = Array.from({ length: conteudo.fotos }, (_, i) => ({ n: i + 1, src: i === 0 ? fotoExemplo : null }))
    const dadosP = dadosDaConsulta({ historia: salva, itens: dd.itens, conduta: conduta.c, anexos: docs?.itens, complementares: conteudo.complementares, fotos, extensao: fontes.current.exame.find((x) => x.rotulo === 'Extensão')?.valor, retornoMarcado: retornoParaEnvio(retorno) })
    const novas = secoesDosDados(dadosP)
    setProntuario((x) => x
      ? { versao: x.versao + 1, dados: dadosP, geradas: novas, ...atualizarProntuario(x.geradas, x.textos, novas) }
      : { versao: 1, dados: dadosP, geradas: novas, textos: Object.fromEntries(novas.flatMap((s) => s.linhas.map((l) => [chave(s, l), l.texto]))), mudou: Object.fromEntries(novas.flatMap((s) => s.linhas.map((l) => [chave(s, l), true]))) })
    navegar(`${base}/prontuario`)
  }

  /** Salvar prontuário. Consulta real: o servidor finaliza primeiro (a entrada fica imutável); só então a tela segue. */
  const salvarProntuario = () => {
    if (!servidor || !prontuario) return concluirProntuario()
    finalizarConsulta(servidor.id, edicoesDoMedico(prontuario.dados, prontuario.textos), retornoParaEnvio(retorno)).then(
      () => concluirProntuario(),
      (e: unknown) => {
        setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível finalizar. Tente de novo.')
        // horário do retorno tomado (ou que passou): volta à página 5 para escolher outro; o prontuário não se perde
        if (e instanceof ErroServidor && erroDeHorario(e) && retorno.escolha === 'sim') {
          setRetorno({ escolha: 'sim', marcado: null })
          fazer('editar', 'anexos')
          navegar(`${base}/anexos`)
        }
      },
    )
  }

  /** A consulta fica finalizada e volta para a página inicial do módulo. */
  const concluirProntuario = () => {
    fazer('oficializar', 'prontuario')
    // consulta real: o servidor já guardou a entrada; nos exemplos ela vai para o prontuário local (com as edições do médico)
    if (prontuario && !servidor) salvarEntrada(at.paciente.id, { tipo: at.tipo, modalidade: at.modalidade, data: dia, hora: at.inicio, ...aplicarEdicoes(prontuario.dados, prontuario.textos) }, at.paciente)
    navegar(`/modulo/${esp.slug}`, { state: { aviso: `Consulta finalizada. Prontuário de ${at.paciente.nome} salvo.` } })
  }

  const mexerConduta = (f: (c: Conduta) => Conduta) => {
    setConduta((x) => x && { ...x, c: f(x.c) })
    if (estado.blocos.conduta.estado !== 'revisado_medico') fazer('editar', 'conduta')
  }

  // etapa atual como título (sem número) + atalhos para as etapas já liberadas (nomes curtos quando são as 6, para caber numa linha)
  const curtos = ETAPAS.filter((x) => situacaoDaEtapa(estado, x.id) !== 'bloqueado').length > 5
  const navegador = (
    <nav aria-label="Etapas da consulta" className="flex flex-wrap items-center gap-1.5">
      {[...ETAPAS].sort((x, y) => Number(y.id === etapa) - Number(x.id === etapa)).map((x) => {
        const s = situacaoDaEtapa(estado, x.id)
        // etapas seguintes só aparecem quando liberadas (a anterior oficializada)
        if (x.id !== etapa && s === 'bloqueado') return null
        const aqui = x.id === etapa
        const marca = (s === 'oficializado' || s === 'desatualizado') && (
          // salvo = só o ✓ (visto); o nome fica para o leitor de tela
          <span className={`shrink-0 truncate ${s === 'desatualizado' ? 'text-[12px] font-bold' : 'text-[14px] font-bold text-petroleo'}`} {...(s === 'oficializado' ? { 'aria-label': 'Salvo', title: 'Salvo' } : {})}>
            {s === 'oficializado' ? '✓' : 'Desatualizado'}
          </span>
        )
        // a etapa atual é o título da página (sem número); as liberadas viram atalhos ao lado
        if (aqui) return (
          <h1 key={x.id} className="flex h-[38px] items-center gap-3 pr-2 text-[24px] font-semibold">{nomeDaEtapa(x.id, x.rotulo)}{marca}</h1>
        )
        return (
          <Link key={x.id} to={`${base}/${x.id}`}
            className="flex h-[38px] min-w-0 items-center gap-3 border border-linha bg-branco px-3 no-underline transition hover:bg-(--esp-claro)">
            <span className="flex min-w-0 items-baseline gap-3">
              <span className="truncate text-[15px] font-semibold">{nomeDaEtapa(x.id, curtos ? x.curto : x.rotulo)}</span>
              {marca}
            </span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div style={{ '--esp': esp.cor } as CSSProperties} className="cor-esp flex min-h-screen flex-col bg-papel bg-[url(/papel.png)] bg-size-[512px]">
      <header className="mx-auto w-full max-w-6xl px-4 pt-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:gap-x-5">
          <Link to={`/modulo/${esp.slug}`} className="no-underline" aria-label={`${esp.raiz}IA, início`}><NomeModulo esp={esp} className="text-[26px]" /></Link>
          <p className="text-[15px]">
            <b className="text-[17px]">{at.paciente.nome}</b>
            <span className="text-apagado">{at.paciente.nascimento && ` · ${idade(at.paciente.nascimento, new Date())} anos`} · {at.tipo === 'consulta' ? 'Consulta' : 'Retorno'} · {at.modalidade === 'online' ? 'Online' : 'Presencial'}</span>
          </p>
          {alergias.map((a) => (
            <span key={a.substancia} className="bg-alerta-clinico px-2.5 py-1 text-[13px] text-branco">
              <b className="mr-1.5 text-[11px] tracking-[0.14em] uppercase">Alergia</b><b>{a.substancia}</b>
            </span>
          ))}
          {/* o prontuário só existe a partir do retorno (regra 13.2) */}
          {at.temHistorico && (
            <button type="button" onClick={alternarJanela} aria-pressed={janelaAberta} title="Abre numa janela separada (só leitura)"
              className={`ml-auto border-[1.5px] border-tinta px-3 py-1 text-[14px] font-semibold ${janelaAberta ? 'bg-tinta text-papel' : 'hover:bg-tinta hover:text-papel'}`}>
              {janelaAberta ? 'Fechar prontuário' : 'Prontuário'}
            </button>
          )}
          <button type="button" onClick={() => setAnexos(true)} className={`${at.temHistorico ? '' : 'ml-auto '}border-[1.5px] border-tinta px-3 py-1 text-[14px] font-semibold hover:bg-tinta hover:text-papel`}>
            Anexos
          </button>
        </div>

        {/* na página 1 o navegador fica sobre a coluna da anamnese */}
        {etapa !== 'anamnese-exame' && <div className="mt-2.5">{navegador}</div>}
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-3 sm:px-6">
        {/* a página 1 fica montada (escondida) nas outras etapas: gravação, notas e campos não se perdem */}
        <div className={`grid flex-1 gap-4 lg:grid-cols-2 ${etapa === 'anamnese-exame' ? '' : 'hidden'}`}>
          <div className="flex min-w-0 flex-col gap-3 [&>section]:flex-1">
            {navegador}
            <Anamnese
              falas={conteudo.falas}
              perguntas={conteudo.perguntas}
              alertas={soAlergias(conteudo.alertas)}
              respostas={estado.alertas}
              situacao={estado.blocos.anamnese.estado}
              pendencias={pendenciasAnamnese(estado)}
              podeGravar={podeGravar(f) || !!at.gravacaoAutorizada}
              partes={partesPreConsulta(esp.slug)}
              formulario={formulario}
              retorno={at.tipo === 'retorno'}
              textoInicial={retomada.anamnese?.texto}
              perguntasIniciais={retomada.anamnese?.perguntas}
              onEditar={() => fazer('editar', 'anamnese')}
              onResponder={(id, r) => despachar({ tipo: 'alerta', id, r })}
              onOficializar={(texto, perguntas, formulario) => { fontes.current.anamnese = texto; fontes.current.perguntas = perguntas; fontes.current.formulario = formulario; salvarPagina1('anamnese') }}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-3 [&>section]:flex-1">
            <h2 className="flex h-[38px] items-center text-[24px] font-semibold">{at.tipo === 'retorno' ? 'Fotos e exames' : 'Exame físico e complementar'}</h2>
            <Exame
              campos={conteudo.exame}
              fotos={conteudo.fotos}
              fotoExemplo={fotoExemplo}
              marcas={conteudo.marcas}
              complementares={conteudo.complementares}
              fotosPaciente={Object.entries(formulario?.fotos ?? {}).filter(([k]) => !k.startsWith('documentos_')).map(([, url]) => url)}
              documentos={Object.entries(formulario?.fotos ?? {}).filter(([k]) => k.startsWith('documentos_')).map(([k, url]) => ({ nome: `Documento ${k.slice('documentos_'.length)}`, url }))}
              retorno={consultaAnterior ? { data: consultaAnterior.data.split('-').reverse().slice(0, 2).join('/'), fotos: consultaAnterior.dados.fotos.length } : undefined}
              situacao={estado.blocos.exame.estado}
              observacoesIniciais={retomada.exame?.['Observações']}
              onEditar={() => fazer('editar', 'exame')}
              onOficializar={(valores) => { fontes.current.exame = valores; salvarPagina1('exame') }}
              onAviso={setAviso}
            />
          </div>
        </div>
        {etapa === 'historia' && montando ? (
          <p className="py-16 text-center text-apagado">A IA está montando a história com a anamnese e o exame físico salvos…</p>
        ) : etapa === 'historia' && historia && situacaoDaEtapa(estado, 'historia') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'historia') === 'desatualizado' && !podeOficializar(estado, 'historia') && (
              <p className="mb-2 text-[14px] font-semibold">A anamnese ou o exame físico mudou. Salve de novo e a IA atualiza só o que mudou na história.</p>
            )}
            <PaginaHistoria
              key={historia.versao}
              animar={escrita.historia < historia.versao}
              onEscrito={() => escreveu('historia', historia.versao)}
              secoes={historia.geradas}
              tabelaExames={at.tipo === 'retorno' ? tabelaDeExames(entradasDoPaciente().flatMap((e) => e.dados.exames), conteudo.complementares) : null}
              textos={historia.textos}
              mudou={historia.mudou}
              sugestoes={historia.sugestoes}
              primeira={historia.versao === 1}
              situacao={situacaoDaEtapa(estado, 'historia')}
              podeSalvar={podeOficializar(estado, 'historia')}
              onMudar={(i, texto) => {
                setHistoria((h) => h && { ...h, textos: h.textos.map((x, j) => (j === i ? texto : x)) })
                if (estado.blocos.historia.estado !== 'revisado_medico') fazer('editar', 'historia')
              }}
              onDecidir={(i, aceitar) => {
                setHistoria((h) => h && {
                  ...h,
                  textos: aceitar ? h.textos.map((x, j) => (j === i ? h.sugestoes[i] ?? x : x)) : h.textos,
                  sugestoes: h.sugestoes.map((x, j) => (j === i ? null : x)),
                })
                if (aceitar && estado.blocos.historia.estado !== 'revisado_medico') fazer('editar', 'historia')
              }}
              onSalvar={salvarHistoria}
              bloco={servidor && histBase ? (
                <PerguntasHistoria
                  perguntas={perguntas}
                  urgencias={avisosDeUrgencia(histBase, perguntas, catalogo)}
                  catalogo={catalogo}
                  carregando={perguntasEstado.carregando}
                  falhou={perguntasEstado.falhou}
                  onResponder={(id, r) => mudarPerguntas((xs) => responder(xs, id, r))}
                  onAdicionar={(q) => mudarPerguntas((xs) => adicionarPergunta(xs, q))}
                  onTentarDeNovo={() => void buscarPerguntas(servidor.id)}
                />
              ) : undefined}
            />
          </div>
        ) : etapa === 'diagnosticos' && montandoDD ? (
          <p className="py-16 text-center text-apagado">A IA está pensando nos diagnósticos com a história salva…</p>
        ) : etapa === 'diagnosticos' && dd && situacaoDaEtapa(estado, 'diagnosticos') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'diagnosticos') === 'desatualizado' && !podeOficializar(estado, 'diagnosticos') && (
              <p className="mb-2 text-[14px] font-semibold">A história clínica mudou. Salve a história de novo e a IA atualiza só o que mudou nas hipóteses.</p>
            )}
            <PaginaDiagnosticos
              key={dd.versao}
              itens={dd.itens}
              naReserva={dd.reserva.length}
              resumo={dd.resumo}
              alergia={estiloAlergia(esp)}
              primeira={dd.versao === 1}
              retorno={at.tipo === 'retorno'}
              animar={escrita.diagnosticos < dd.versao}
              onEscrito={() => escreveu('diagnosticos', dd.versao)}
              situacao={situacaoDaEtapa(estado, 'diagnosticos')}
              podeSalvar={podeOficializar(estado, 'diagnosticos')}
              pendencia={pendenciasDiagnosticos(dd.itens)}
              onDecidir={(id, d) => nosItens((xs) => xs.flatMap((x) => (x.hip.id !== id ? [x] : x.propria && d === 'descartada' ? [] : [{ ...x, decisao: d }])))}
              onAviso={(id, manter) => nosItens((xs) => xs.flatMap((x) => {
                if (x.hip.id !== id || !x.aviso) return [x]
                if (manter) return [{ ...x, aviso: null }]
                return x.aviso.tipo === 'saiu' ? [] : [{ ...x, aviso: null, decisao: 'pendente' as const }]
              }))}
              onAdicionar={(nome, cid) => nosItens((xs) => [...xs, { hip: { id: `propria-${Date.now()}`, nome, cid, pct: null, evidencias: [] }, decisao: 'confirmada', propria: true, mudou: false, aviso: null }])}
              onMais={() => mexerDd((d) => ({ ...d, ...chamarMais(d) }))}
              onMarcar={(id, m) => mexerDd((d) => ({ ...d, resumo: marcarResumo(d.resumo, id, m) }))}
              onSalvar={salvarDiagnosticos}
            />
          </div>
        ) : etapa === 'conduta' && montandoConduta ? (
          <p className="py-16 text-center text-apagado">A IA está montando a conduta com os diagnósticos salvos…</p>
        ) : etapa === 'conduta' && conduta && dd && situacaoDaEtapa(estado, 'conduta') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'conduta') === 'desatualizado' && !podeOficializar(estado, 'conduta') && (
              <p className="mb-2 text-[14px] font-semibold">Os diagnósticos mudaram. Salve os diagnósticos de novo e a IA atualiza só o que mudou na conduta.</p>
            )}
            <PaginaConduta
              key={conduta.versao}
              conduta={conduta.c}
              resumo={dd.resumo}
              alergia={estiloAlergia(esp)}
              especialidade={esp.nome}
              primeira={conduta.versao === 1}
              situacao={situacaoDaEtapa(estado, 'conduta')}
              podeSalvar={podeOficializar(estado, 'conduta')}
              pendencia={pendenciasConduta(conduta.c)}
              onEscolher={(linha, opcao) => mexerConduta((c) => escolherOpcao(c, linha, opcao))}
              onOutro={(linha, texto) => mexerConduta((c) => escreverOutro(c, linha, texto))}
              onRevelar={(i) => setConduta((x) => x && { ...x, c: revelar(x.c, i) })}
              onEditar={(i, texto) => mexerConduta((c) => editarTexto(c, i, texto))}
              onSalvar={salvarConduta}
              urgencia={servidor && condBase ? urgenciaDaConduta(condBase.proposta) : null}
              retiradas={servidor && condBase ? bloqueadasDaConduta(condBase.proposta) : undefined}
            />
          </div>
        ) : etapa === 'anexos' && docs && situacaoDaEtapa(estado, 'anexos') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'anexos') === 'desatualizado' && !podeOficializar(estado, 'anexos') && (
              <p className="mb-2 text-[14px] font-semibold">A conduta mudou. Salve a conduta de novo e a IA refaz só os anexos que mudaram.</p>
            )}
            <PaginaAnexos
              key={docs.versao}
              anexos={docs.itens}
              dados={dados}
              situacao={situacaoDaEtapa(estado, 'anexos')}
              podeSalvar={podeOficializar(estado, 'anexos')}
              pendencia={pendenciasAnexos(docs.itens) ?? (podeSalvarAnexos(retorno) ? null : 'Escolha o dia e o horário do retorno.')}
              retorno={at.tipo === 'retorno' ? undefined : <EscolhaRetorno valor={retorno} onMudar={mudarRetorno} agenda={agendaRetorno} atendeOnline={MEDICO_EXEMPLO.atendeOnline} fixo={estado.blocos.prontuario.estado === 'oficializado'} />}
              onEmitir={(tipo) => mexerDocs((xs) => alternarEmitir(xs, tipo))}
              onEditar={(tipo, texto) => mexerDocs((xs) => editarAnexo(xs, tipo, texto))}
              onCampos={(tipo, campos) => mexerDocs((xs) => definirCampos(xs, tipo, campos))}
              onAvancar={(tipo) => {
                const antes = docs.itens.find((x) => x.tipo === tipo)
                const aplicar = () => {
                  mexerDocs((xs) => avancar(xs, tipo))
                  if (antes && (antes.estado === 'assinado' || (antes.estado === 'revisado' && !antes.assinatura))) setAviso(`${antes.titulo} enviado ao paciente (simulação).`)
                }
                const enviado = servidor && virouEnviado(docs.itens, avancar(docs.itens, tipo), tipo) ? avancar(docs.itens, tipo).find((x) => x.tipo === tipo) : undefined
                if (!servidor || !enviado) return aplicar()
                // consulta real: o servidor grava primeiro; se falhar, o anexo não fica como enviado
                const doc = documentoParaServidor(enviado)
                salvarDocumento(servidor.id, doc).then(
                  () => { setDocsServidor((ds) => [...(ds ?? []).filter((x) => x.tipo !== tipo), doc]); aplicar() },
                  (e: unknown) => setAviso(e instanceof ErroServidor ? e.message : 'Não foi possível enviar. Tente de novo.'),
                )
              }}
              onSalvar={salvarAnexos}
            />
          </div>
        ) : etapa === 'prontuario' && prontuario && situacaoDaEtapa(estado, 'prontuario') !== 'bloqueado' ? (
          <div className="flex flex-1 flex-col [&>section]:flex-1">
            {situacaoDaEtapa(estado, 'prontuario') === 'desatualizado' && !podeOficializar(estado, 'prontuario') && (
              <p className="mb-2 text-[14px] font-semibold">Os anexos mudaram. Salve os anexos de novo e a IA atualiza só o que mudou no prontuário.</p>
            )}
            <PaginaProntuario
              key={prontuario.versao}
              titulo={servidor ? tituloServidor : tituloDaConsulta(at.paciente.id, at.tipo, dia, at.inicio)}
              cabecalho={cabecalhoProntuario(dados, at.modalidade)}
              secoes={prontuario.geradas}
              textos={prontuario.textos}
              mudou={prontuario.mudou}
              primeira={prontuario.versao === 1}
              animar={escrita.prontuario < prontuario.versao}
              onEscrito={() => escreveu('prontuario', prontuario.versao)}
              situacao={situacaoDaEtapa(estado, 'prontuario')}
              podeSalvar={podeOficializar(estado, 'prontuario')}
              onMudar={(k, texto) => {
                setProntuario((x) => x && { ...x, textos: { ...x.textos, [k]: texto } })
                if (estado.blocos.prontuario.estado !== 'revisado_medico') fazer('editar', 'prontuario')
              }}
              onSalvar={salvarProntuario}
            />
          </div>
        ) : etapa !== 'anamnese-exame' && (
          <EtapaSeguinte etapa={etapa} estado={estado} onOficializar={(b) => fazer('oficializar', b)} onIr={(id) => navegar(`${base}/${id}`)} />
        )}
      </main>

      <footer className="py-3 text-center"><Marca className="text-[17px]" /></footer>

      {anexos && <PainelAnexos condutaPronta={docs !== null && situacaoDaEtapa(estado, 'anexos') !== 'bloqueado'} onFechar={fecharAnexos} onAviso={setAviso}
        onAbrir={() => { setAnexos(false); navegar(`${base}/anexos`) }} />}

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {aviso && <p className="bg-tinta px-5 py-3 text-[15px] font-medium text-papel shadow-lg">{aviso}</p>}
      </div>
    </div>
  )
}

/**
 * Consulta real: as alergias da ficha (guardadas na segurança da história do servidor) entram em "Para relembrar"
 * mesmo que o texto da história as escreva de outro jeito ("Alergia a dipirona." sem a reação).
 */
function comAlergiasDaFicha(h: HistoriaServidor | null, secoes: SecaoHistoria[]): SecaoHistoria[] {
  const alergias = (h?.seguranca.alergias ?? []) as { substancia: string; reacao: string }[]
  const secao = secaoDeAlergias(alergias)
  if (!secao) return secoes
  // o "Para relembrar" lê uma seção de antecedentes só: as alergias entram no fim dela (a 1ª frase segue sendo a das comorbidades)
  const i = secoes.findIndex((s) => s.rotulo === secao.rotulo)
  if (i < 0) return [secao, ...secoes]
  const juntar = (t: string) => (t.trim() ? `${t.trim().replace(/([^.])$/, '$1.')}\n${secao.texto}` : secao.texto)
  return secoes.map((s, j) => (j === i ? { ...s, texto: juntar(s.texto) } : s))
}

const TEXTO_ETAPA: Record<Exclude<EtapaId, 'anamnese-exame'>, { bloco: Bloco; antes: EtapaId; bloqueio: string; ia: string }> = {
  historia: { bloco: 'historia', antes: 'anamnese-exame', bloqueio: 'Salve a anamnese e o exame físico para a IA montar a história clínica.', ia: 'A IA monta a história só com a anamnese e o exame físico salvos. Você revisa, edita e salva.' },
  diagnosticos: { bloco: 'diagnosticos', antes: 'historia', bloqueio: 'Salve a história clínica para a IA sugerir os diagnósticos diferenciais.', ia: 'A IA sugere hipóteses só a partir da história salva. Você decide o diagnóstico.' },
  conduta: { bloco: 'conduta', antes: 'diagnosticos', bloqueio: 'Salve os diagnósticos para a IA sugerir conduta e tratamento.', ia: 'A IA sugere a conduta só a partir dos diagnósticos salvos, com a fonte de cada item.' },
  anexos: { bloco: 'anexos', antes: 'conduta', bloqueio: 'Salve a conduta para a IA montar a receita e os anexos.', ia: 'A IA monta a receita e os anexos só com a conduta salva. Ao salvar, a IA escreve o prontuário.' },
  prontuario: { bloco: 'prontuario', antes: 'anexos', bloqueio: 'Salve os anexos para a IA escrever o prontuário.', ia: 'A IA escreve o prontuário (SOAP) só com o que foi colhido. Você edita ou salva; a consulta fica finalizada.' },
}

/** Páginas 2–4: ainda não construídas. Mostram a regra da etapa e permitem simular a oficialização. */
function EtapaSeguinte({ etapa, estado, onOficializar, onIr }: { etapa: Exclude<EtapaId, 'anamnese-exame'>; estado: EstadoConsulta; onOficializar: (b: Bloco) => void; onIr: (id: EtapaId) => void }) {
  const t = TEXTO_ETAPA[etapa]
  const s = situacaoDaEtapa(estado, etapa)
  const rotulo = ETAPAS.find((x) => x.id === etapa)!.rotulo
  const anterior = ETAPAS.find((x) => x.id === t.antes)!
  return (
    <div className="mx-auto mt-[8vh] max-w-[620px]">
      <Cartao titulo={rotulo}>
        {s === 'bloqueado' ? (
          <>
            <p className="text-[16px]">{t.bloqueio}</p>
            <button type="button" onClick={() => onIr(anterior.id)} className="mt-4 bg-petroleo px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
              Ir para {anterior.rotulo}
            </button>
          </>
        ) : (
          <>
            {s === 'desatualizado' && <p className="mb-2 text-[15px] font-semibold">A etapa anterior mudou depois de salva. Revise antes de seguir.</p>}
            <p className="text-[16px]">{t.ia}</p>
            <p className={`${ROTULO} mt-4`}>Esta página é a próxima entrega</p>
            <div className="mt-3 flex items-center gap-3">
              {s === 'oficializado' ? <EtiquetaSituacao s="oficializado" /> : !podeOficializar(estado, t.bloco) ? (
                <>
                  <span className="text-[14px] text-apagado">Salve de novo a etapa anterior.</span>
                  <button type="button" onClick={() => onIr(anterior.id)} className="border-[1.5px] border-tinta px-3 py-1.5 text-[14px] font-semibold hover:bg-tinta hover:text-papel">Ir para {anterior.rotulo}</button>
                </>
              ) : (
                <button type="button" onClick={() => onOficializar(t.bloco)} className="bg-(--esp) px-4 py-2 text-[15px] font-bold text-papel hover:-translate-y-0.5">
                  Salvar (simulação)
                </button>
              )}
            </div>
          </>
        )}
      </Cartao>
    </div>
  )
}

const DOCUMENTOS = ['Receita', 'Orientações', 'Atestado', 'Pedido de exames', 'Encaminhamento', 'Laudo']

function PainelAnexos({ condutaPronta, onFechar, onAviso, onAbrir }: { condutaPronta: boolean; onFechar: () => void; onAviso: (t: string) => void; onAbrir: () => void }) {
  return (
    <Gaveta titulo="Anexos" onFechar={onFechar}>
      <p className="text-[14.5px] text-apagado">
        {condutaPronta ? 'Preenchidos a partir da conduta salva. Revise, assine e envie.' : 'Ficam prontos para revisar depois da conduta salva. Um atestado pode ser feito a qualquer momento.'}
      </p>
      <ul className="mt-3 divide-y divide-linha border-y border-linha bg-branco">
        {DOCUMENTOS.map((d) => {
          const livre = condutaPronta || d === 'Atestado'
          return (
            <li key={d} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[16px] font-semibold">{d}</span>
              {livre ? (
                <button type="button" onClick={() => (condutaPronta ? onAbrir() : onAviso('O atestado avulso chega numa próxima etapa.'))} className="border-[1.5px] border-tinta px-3 py-1 text-[13.5px] font-semibold hover:bg-tinta hover:text-papel">Abrir</button>
              ) : (
                <span className="text-[13px] text-apagado">depois da conduta</span>
              )}
            </li>
          )
        })}
      </ul>
      <BuscaCid />
    </Gaveta>
  )
}
