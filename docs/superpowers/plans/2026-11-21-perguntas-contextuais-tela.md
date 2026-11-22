# Perguntas contextuais depois da história — Plano da tela (parte B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa consulta real (pedido da agenda, primeira consulta), a história clínica é montada pelo servidor, e no fim da página da História aparecem as perguntas contextuais (Sim ou Não), com o botão "Ver mais perguntas" e o aviso vermelho de urgência. Tudo salva junto com a história.

**Architecture:** o cliente do servidor ganha gerar história (leitura do fluxo de eventos), salvar e oficializar a história e gerar perguntas. Funções puras traduzem entre a história do servidor (7 campos) e as seções da tela (rótulos que o resto da tela já usa). A tela da História ganha uma seção de perguntas e um aviso de urgência, sem mudar o visual do que já existe. Diagnósticos, conduta, anexos e prontuário seguem simulados na tela nesta etapa (o DD no servidor é a parte C).

**Tech Stack:** React + TypeScript, vitest; FastAPI (uma tarefa pequena de servidor), pytest.

**Spec:** [plano da parte A](2026-11-21-perguntas-contextuais-servidor.md) e a conversa de 21/11/2026; regras do autor em `docs/regras-do-autor.md` (uma tela sem vazar ≈ 690 px; só tokens de cor; nada do que a IA escreve como origem no prontuário).

## Global Constraints

- **Nenhuma mudança visual** no que já existe. A seção nova segue o estilo dos cartões da História (fundo, bordas, rótulos pequenos em maiúsculas), só com tokens de cor existentes.
- A página da História **cabe em ~690 px**; as perguntas ficam num bloco que **rola dentro do cartão** só se passar de 5 perguntas (exceção justificada: número livre de perguntas). Medir antes de entregar.
- **Sem mínimo e sem máximo** de perguntas; pergunta sem resposta fica sem resposta (não vira "Não").
- A história **não é reescrita** ao responder.
- A origem ("sugestão da IA") aparece só na tela, nunca no prontuário.
- Só atendimentos de **pedido real, primeira consulta** usam o servidor; exemplos e retorno seguem simulados.
- Rótulos das seções iguais aos que o resto da tela já lê: "Queixa principal", "História da doença atual", "Antecedentes e alertas", "História pessoal", "História familiar", "Exame físico", "Exames complementares".
- Linguagem de erro para o médico: simples, sem jargão.

## Review Focus

- O servidor ou a IA falha ao montar a história: a tela avisa ("A IA não conseguiu; escreva ou tente de novo") e **deixa o médico escrever as seções à mão**; nunca fica travada em "montando…".
- A IA falha nas perguntas: a história segue normal, sem a seção de perguntas e sem travar o Salvar.
- Sinal de urgência na segurança da história (já detectado nas falas): o aviso vermelho aparece com a ação do catálogo, antes das perguntas.
- Recarregar a página depois de responder: as respostas já salvas voltam (a história volta como rascunho, igual à página 1).
- O médico muda a anamnese e salva de novo depois de já ter respondido: as perguntas novas vêm, e as respostas de perguntas com o mesmo texto são mantidas.
- Pergunta do catálogo adicionada em "Ver mais perguntas" duas vezes: entra uma vez só.
- Salvar a história com perguntas sem resposta: salva normalmente; elas não entram no prontuário.

---

## File Structure

- `backend/app/provedores/ia_demonstracao.py` (modificar): resposta fixa e válida para o motor `perguntas`.
- `frontend/src/servidor/consulta.ts` (modificar): `gerarHistoria`, `salvarHistoria`, `gerarPerguntas`, leitura do fluxo de eventos.
- `frontend/src/consulta/historia-servidor.ts` (criar): funções puras de tradução e de regra das perguntas.
- `frontend/src/consulta/perguntas-historia.tsx` (criar): o bloco de perguntas e o aviso de urgência.
- `frontend/src/consulta/historia-pagina.tsx` (modificar): recebe e mostra o bloco novo no fim do cartão.
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): monta, retoma e salva a história pelo servidor.

---

### Task 1: Demonstração do servidor responde às perguntas

**Files:**
- Modify: `backend/app/provedores/ia_demonstracao.py`
- Test: `backend/tests/test_api_ponta_a_ponta.py`

