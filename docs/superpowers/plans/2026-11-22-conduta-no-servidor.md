# Conduta e tratamento no servidor (parte D) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa consulta real (pedido, primeira consulta), a página da Conduta usa o servidor: a conduta vem da tabela de protocolos (hoje só a acne) ou, sem protocolo, da IA no mesmo formato objetivo; sinais de urgência mostram a ação de emergência fixa; o médico escolhe e edita como hoje; salvar grava e oficializa no servidor. Anexos e prontuário seguem simulados.

**Architecture:** o servidor já gera, guarda e oficializa o bloco da conduta (`POST /consultas/{id}/conduta/gerar`, `PUT /conduta`, oficializar), com urgência por regra fixa, protocolo por CID e IA só quando não há protocolo. A tabela da acne é "porte fiel" do modelo da tela, então a tela só precisa traduzir a proposta do servidor para o seu próprio modelo de conduta (`Grupo`/`Linha`/`Opcao`) e reaproveitar toda a lógica de escolha, texto e atualização de `conduta.ts`. Entra uma faixa vermelha de urgência na página, porque a tela ainda não mostra a ação de emergência.

**Tech Stack:** FastAPI + pytest; React + TypeScript + vitest.

**Spec:** [ADR 0004](../../decisoes/0004-motores-tabela-primeiro-e-medico-simulado.md), [ADR 0005](../../decisoes/0005-consulta-no-servidor.md), as partes [A](2026-11-21-perguntas-contextuais-servidor.md), [B](2026-11-21-perguntas-contextuais-tela.md), [C](2026-11-22-diagnosticos-no-servidor.md); regras do autor em `docs/regras-do-autor.md`.

## Decisões do autor (22/11/2026)

- **Mostrar por que uma opção não aparece** (retirada por contraindicação, ex.: gestação): entra neste plano (Task 3 e Task 4).
- **Edição dos itens da receita fica nos Anexos** (como hoje); a Conduta continua sendo a fonte de exames, encaminhamento, orientações e retorno no prontuário. Nenhuma tarefa nova de edição na Conduta.

## Global Constraints

- **Nenhuma mudança visual** na página da Conduta, exceto a faixa vermelha de urgência (nova, só quando há urgência).
- **A IA não escreve orientação nem alerta em texto livre** na conduta, em nenhum módulo (regra do autor, 18/11/2026): só opções objetivas. Com protocolo, a IA nem é chamada.
- **A origem** ("protocolo acne v1", "sugestão da IA") aparece só na tela, nunca no prontuário.
- **Nada vem marcado** pela IA, exceto o kit de exames de rotina (desmarcável). Nada marcado em sistêmico = sem tratamento sistêmico; em encaminhamento = sem encaminhamento.
- **Urgência e ação de emergência são regra fixa**, nunca dependem da IA, e aparecem mesmo sem protocolo.
- Opção contraindicada pelos sinais respondidos **não aparece** (o servidor já a retira).
- O que o médico escolheu, revelou e escreveu fica quando a conduta é refeita para o mesmo diagnóstico (`atualizarConduta`).
- Só pedido real de primeira consulta usa o servidor; exemplos e retorno seguem simulados.
- Erros para o médico: linguagem simples. Falha da IA: avisar e abrir as 4 seções em branco para ele escrever.

## Review Focus

- Sinal de urgência respondido Sim (ex.: inchaço de lábios): a faixa vermelha aparece com a ação de emergência do catálogo e o prazo, mesmo quando o diagnóstico não tem protocolo.
- Diagnóstico escrito pelo médico, sem CID: a conduta é pedida (IA, sem protocolo) e não dá erro.
- A IA falha ou devolve vazio na conduta: as 4 seções abrem em branco, o aviso aparece, e o médico escreve e salva.
- Linha de múltipla escolha vinda do servidor (`multipla: true`): aceita mais de uma opção marcada; as demais aceitam uma só.
- Opção com itens de receita marcada: os itens vão para `receita` do bloco salvo; texto do "Outro" vai para `livres`.
- Salvar sem nenhum texto escrito: continua bloqueado na tela ("Escreva a conduta"), e se o servidor recusar (409) a tela mostra a mensagem dele.
- Diagnósticos salvos de novo com o mesmo diagnóstico principal: escolhas e textos do médico ficam; com outro principal: conduta nova.
- Recarregar a página da Conduta: as escolhas e os textos salvos voltam como rascunho.

---

## File Structure

