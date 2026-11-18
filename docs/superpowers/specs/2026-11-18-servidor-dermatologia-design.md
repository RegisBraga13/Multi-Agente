# Servidor real da consulta — Dermatologia (desenho)

> Data: 18/11/2026. Autor do produto: Regis (médico, não programador). Leitor deste documento: o engenheiro que vai planejar e construir.
> Regras que prevalecem sobre este documento: [constituicao.md](../../constituicao.md) e [modelo-de-dados.md](../../modelo-de-dados.md).

## 1. Intenção e porquê

Hoje a consulta da Dermatologia (Módulo A) existe só como tela com IA **simulada**: os textos vêm de exemplos escritos à mão (`frontend/src/consulta/exemplo.ts`, `conduta-exemplo.ts`, `diagnosticos-exemplo.ts`) e o prontuário é gravado no navegador (`localStorage`). O autor quer **ver os motores funcionando de verdade**: IA real, servidor real, banco real, da anamnese ao prontuário gravado, **numa especialidade só (Dermatologia)**. Só depois de passar na Dermatologia o mesmo núcleo recebe as outras especialidades (a próxima é Psiquiatria).

O princípio central do produto, declarado pelo autor: **tudo existe para produzir o prontuário**. As páginas da consulta servem para montar o registro; terminada a consulta, só o registro fica. Por isso o prontuário é gravado como **dados organizados** (não só texto) e é a fonte do acompanhamento longitudinal (retorno).

## 2. Princípios de construção (exigidos pelo autor)

1. **Pronto para escalar no futuro, sem escalar agora.** Um programa só (monólito modular), dividido em módulos bem separados que possam virar serviços depois. Servidor sem estado (todo estado no Postgres), tarefas longas em fila, especialidade como pacote de dados, isolamento por médico (`doctor_id` + RLS, já no banco).
2. **Fácil de outro engenheiro entender.** Módulos pequenos com nomes claros; tipos em tudo; testes que descrevem comportamento; README do backend; decisões importantes registradas (ADR curto em `docs/decisoes/`); lint, checagem de tipos e testes automáticos. Mesma convenção do frontend: **termos do domínio em português** (consulta, prontuário, conduta), termos técnicos padrão em inglês quando forem do ecossistema.
3. **Sem ficar preso a fornecedor.** Código e dados do autor (GitHub dele; banco exportável). **Todo serviço externo atrás de uma interface nossa, trocável**: IA, transcrição, armazenamento de arquivos, banco/login, hospedagem. Prompts e esquemas versionados no repositório. Evitar recurso exclusivo de fornecedor quando houver padrão aberto (ex.: LangGraph sim, LangSmith pago não). Ressalva honesta: o modelo de IA não dá para eliminar; garante-se que trocá-lo seja mexer num adaptador só.

## 3. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Consulta da Dermatologia rodando com IA real, ponta a ponta: anamnese (texto e depois voz) → exame (campos e depois fotos) → história clínica → diagnósticos diferenciais → conduta → receita e anexos → prontuário gravado no Postgres.
- Cada etapa com saída tipada, validada e auditada; o médico revisa e oficializa antes da etapa seguinte (Constituição).
- Um conjunto de **casos de teste** que diga, com números, se cada motor "funciona".

**Não-objetivos (agora)**
- Outras especialidades; integrações (TISS, WhatsApp real); assinatura digital ICP-Brasil real; busca vetorial (pgvector) e Neo4j; microserviços, Kubernetes; aplicativo móvel.
- Uso com pacientes reais (ver §11, portões antes do uso real).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- A IA transformar sugestão em diagnóstico confirmado ou em prescrição sem o médico.
- Tratamento inventado pelo modelo quando existe protocolo (a conduta vem da tabela).
- Sinal de alerta perdido porque dependia só da IA.
- Texto livre como único contrato de uma etapa.
- Dado de paciente enviado à IA com identidade (nome, CPF, telefone) sem necessidade.
- Código ou dados que não possam sair de um fornecedor.

## 4. Restrições