**Interfaces:**
- Produces: com `IA_PROVEDOR=demonstracao`, `POST /consultas/{id}/perguntas/gerar` devolve 3 perguntas: uma livre, uma ligada ao sinal `lesao-sangra-facil`, uma ligada a `angioedema` (para a tela mostrar um caso de cada).

- [ ] **Step 1: Write the failing test** em `test_api_ponta_a_ponta.py`: `test_demonstracao_propoe_tres_perguntas_validas` (consulta até a história com `ProvedorDemonstracao`; `POST .../perguntas/gerar` → 200; 3 perguntas; `sinalId` de duas delas é `lesao-sangra-facil` e `angioedema`; `avisos == []`).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_api_ponta_a_ponta.py -q -k perguntas` — Expected: FAIL (lista vazia com aviso).
- [ ] **Step 3: Implement** o ramo `pedido.motor == "perguntas"` com as 3 perguntas (frases de Sim e Não no estilo de prontuário).
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q` — Expected: passa.
- [ ] **Step 5: Commit** `"Servidor: a demonstração responde às perguntas contextuais"`

### Task 2: Cliente do servidor para a história e as perguntas

**Files:**
- Modify: `frontend/src/servidor/consulta.ts`
- Test: `frontend/src/servidor/consulta.test.ts` (criar)

**Interfaces:**
- Produces: `lerEventos(texto: string): { evento: string; dados: unknown }[]` (puro; lê o texto `event: x\ndata: {json}\n\n`); `type HistoriaServidor = { historia: { qp: string; hda: string; ap: string; hp: string; hf: string; exameFisico: string; examesTexto: string }; seguranca: { alergias: unknown[]; emUso: string[]; sinais: SinalDisparadoServidor[] }; conflitos: unknown[]; extrasIa: string[]; perguntas: PerguntaServidor[] }`; `type PerguntaServidor = { id: string; texto: string; seSim: string; seNao: string; sinalId: string | null; resposta: 'sim' | 'nao' | null }`; `type SinalDisparadoServidor = { id: string; texto: string; tipo: 'urgencia_imediata' | 'prioridade' | 'muda_tratamento'; acao: string[]; prazo: string; origem: 'respondido' | 'ia'; trecho: string | null }`; `gerarHistoria(id: string): Promise<{ gravado: boolean; conteudo: HistoriaServidor | null; avisos: string[]; mensagem: string }>` (faz o `POST /consultas/{id}/historia/gerar`, lê o fluxo até o evento `pronto`; evento `erro` ou falha de rede lança `ErroServidor`); `salvarHistoria(id: string, bloco: HistoriaServidor): Promise<ConsultaServidor>`; `gerarPerguntas(id: string): Promise<{ perguntas: PerguntaServidor[]; avisos: string[] }>`; `oficializarEtapa` passa a aceitar `'historia'`.

- [ ] **Step 1: Write the failing tests** em `consulta.test.ts`: `lerEventos` com dois eventos (`parcial` e `pronto`) devolve os dois na ordem com o JSON lido; `lerEventos` ignora blocos incompletos no fim; `lerEventos` de texto vazio devolve `[]`.
- [ ] **Step 2: Run** `npm test -- src/servidor/consulta.test.ts` em `frontend` — Expected: FAIL.
- [ ] **Step 3: Implement** os tipos, `lerEventos`, as quatro chamadas (`gerarHistoria` usa `fetch` com `ReadableStream`, junta os pedaços e chama `lerEventos`; reaproveitar a base `/api` e o `ErroServidor` de `agenda.ts`).
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/servidor` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor para a história e as perguntas"`

### Task 3: Tradução e regras das perguntas (funções puras)

**Files:**
- Create: `frontend/src/consulta/historia-servidor.ts`
- Test: `frontend/src/consulta/historia-servidor.test.ts`