- `backend/app/provedores/ia_demonstracao.py` (modificar): conduta de demonstração com grupos reais.
- `frontend/src/servidor/consulta.ts` (modificar): tipos da conduta, `gerarEtapa` com `'conduta'`, `salvarConduta`, `oficializarEtapa` com `'conduta'`.
- `frontend/src/consulta/conduta.ts` (modificar): `Linha.multipla` e `escolherOpcao` a respeitar.
- `frontend/src/consulta/conduta-servidor.ts` (criar): tradução servidor ⇄ tela e urgência.
- `frontend/src/consulta/conduta-pagina.tsx` (modificar): a faixa de urgência (prop opcional).
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): gera, retoma e salva a conduta pelo servidor.

---

### Task 1: Demonstração da conduta e diagnóstico do médico sem CID

**Files:**
- Modify: `backend/app/provedores/ia_demonstracao.py`
- Test: `backend/tests/test_api_ponta_a_ponta.py`, `backend/tests/test_geracao_consulta.py`

**Interfaces:**
- Produces: com `IA_PROVEDOR=demonstracao`, `conduta/gerar` (diagnóstico sem protocolo) devolve `proposta.ia.grupos` com: `topico` (2 opções, a primeira com 1 item de receita estruturado), `sistemico` (1 opção com 1 item oral), `cuidados` (1 opção), `orientacoes` (1 opção); `proposta.urgencia == "rotina"` e `emergencia == []`.

- [ ] **Step 1: Write the failing tests:** (ponta a ponta) `test_demonstracao_propoe_conduta_com_grupos` (até o DD confirmado com `decisao="confirmada"` no primeiro item; `conduta/gerar` → `conteudo.proposta.ia.grupos` com os 4 ids e a opção com receita); (geração) `test_diagnostico_do_medico_sem_cid_pede_a_conduta_sem_protocolo` (confirmada só a `propria` com `cid=""`, `pct=None`; `gerar(..., "conduta")` devolve `HUMAN_REVIEW`, `proposta.tabela is None`, sem exceção).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_api_ponta_a_ponta.py tests/test_geracao_consulta.py -q -k "conduta"` — Expected: FAIL (grupos vazios).
- [ ] **Step 3: Implement** o ramo `conduta` da demonstração (itens de receita válidos no formato do contrato) e ajustar a fábrica de teste se preciso; o segundo teste deve passar sem mudar o código do servidor (se falhar, corrigir a causa).
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q`, `ruff`, `mypy app` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: a demonstração propõe conduta com grupos; diagnóstico do médico sem CID"`

### Task 2: Cliente do servidor para a conduta

**Files:**
- Modify: `frontend/src/servidor/consulta.ts`
- Test: `frontend/src/servidor/consulta.test.ts`

**Interfaces:**
- Produces: `urlDaGeracao` e `gerarEtapa` aceitam `'conduta'`; tipos `ItemReceitaServidor = { nome: string; forma: string; concentracao: string; quantidade: { n: number; unidade: string; feminino: boolean }; via: 'topico' | 'oral'; posologia: string; duracao: string; controlado?: boolean | null }`, `OpcaoServidor = { id: string; rotulo: string; texto: string; dias: number | null; receita: ItemReceitaServidor[] }`, `LinhaServidor = { id: string; rotulo: string | null; opcoes: OpcaoServidor[]; prefixo: string | null; multipla: boolean }`, `GrupoServidor = { id: 'cuidados' | 'topico' | 'sistemico' | 'orientacoes'; rotulo: string; linhas: LinhaServidor[]; fixo: string | null }`, `OpcaoIAServidor = { rotulo: string; texto: string; receita: ItemReceitaServidor[] }`, `PropostaCondutaServidor = { urgencia: 'rotina' | 'prioritaria' | 'imediata'; emergencia: string[]; tabela: { chave: string; origem: string; grupos: GrupoServidor[]; bloqueadas: { opcao: string; rotulo: string; motivo: string }[]; motivosOrdem: Record<string, string> } | null; ia: { grupos: { id: GrupoServidor['id']; opcoes: OpcaoIAServidor[] }[] } | null; origem: string; avisos: string[]; acao: string; iaFalhou: boolean }`, `CondutaServidor = { proposta: PropostaCondutaServidor; diagnostico: { nome: string; cid: string; certeza: string }; escolha: Record<string, string[]>; textos: string[]; receita: ItemReceitaServidor[]; livres: string[] }`; `gerarConduta(id: string)`; `salvarConduta(id: string, bloco: CondutaServidor): Promise<ConsultaServidor>`; `oficializarEtapa` aceita `'conduta'`.