- **Stack fixada pelo autor (não negociável):** React/TS/Tailwind (já existe) · Python FastAPI · LangGraph · Supabase/PostgreSQL · pgvector + busca híbrida (adiado, §6) · Neo4j só com ganho medido (fora) · Deepgram/Whisper · modelos Claude.
- Supabase existente: projeto "Multi-Agente", região São Paulo (sa-east-1), plano gratuito; migrations 0001–0006 aplicadas (só Fase 1: médicos, especialidades, assinaturas, auditoria). Credenciais em `.env.supabase` (fora do git).
- **Faltam chaves**: Anthropic (Claude) e Deepgram. Só o autor pode criá-las (conta e pagamento); o engenheiro guia passo a passo. Sem chave, os motores rodam com um provedor falso (ver §7.4) para os testes de código.
- Constituição: fases encadeadas; só o **oficializado** alimenta a fase seguinte; estados `rascunho_ia` → `revisado_medico` → `oficializado`; toda edição do médico auditável.
- **Guarda dos dados (decisão do autor):** o app **não** guarda por 20 anos. Na nuvem, os registros ficam só enquanto servem às próximas consultas (prazo a definir). A guarda legal é do médico, que recebe um **espelho** do prontuário (PDF + arquivo de dados).
- Autor não técnico: tudo que for painel/configuração (Supabase, chaves) o engenheiro faz por API/linha de comando ou guia passo a passo.

## 5. Abordagens consideradas

| Abordagem | Como | Troca | Decisão |
|---|---|---|---|
| **A. LangGraph dono da consulta inteira** | Um grafo com todas as etapas e "interrupções" para o médico; estado no checkpointer do LangGraph | Usa o recurso de pausa humana do LangGraph; mas o estado clínico oficial fica num formato do LangGraph, mistura com o banco e prende a consulta à biblioteca | Recusada |
| **B. Banco é o dono; um motor por etapa** (escolhida) | A consulta é uma sequência de blocos no Postgres com estado (`rascunho_ia`/`revisado_medico`/`oficializado`). Cada página chama o motor da sua etapa com o oficializado da anterior. LangGraph só **dentro** dos motores que têm vários passos (DD, Evolução) | Estado oficial num lugar só, auditável e exportável; LangGraph trocável; simples de ler. Custa escrever a orquestração simples à mão | **Escolhida** |
| **C. Sem servidor Python (funções do Supabase em TS)** | Toda a IA em Edge Functions | Uma linguagem só; mas contraria a stack fixada e prende ao Supabase | Recusada |

Modelos de IA, abordagem escolhida: **começar com Claude Opus 5.5 em todos os motores**, regulando o esforço (`output_config.effort`) por motor, e só descer para Sonnet 5.5/Haiku 5.5 onde os casos de teste mostrarem qualidade igual. Recusado: dividir em três modelos desde o início sem medir. Recusado: Haiku para sinais de alerta (ver §7.3).

## 6. Decisões já tomadas com o autor

- **Prontuário = dados organizados** (fonte da verdade longitudinal); texto montado a partir deles. Formato atual em `frontend/src/prontuario/registro.ts` (`DadosEntrada`, `EntradaProntuario`) e `frontend/src/consulta/prontuario.ts` (`dadosDaConsulta`, `secoesDosDados`, `aplicarEdicoes`). O servidor adota esse formato (Pydantic) com `schema_version`.
- **Diagnósticos no prontuário: sempre 3** — os assinalados pelo médico ("Assinalado"; com mais de 3, os de maior probabilidade) + os mais bem posicionados pela IA para completar ("Sugerido"); descartado não entra.
- **Entrada salva nunca muda**; depois do fim, só **adendo** datado. Retorno grava entrada nova; a da consulta não é tocada.
- **Conduta = tabela de protocolos estruturada, lida por chave** (diagnóstico codificado + qualificadores → conduta pronta com fonte/versão), sem IA. Ordem: 1) tabela; 2) RAG em diretrizes só sem chave exata ou para complementar (adiado — entra quando os testes mostrarem lacuna); 3) fontes externas. Origem visível ao médico. A tabela de hoje é `conduta-exemplo.ts` (acne): grupos, opções, itens de receita estruturados (DCB, forma por sigla oficial, concentração, quantidade, via, posologia, duração), regras pelo "Para relembrar".
- **Identificador próprio do paciente** (gerado pelo sistema, nunca muda). CPF, se houver, é dado de cadastro, não chave.
- **Atestado** (período de afastamento) e **laudo** (finalidade) vão ao prontuário só como resumo de uma linha.
- **Retorno** (desenho detalhado depois): Evolução → História da evolução (com gráfico comparativo, laudos, fotos comparadas) → diagnósticos/conduta/receita e anexos (podem mudar) → prontuário atualizado (retorno em cima). Mesmo mecanismo para todas as especialidades.
- **Transcrição: Deepgram** (separa as vozes Médico/Paciente e funciona em tempo real; o Whisper não separa vozes sozinho). Áudio apagado depois de transcrito. Testar vocabulário médico PT-BR.

## 7. O como decidido

### 7.1 Estrutura do backend