**Interfaces:**
- Consumes: tipos da Task 2; `SecaoHistoria` de `historia.ts`.
- Produces: `secoesDoServidor(h: HistoriaServidor['historia']): SecaoHistoria[]` (rótulos do Global Constraints; só as seções não vazias; "Queixa principal", "História da doença atual", "Exame físico" sempre presentes mesmo vazias para o médico poder escrever); `historiaParaServidor(secoes: { rotulo: string; texto: string }[], base: HistoriaServidor, perguntas: PerguntaServidor[]): HistoriaServidor` (devolve os 7 campos, `''` para a seção ausente; mantém `seguranca`, `conflitos` e `extrasIa` de `base`; troca `perguntas`); `juntarPerguntas(antigas: PerguntaServidor[], novas: PerguntaServidor[]): PerguntaServidor[]` (as novas, mantendo a `resposta` da antiga de mesmo `texto`; reenumera `id` p1, p2…); `perguntaDoCatalogo(sinal: { id: string; texto: string }): PerguntaServidor` (`id` `c-<sinal.id>`, `seSim` = `Refere: <texto em minúscula>.`, `seNao` = `Nega: <texto em minúscula>.`, `sinalId` = id, `resposta` null); `adicionarPergunta(lista: PerguntaServidor[], p: PerguntaServidor): PerguntaServidor[]` (não duplica por `sinalId` nem por `texto`); `responder(lista, id, resposta: 'sim' | 'nao'): PerguntaServidor[]` (clicar na resposta já marcada desmarca: volta a `null`); `avisosDeUrgencia(h: HistoriaServidor, perguntas: PerguntaServidor[]): { texto: string; acao: string[]; prazo: string }[]` (sinais `urgencia_imediata` da `seguranca` mais os de `perguntas` com `resposta === 'sim'` e `sinalId` desconhecido de `seguranca`: este segundo grupo precisa do catálogo, então a função recebe `catalogo: { id; texto; tipo; acao; prazo }[]` como terceiro parâmetro; sem duplicar por id).

- [ ] **Step 1: Write the failing tests:** `secoesDoServidor` com `hp` e `hf` vazios devolve 5 seções na ordem; com `hp` preenchido inclui "História pessoal" depois de "Antecedentes e alertas"; `historiaParaServidor` devolve os 7 campos mesmo quando uma seção foi apagada (`''`) e preserva `seguranca`; ida e volta de seções ↔ servidor preserva o texto editado; `juntarPerguntas` mantém a resposta da pergunta de mesmo texto e zera a de texto novo; `perguntaDoCatalogo` gera as frases com a primeira letra em minúscula; `adicionarPergunta` duas vezes o mesmo sinal entra uma vez; `responder` marca, troca e desmarca; `avisosDeUrgencia` mostra o sinal de urgência detectado na história, mostra o do catálogo respondido Sim, não mostra prioridade nem Não, e não duplica.
- [ ] **Step 2: Run** `npm test -- src/consulta/historia-servidor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as funções, puras, sem rede e sem React.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/consulta/historia-servidor.ts` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: tradução da história do servidor e regras das perguntas"`

### Task 4: O bloco de perguntas e o aviso de urgência na página da História

**Files:**
- Create: `frontend/src/consulta/perguntas-historia.tsx`
- Modify: `frontend/src/consulta/historia-pagina.tsx` (props opcionais `perguntas?: Perguntas`, sem mudar o que existe quando ausentes)

**Interfaces:**
- Consumes: Task 3. Props do bloco: `{ perguntas: PerguntaServidor[]; urgencias: ReturnType<typeof avisosDeUrgencia>; catalogo: { id: string; texto: string }[]; carregando: boolean; falhou: boolean; onResponder(id: string, r: 'sim' | 'nao'): void; onAdicionar(p: PerguntaServidor): void; onTentarDeNovo(): void }`.
- Produces: no fim do cartão da História, abaixo das seções: rótulo "Perguntas" no estilo dos rótulos da história; cada pergunta numa linha com o texto e os botões **Sim** e **Não** (mesmo estilo dos botões V e F da anamnese, rótulo por extenso); "Ver mais perguntas" abre uma lista dos itens do catálogo que ainda não estão nas perguntas (clicar adiciona); `carregando` mostra "A IA está pensando nas perguntas…"; `falhou` mostra "Não foi possível escrever as perguntas." com o botão "Tentar de novo"; urgências aparecem numa faixa vermelha cheia acima das perguntas (token de alergia/alerta existente), com o texto do sinal e a primeira ação; rodapé de legenda "Sim ou Não; sem resposta, a pergunta não vai para o prontuário".