- [ ] **Step 1: Write the failing test:** em `consulta.test.ts`, `urlDaGeracao('abc', 'conduta')` devolve `/api/consultas/abc/conduta/gerar`.
- [ ] **Step 2: Run** `npm test -- src/servidor/consulta.test.ts` em `frontend` — Expected: FAIL (tipo e função não aceitam `'conduta'`; o teste falha na compilação ou no valor).
- [ ] **Step 3: Implement** os tipos e as funções.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/servidor` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor para a conduta"`

### Task 3: Tradução da conduta (funções puras) e linha de múltipla escolha

**Files:**
- Create: `frontend/src/consulta/conduta-servidor.ts`
- Modify: `frontend/src/consulta/conduta.ts` (`Linha.multipla?: boolean`; `escolherOpcao` usa `linha.multipla ?? ehMultipla(linha.id)`)
- Test: `frontend/src/consulta/conduta-servidor.test.ts`, `frontend/src/consulta/conduta.test.ts`

**Interfaces:**
- Consumes: Task 2; `sugerir`, `textoDoGrupo`, `montarConduta`-parte de `conduta.ts`; `montarReceita`/itens da receita de `anexos.ts` (usar a função existente que lista os itens e os livres das opções marcadas; se for privada, exportá-la com o nome `itensDaReceita(c: Conduta): { itens: ItemReceita[]; livres: string[] }`).
- Produces: `condutaDoServidor(b: CondutaServidor, diagnostico: { id: string; nome: string; cid: string }, dia: string, nomeDoSinal: (id: string) => string): Conduta` (usa `b.proposta.tabela.grupos` se houver; senão converte `ia.grupos` em um `Grupo` por id com uma linha só — id da linha = id do grupo, `rotulo: null`, opções com id `<grupo>-<n>`; sem tabela e sem IA: `grupos: null` e as 4 seções abertas para escrever; passa por `sugerir({ grupos, regras: [] }, [])` para pôr o kit e o "Outro"; `motivo` = `motivosOrdem` com o id do sinal trocado por `nomeDoSinal`); `condutaParaServidor(c: Conduta, base: CondutaServidor): CondutaServidor` (`escolha` e `textos` (4) da tela, `receita` e `livres` de `itensDaReceita`, `proposta` e `diagnostico` de `base`); `urgenciaDaConduta(p: PropostaCondutaServidor): { nivel: 'prioritaria' | 'imediata'; acoes: string[] } | null` (`null` em rotina); `bloqueadasDaConduta(p: PropostaCondutaServidor): { rotulo: string; motivo: string }[]` (as de `tabela.bloqueadas`; vazio sem tabela).

- [ ] **Step 1: Write the failing tests:** `condutaDoServidor` com tabela: mesmos grupos, linha `multipla` preservada, kit marcado em `escolha`, `motivo` com o texto do sinal; com `ia.grupos`: um `Grupo` por id, ids de opção estáveis (`topico-0`), kit e "Outro" presentes; sem tabela e sem IA: `grupos === null` e `revelado` todo `true`; `condutaParaServidor` leva `escolha`, os 4 textos, a receita das opções marcadas e o "Outro" em `livres`, e mantém `proposta` e `diagnostico` da base; ida e volta de `textos`; `urgenciaDaConduta` devolve `null` em rotina e `{nivel:'imediata', acoes}` com a emergência; `bloqueadasDaConduta` devolve rótulo e motivo de cada opção retirada e `[]` sem tabela; (conduta.test) `escolherOpcao` numa linha com `multipla: true` aceita duas opções e numa linha sem a marca troca.
- [ ] **Step 2: Run** `npm test -- src/consulta/conduta-servidor.test.ts src/consulta/conduta.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as funções puras (sem rede e sem React) e a mudança em `escolherOpcao`.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/consulta` — Expected: passam (os testes antigos de conduta continuam verdes).
- [ ] **Step 5: Commit** `"Tela: tradução da conduta do servidor"`

### Task 4: Faixa de urgência e opções retiradas na página da Conduta