```
backend/
  app/
    api/            rotas FastAPI finas (validam entrada, chamam serviços, devolvem esquemas)
    consulta/       blocos da consulta, estados, oficialização, gating da Constituição
    prontuario/     entradas, adendos, espelho (PDF + JSON), retenção
    motores/        um módulo por etapa: historia, diagnosticos, conduta, prontuario, sinais (+ transcricao, fotos depois)
    especialidades/ pacotes de dados por especialidade (dermatologia/: tabela de condutas, sinais de alerta, campos do exame, prompts)
    provedores/     interfaces + adaptadores: ia (anthropic, falso), transcricao (deepgram, falso), arquivos, relogio
    contratos/      modelos Pydantic compartilhados (fonte única dos formatos)
    auditoria/      registro de decisões da IA e edições do médico
  casos_de_teste/   consultas fictícias + respostas esperadas + script que mede os motores
  tests/
  Dockerfile
```

Contratos: **Pydantic é a fonte única**; a API publica OpenAPI e os tipos TypeScript do frontend são **gerados** a partir dela (ex.: `openapi-typescript`), substituindo os tipos escritos à mão aos poucos.

### 7.2 Contrato de cada motor (JEV turbo, CLAUDE.md do autor)

- Entrada: **só o oficializado** da etapa anterior + dados de segurança da história (Constituição).
- Saída: objeto tipado com resultado, `confianca` (0–1, sinal operacional), `evidencias` (trecho/origem), `avisos`, `origem` ("protocolo X v.Y" | "sugestão da IA").
- Política: pela Constituição, **toda proposta vai a `HUMAN_REVIEW`**; saída estruturalmente inválida → `REJECT` antes de qualquer outra avaliação (o médico vê "a IA não conseguiu; escreva/tente de novo"). Nunca `AUTO_EXECUTE` de efeito clínico.
- Campo ausente não é inventado: `PRESENT` / `INFERRED` (com evidência e aviso) / `MISSING` (= `null`), como já fazem os exames complementares no frontend.
- Toda chamada registra: `decisionId`, motor, modelo, versão do modelo, versão do esquema, versão do prompt, confiança, ação, custo em tokens, horário. **Sem** prompt completo nem dado pessoal.

### 7.3 Motores

| Motor | Fonte | IA? |
|---|---|---|
| História clínica | anamnese + exame oficializados + ficha (idade, estado civil, profissão — formato "Paciente, 52 anos, casado, comerciante") | Sim (estruturação; IA atualiza só a seção cuja fonte mudou) |
| Diagnósticos diferenciais | história oficializada + dados de segurança | Sim (hipóteses com %, evidências a favor/contra com trecho da história, "não pode perder") |
| Conduta | DD oficializados + dados de segurança | **Tabela primeiro** (lookup); IA só para lacunas, marcada como "sugestão da IA" |
| Receita e anexos | conduta oficializada | Montagem determinística (já existe em `anexos.ts`); IA não prescreve |
| Prontuário | todos os blocos oficializados | Determinístico (`dadosDaConsulta`), IA só se precisar organizar texto |
| Sinais de alerta | **lista fixa por especialidade** + IA sugere extras marcados | Nunca só IA |

### 7.4 Provedores (sem lock-in)

- `ProvedorIA`: interface nossa (gerar saída estruturada a partir de instruções + dados, com esquema). Adaptador **Anthropic** (SDK oficial `anthropic`, Python): `claude-opus-5-5`, saída estruturada (`output_config.format` / `messages.parse`), cache das partes fixas do pacote da especialidade, `fallbacks` de recusa no servidor (beta `server-side-fallback-2026-07-01`), streaming para a escrita ao vivo. Adaptador **falso** determinístico para testes de código sem chave.
- `ProvedorTranscricao`: Deepgram (adaptador) + falso; Whisper como alternativa aberta.
- `Arquivos`: armazenamento compatível com S3 (Supabase Storage hoje).
- Banco: Postgres padrão via SQL/migrations versionadas em `supabase/migrations/` (sem depender de recurso exclusivo além de Auth/RLS, que são Postgres).
- Hospedagem: contêiner Docker (roda local agora; qualquer nuvem depois).
- Claude Fable: só desenvolvimento, nunca dado de paciente.

### 7.5 Privacidade antes da IA

O que vai ao modelo é **desidentificado**: sem nome, CPF, telefone, e-mail, endereço; paciente = "Paciente, 34 anos". O servidor recoloca o nome só nos documentos ao paciente (receita, atestado).

### 7.6 Banco (Fase 3 do modelo de dados)

Criar as tabelas da Fase 3/4 seguindo os nomes de [modelo-de-dados.md](../../modelo-de-dados.md) (`patients`, `encounters`, `transcripts`, `attachments`, `clinical_facts`, `clinical_histories`, `ai_proposals`, `addenda`, `diagnostic_hypotheses`, `care_plans`, `documents`…), todas com `doctor_id` e RLS. A entrada do prontuário guarda `DadosEntrada` em JSONB com `schema_version`. `audit_log` só cresce. Retenção: rotina que apaga registros vencidos depois de gerar/entregar o espelho (prazo é parâmetro, a definir com o autor).