- [ ] **Step 1: Write the failing test:** não há teste de componente neste projeto; a regra testável já está na Task 3. Em vez de teste de componente, escrever `perguntas-historia.test.ts` só com a função pura `rotuloDoBloco(estado: { carregando: boolean; falhou: boolean; n: number }): string | null` (devolve a mensagem do estado ou `null` quando há perguntas), com os 4 casos; o componente a usa para o texto do estado.
- [ ] **Step 2: Run** esse teste — Expected: FAIL.
- [ ] **Step 3: Implement** `rotuloDoBloco` e o componente (estilo igual ao cartão da história; sem classe nova de cor).
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src/consulta` passam; a conferência visual fica para a Task 5 (precisa da consulta real).
- [ ] **Step 5: Commit** `"Tela: bloco de perguntas e aviso de urgência na História"`

### Task 5: A História pelo servidor na consulta real

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx`
- Test: `frontend/src/consulta/historia-servidor.test.ts` (acrescentar)

**Interfaces:**
- Consumes: Tasks 2–4. Regra: só quando `servidor` (consulta real) existe.
- Produces: ao salvar a anamnese e o exame (os dois já oficializados no servidor), em vez de `montarHistoria` local a tela chama `gerarHistoria(servidor.id)` e depois `gerarPerguntas(servidor.id)`; as seções vêm de `secoesDoServidor`; `historia` (estado da tela) mantém `{ versao, geradas, textos, mudou, sugestoes }`; `salvarHistoria` envia `salvarHistoria(id, historiaParaServidor(...))` e `oficializarEtapa(id, 'historia')` **antes** de marcar como salva e de seguir para os diagnósticos simulados (que continuam lendo `salva` por rótulo). Falha ao montar: aviso "A IA não conseguiu; escreva ou tente de novo" e a página da História abre com as seções vazias para o médico escrever. Falha nas perguntas: `falhou = true`. Ao salvar de novo a anamnese: `gerarHistoria` e `gerarPerguntas` outra vez, com `juntarPerguntas`. Recarregar: se o servidor tem o bloco da história, as seções, as perguntas e as respostas voltam como rascunho.

- [ ] **Step 1: Write the failing test** (função pura nova em `historia-servidor.ts`): `atualizarSecoesGeradas(antes: SecaoHistoria[], textosAtuais: string[], novas: SecaoHistoria[])` reaproveita `atualizarHistoria` de `historia.ts` (a IA mexe só no que mudou; o que o médico editou vira sugestão ao lado). Teste: seção que o médico editou e que a nova versão mudou volta como sugestão e não sobrescreve o texto dele.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** a função (delega a `atualizarHistoria`) e a ligação em `pagina-consulta.tsx`, sem mudar JSX existente além de passar as props novas à `PaginaHistoria`.
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src` passam. Depois conferir na tela: subir o servidor com `IA_PROVEDOR=demonstracao` (Docker), `npx vite --port 5191`, criar um pedido pela API e enviar o formulário, abrir a consulta, salvar anamnese e exame, ver a História com as 3 perguntas (uma delas `angioedema`: responder Sim e ver a faixa vermelha), responder, salvar, recarregar a página e conferir que as respostas voltaram, e conferir no banco (`docker compose exec db psql … "select content->'perguntas' from clinical_histories"`). Tirar print da História em 1280×690 com o Chrome sem janela e **medir que cabe**; mostrar o print ao autor. Parar os servidores e **apagar os dados de teste do banco local** (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: a História da consulta real vem do servidor, com as perguntas contextuais"`

---

## Fora deste plano (decidido)

- **Parte C — Diagnósticos no servidor:** só então o DD (e a conduta) leem de fato as respostas na tela; hoje o servidor já está pronto para isso.
- **Tirar a lista de sinais (V e F) da página 1 nos atendimentos de exemplo:** apagaria o comportamento de demonstração (os exemplos dependem dela para salvar); só com o ok do autor. Nas consultas reais ela já não aparece.
- **Guias aprovados pelo autor** e **RAG completo:** como no plano da parte A.
- **Escrita ao vivo da história real** (letras aparecendo conforme o servidor escreve): nesta etapa a tela mostra o texto final com a animação que já existe.