**Files:**
- Modify: `frontend/src/consulta/conduta-pagina.tsx`
- Test: `frontend/src/consulta/conduta-servidor.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `urgenciaDaConduta`. Produces: prop opcional `urgencia?: { nivel: 'prioritaria' | 'imediata'; acoes: string[] } | null` em `PaginaConduta`; quando houver, uma faixa vermelha cheia (mesmos tokens da tarja de alergia e da faixa da História) no alto do cartão: `Urgência imediata: ` (ou `Prioridade: `) seguida das ações em uma linha (`truncate`, com todas no `title`). Prop opcional `retiradas?: { rotulo: string; motivo: string }[]`: no painel de opções de um grupo, uma linha pequena e apagada por opção retirada daquele grupo: `Não sugerido: <rótulo> — <motivo>.`

- [ ] **Step 1: Write the failing test:** `textoDaFaixa(u: { nivel: 'prioritaria' | 'imediata'; acoes: string[] }): string` (função pura em `conduta-servidor.ts`) e `textoDaRetirada(r: { rotulo: string; motivo: string }): string` (`"Não sugerido: Isotretinoína — gestação ou tentativa de gravidez."`, sem ponto duplicado): imediata → `"Urgência imediata: Suspender o medicamento. Encaminhar ao hospital."`; prioritária → começa com `"Prioridade: "`; junta as ações com ". " e termina em ponto.
- [ ] **Step 2: Run** esse teste — Expected: FAIL.
- [ ] **Step 3: Implement** `textoDaFaixa` e a faixa na página (sem mudar nada quando `urgencia` não vem).
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/consulta` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: faixa de urgência na Conduta"`

### Task 5: A página da Conduta pelo servidor

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx`

**Interfaces:**
- Consumes: Tasks 1–4. Regra: só quando `servidor` existe.
- Produces: ao salvar os diagnósticos numa consulta real (depois de o servidor oficializar), a tela chama `gerarConduta(servidor.id)`; mostra "A IA está pensando na conduta…" no estilo dos outros; com o resultado, `condutaDoServidor(...)`; primeira vez: conduta nova; depois: `atualizarConduta(antes, nova)`. O diagnóstico principal é o **primeiro confirmado**, o mesmo que o servidor usa (a tela não escolhe outro). Falha ou vazio: aviso "A IA não conseguiu; escreva a conduta" e a página abre com as 4 seções em branco. A faixa de urgência usa `urgenciaDaConduta`. Salvar a conduta envia `salvarConduta(id, condutaParaServidor(c, base))` e `oficializarEtapa(id, 'conduta')` antes de seguir para os anexos simulados; falha mostra a mensagem do servidor e não marca como salvo. Recarregar: o bloco guardado volta como rascunho (escolhas e textos; o texto do "Outro" volta dentro do texto do grupo).

- [ ] **Step 1: Write the failing test:** a lógica nova está nas Tasks 3 e 4; não há teste de componente. Em `conduta-servidor.test.ts`, `test_regerar_para_o_mesmo_diagnostico_mantem_as_escolhas_e_os_textos`: `atualizarConduta(antes, condutaDoServidor(novo, mesmoDiagnostico, ...))` com `escolha`/`textos` do médico em `antes` mantém ambos; com `diagnostico.id` diferente devolve a conduta nova.
- [ ] **Step 2: Run** esse teste — Expected: PASS ou FAIL conforme o `id` do diagnóstico usado (deve usar `idDaHipotese` da parte C); ajustar a chamada até provar que o `id` estável sustenta a regra existente.
- [ ] **Step 3: Implement** a ligação em `pagina-consulta.tsx` sem mudar o JSX existente além do parágrafo de "carregando" e da prop `urgencia`.
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src`, e `.venv/Scripts/python -m pytest -q` passam. Conferir na tela: Docker com `IA_PROVEDOR=demonstracao` e `npx vite --port 5191`; criar um pedido pela API com nome comum (ex.: "Joaquim Ferraz Lobo"), abrir a consulta, salvar anamnese e exame, responder **Sim** à pergunta de inchaço de lábios, salvar a história, confirmar um diagnóstico, salvar; na Conduta ver a faixa vermelha de urgência, os 4 grupos, abrir um grupo, escolher uma opção, salvar; conferir no banco (`select content->'escolha', content->'textos' from care_plans`) que escolhas, textos e receita estão lá. Repetir sem responder Sim: sem faixa. Tirar print da Conduta em 1280×690, **medir que cabe** e mostrar ao autor. **Apagar os dados de teste do banco local** ao terminar (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: a Conduta da consulta real vem do servidor"`

---

## Fora deste plano (decidido)

- **"Para relembrar"** (V/F na página dos Diagnósticos) segue simulado: não alimenta a conduta do servidor, que usa as respostas das perguntas e os sinais disparados.
- **Anexos e prontuário no servidor:** próximas partes, uma por vez.
- **Mais protocolos** além da acne: depende do conteúdo clínico do autor; sem protocolo a IA propõe as opções.
- Retorno e atendimentos de exemplo continuam simulados.