### 7.7 Escrita ao vivo

O frontend hoje simula a escrita (3 letras a cada 33 ms). Com o servidor, a resposta chega em streaming (SSE) e a tela mostra enquanto a IA escreve, sem mudar o visual.

### 7.8 Casos de teste (o item mais importante)

20 a 30 consultas fictícias de Dermatologia (acne, psoríase, rosácea, dermatite, melanoma suspeito, carcinoma basocelular, micose, urticária, verrugas, alopecia…), com a resposta esperada por etapa, **revisadas pelo autor**. Um script roda todos os motores sobre eles e mede: campos corretos, diagnóstico esperado entre os 3, sinais de alerta pegos (meta: nenhum perdido), conduta vinda da tabela, saídas inválidas, custo e tempo por consulta. Toda mudança de prompt/modelo roda contra eles antes de entrar.

## 8. Ordem de entrega (marcos)

1. **Casos de teste** (formato + primeiros casos; autor revisa).
2. **Esqueleto do servidor**: FastAPI, contratos, provedores (falsos), Docker, README, checagens automáticas; migrations da Fase 3; paciente com id próprio.
3. **Motores de texto** com IA real: história → DD → conduta (tabela) → anexos → prontuário gravado no Postgres; frontend troca a simulação pelas chamadas (uma etapa por vez, como sempre, com aprovação do autor).
4. **Voz** (Deepgram, em tempo real, separando vozes).
5. **Fotos** (análise com visão, marcação de lesões).
6. **Evolução / retorno** (desenho detalhado próprio antes de construir).

Cada marco: testes passando, casos de teste medidos, commit e push, aprovação do autor.

## 9. O que fica para o engenheiro decidir

- Biblioteca de migrations/ORM (SQL puro, SQLAlchemy, etc.), desde que as migrations fiquem em `supabase/migrations/`.
- Fila de tarefas longas (começar simples; interface trocável).
- Gerador de tipos TS a partir do OpenAPI.
- Formato do arquivo da tabela de condutas (JSON/YAML validado por esquema), desde que seja fonte única e o frontend pare de manter cópia.
- Nomes finos de rotas e módulos, dentro da convenção (domínio em português).
- Esforço (`effort`) inicial de cada motor, ajustado pelos casos de teste.

## 10. Suposições minhas (o autor ainda não confirmou)

- **O primeiro uso é só o autor, no computador dele, com pacientes fictícios.** Por isso login real, hospedagem e LGPD de paciente real ficam para os portões do §11. (Perguntei; o autor não respondeu ainda.)
- Descartado pelo médico não entra como "Sugerido" nos 3 diagnósticos.

## 11. Portões antes do uso com paciente real (não bloqueiam o teste fictício)

- Supabase em plano pago (cópia de segurança) e login real dos médicos.
- Transferência internacional de dados (a IA processa fora do Brasil): contrato e retenção mínima com o fornecedor de IA; consentimento/base legal (LGPD).
- Enquadramento na Anvisa (software de apoio à decisão clínica).
- Regras do CFM: prontuário eletrônico, assinatura digital ICP-Brasil, telemedicina.
- Prazo de retenção na nuvem definido e espelho do prontuário entregue ao médico.

## 12. Decisões de 18/11/2026 após a revisão dos casos de teste

Ver [ADR 0002](../../decisoes/0002-avaliacao-por-criterios-clinicos.md). Em resumo: (a) casos no formato v2,
avaliados por **critérios clínicos** (IA avaliadora com saída tipada + regras fixas no que é estruturado),
nunca por palavra literal; (b) sinais de alerta com **tipo, ação e prazo**; a ação dos sinais de **urgência
imediata** entra na conduta **por regra fixa** do pacote, sem IA e mesmo sem protocolo (complementa §7.3);
(c) **negado ≠ não perguntado ≠ não examinado**; (d) diagnóstico com **certeza** (câncer sem histopatologia =
suspeita); (e) **HF** só recebe doença familiar com predisposição — contato com a mesma doença vai na HDA.

## 13. Divisão do marco 3 (18/11/2026)

O marco 3 foi dividido em três entregas: **3A** motores de texto com IA real + medição nos casos de teste
(feito — [ADR 0004](../../decisoes/0004-motores-tabela-primeiro-e-medico-simulado.md)); **3B** rotas da
consulta, blocos/estados/oficialização no Postgres, SSE, anexos e prontuário gravado; **3C** o frontend troca
a simulação pelas chamadas, uma página por vez, com aprovação do autor.
