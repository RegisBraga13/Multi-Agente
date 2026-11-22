# Diagnóstico Diferencial no servidor (parte C) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa consulta real (pedido, primeira consulta), a página dos Diagnósticos usa o servidor: a IA do servidor sugere as hipóteses lendo a história salva e as respostas das perguntas; o médico decide como hoje; salvar grava e oficializa no servidor. Conduta, anexos e prontuário seguem simulados.

**Architecture:** o servidor já gera, guarda e oficializa o bloco dos diagnósticos e já lê as perguntas respondidas (parte A). Faltam: o bloco aceitar o diagnóstico escrito pelo médico (sem percentual e com CID livre), a demonstração devolver hipóteses suficientes para testar, e a tela trocar a montagem simulada pela do servidor com funções puras de tradução. A lógica de decisão, reserva do "+", avisos e atualização que a tela já tem **não muda**.

**Tech Stack:** FastAPI + Pydantic + pytest; React + TypeScript + vitest.

**Spec:** [parte A](2026-11-21-perguntas-contextuais-servidor.md), [parte B](2026-11-21-perguntas-contextuais-tela.md), [ADR 0005](../../decisoes/0005-consulta-no-servidor.md); regras do autor em `docs/regras-do-autor.md` (fluxo e estilo intocáveis; o médico decide; a IA sugere).

## Global Constraints

- **Nenhuma mudança visual** na página dos Diagnósticos. A regra do "+", os avisos de mudança e a atualização "a IA mexe só no que mudou" ficam como estão (`diagnosticos.ts`).
- Só pedido real de primeira consulta usa o servidor; exemplos e retorno seguem simulados.
- O diagnóstico escrito pelo médico nunca é tocado pela IA e **não tem percentual**; CID é opcional.
- A hipótese da IA só entra com evidência (trecho literal da história): o servidor já descarta as sem evidência.
- A origem ("sugestão da IA") aparece só na tela, nunca no prontuário.
- O DD lê as respostas das perguntas respondidas e a história salva (já implementado no servidor; nesta parte só se confirma ponta a ponta).
- Erros para o médico: linguagem simples. Falha da IA: avisar e deixar o médico escrever o diagnóstico à mão.

## Review Focus

- A IA do servidor falha ou devolve vazio: a página abre sem hipóteses da IA, com o aviso, e o médico pode adicionar o diagnóstico dele e salvar.
- O médico adiciona um diagnóstico sem CID ou com CID digitado livremente (ex.: "l70"): o servidor aceita, grava e devolve igual.
- A história é editada e salva de novo: o DD é refeito, as decisões do médico continuam (aviso "mudou"/"saiu"), porque o `id` de cada hipótese é estável entre gerações.
- O médico tenta salvar sem confirmar nenhum diagnóstico: continua bloqueado na tela, e se o servidor recusar (409) a tela mostra a mensagem dele.
- Salvar duas vezes seguidas: não duplica nada e não quebra.
- Recarregar a página: os diagnósticos e as decisões já salvas voltam como rascunho.
- Hipótese cuja `secao` da evidência o servidor escreveu com a chave (`hda`, `exameFisico`…): a tela mostra o rótulo da seção, nunca a chave.

---

## File Structure

- `backend/app/contratos/consulta_blocos.py` (modificar): `HipoteseItem` e `ItemDD.hipotese`.
- `backend/app/consulta/geracao.py` (modificar): converte as hipóteses da IA para `HipoteseItem`.
- `backend/app/provedores/ia_demonstracao.py` (modificar): 4 hipóteses e um "não pode perder".
- `frontend/src/servidor/consulta.ts` (modificar): `gerarEtapa` genérica, `gerarDiagnosticos`, `salvarDiagnosticos`.
- `frontend/src/consulta/diagnosticos-servidor.ts` (criar): tradução servidor ⇄ tela.
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): usa o servidor para os diagnósticos.

---

### Task 1: O bloco aceita o diagnóstico escrito pelo médico

**Files:**
- Modify: `backend/app/contratos/consulta_blocos.py`, `backend/app/consulta/geracao.py`
- Test: `backend/tests/test_consulta_blocos.py`, `backend/tests/test_geracao_consulta.py`, `backend/tests/test_prontuario_montar.py`

**Interfaces:**
- Produces: `HipoteseItem(nome: str, cid: str, certeza: Certeza, pct: int | None, evidencias: list[EvidenciaDD])` (`pct` entre 1 e 99 quando houver; `cid` livre, máximo 12 caracteres, vazio permitido); `ItemDD.hipotese: HipoteseItem`. A geração converte cada `HipoteseIA` em `HipoteseItem` sem mudar nenhum valor. O diagnóstico do médico entra com `pct=None`, `certeza="clinico"`, `evidencias=[]`.

- [ ] **Step 1: Write the failing tests:** (blocos) `test_item_do_medico_sem_pct_e_sem_cid_e_valido` (`ItemDD` com `propria=True`, `pct=None`, `cid=""`); `test_cid_livre_do_medico_ida_e_volta` (`"l70"` e `"L70.0"` voltam iguais); `test_pct_fora_de_1_a_99_e_invalido`; (geração) `test_diagnosticos_gerados_viram_itens_com_os_mesmos_valores` (os campos da IA aparecem iguais no bloco gravado); (prontuário) `test_diagnostico_do_medico_sem_pct_vai_para_o_fim_dos_assinalados` (já ordenado por `_por_pct`; garantir que `DiagnosticoRegistro.pct is None`).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_consulta_blocos.py tests/test_geracao_consulta.py tests/test_prontuario_montar.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** `HipoteseItem` e a conversão na etapa `diagnosticos` de `gerar` (`HipoteseItem.model_validate(h.model_dump())`); ajustar quem constrói `ItemDD` em `tests/fabrica.py` se o tipo exigir.
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q`, `ruff check`, `ruff format`, `mypy app` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: o bloco dos diagnósticos aceita o diagnóstico do médico (sem percentual, CID livre)"`

### Task 2: A demonstração devolve hipóteses para testar

**Files:**
- Modify: `backend/app/provedores/ia_demonstracao.py`
- Test: `backend/tests/test_api_ponta_a_ponta.py`

**Interfaces:**
- Produces: com `IA_PROVEDOR=demonstracao`, `diagnosticos/gerar` devolve 4 hipóteses (`pct` 70, 15, 10, 5; CIDs válidos; cada uma com uma evidência a favor citando o trecho literal "Quadro em avaliação." da HDA da demonstração) e um `naoPodePerder`.

- [ ] **Step 1: Write the failing test:** `test_demonstracao_propoe_quatro_hipoteses_e_um_nao_pode_perder` (consulta até a história oficializada; `POST .../diagnosticos/gerar`; evento `pronto`; 4 itens com `decisao == "pendente"` e `propria == False`; `naoPodePerder` não nulo).
- [ ] **Step 2: Run** esse teste — Expected: FAIL (1 hipótese).
- [ ] **Step 3: Implement** o ramo `diagnosticos` da demonstração.
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q` — Expected: passa (o teste de ponta a ponta existente continua confirmando o primeiro item).
- [ ] **Step 5: Commit** `"Servidor: a demonstração propõe quatro hipóteses"`

### Task 3: Cliente do servidor para os diagnósticos

**Files:**
- Modify: `frontend/src/servidor/consulta.ts`
- Test: `frontend/src/servidor/consulta.test.ts`

**Interfaces:**
- Produces: tipos `EvidenciaServidor = { lado: 'favor' | 'contra'; texto: string; secao: string; trecho: string }`, `HipoteseServidor = { nome: string; cid: string; certeza: 'suspeita' | 'hipotese' | 'clinico'; pct: number | null; evidencias: EvidenciaServidor[] }`, `ItemDDServidor = { hipotese: HipoteseServidor; decisao: 'pendente' | 'confirmada' | 'descartada'; propria: boolean }`, `DiagnosticosServidor = { itens: ItemDDServidor[]; naoPodePerder: unknown | null; rastrear: string[] }`; `gerarEtapa<T>(id: string, etapa: 'historia' | 'diagnosticos'): Promise<{ gravado: boolean; conteudo: T | null; avisos: string[]; mensagem: string }>` (a leitura do fluxo que `gerarHistoria` já faz, agora genérica; `gerarHistoria` passa a chamar `gerarEtapa<HistoriaServidor>(id, 'historia')`); `gerarDiagnosticos(id: string)` = `gerarEtapa<DiagnosticosServidor>(id, 'diagnosticos')`; `salvarDiagnosticos(id: string, bloco: DiagnosticosServidor): Promise<ConsultaServidor>`; `oficializarEtapa` aceita `'diagnosticos'`.

- [ ] **Step 1: Write the failing test:** a refatoração não muda comportamento; escrever `test_url_da_etapa` em `consulta.test.ts` para a função pura nova `urlDaGeracao(id: string, etapa: 'historia' | 'diagnosticos'): string` (`/consultas/<id>/<etapa>/gerar` com a base `/api`).
- [ ] **Step 2: Run** `npm test -- src/servidor/consulta.test.ts` em `frontend` — Expected: FAIL.
- [ ] **Step 3: Implement** os tipos, `urlDaGeracao`, `gerarEtapa`, `gerarDiagnosticos`, `salvarDiagnosticos`.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/servidor` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor para os diagnósticos"`

### Task 4: Tradução dos diagnósticos (funções puras)

**Files:**
- Create: `frontend/src/consulta/diagnosticos-servidor.ts`
- Test: `frontend/src/consulta/diagnosticos-servidor.test.ts`

**Interfaces:**
- Consumes: `Hipotese`, `ItemDD`, `Evidencia`, `Decisao` de `diagnosticos.ts`; tipos da Task 3; os rótulos das seções de `historia-servidor.ts` (exportar `ROTULO_DA_SECAO: Record<string, string>` com as chaves `qp`, `hda`, `ap`, `hp`, `hf`, `exameFisico`, `examesTexto` e `CHAVE_DA_SECAO` inversa).
- Produces: `idDaHipotese(h: { nome: string; cid: string }): string` (estável: `cid` minúsculo e nome sem acento, separados por `-`); `hipotesesDoServidor(b: DiagnosticosServidor): Hipotese[]` (só as que não são `propria`; `evidencias[].secao` vira o rótulo da tela; ordem do servidor); `itensDoServidor(b: DiagnosticosServidor): ItemDD[]` (todas, com a decisão salva, `mudou: false`, `aviso: null`; a do médico com `propria: true` e `pct: null`); `diagnosticosParaServidor(itens: ItemDD[], base: DiagnosticosServidor | null): DiagnosticosServidor` (cada item vira `ItemDDServidor`; a do médico vai com `certeza: 'clinico'`, `pct: null`, `evidencias: []`; `secao` volta para a chave; `naoPodePerder` e `rastrear` vêm de `base`, ou `null` e `[]` sem base).

- [ ] **Step 1: Write the failing tests:** `idDaHipotese` igual para a mesma hipótese em duas gerações e diferente para CIDs diferentes; `hipotesesDoServidor` troca `exameFisico` por "Exame físico" e ignora o diagnóstico do médico; ida e volta `diagnosticosParaServidor(itensDoServidor(b), b)` devolve o mesmo `b` (inclusive `naoPodePerder` e `rastrear`); diagnóstico do médico sem CID e com `pct: null` vai com `certeza: 'clinico'` e volta com `propria: true`; seção desconhecida na evidência é mantida como veio (sem quebrar); decisão `confirmada` e `descartada` são preservadas.
- [ ] **Step 2: Run** `npm test -- src/consulta/diagnosticos-servidor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as funções puras (sem rede e sem React).
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/consulta` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: tradução dos diagnósticos do servidor"`

### Task 5: A página dos Diagnósticos pelo servidor

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx`

**Interfaces:**
- Consumes: Tasks 3–4. Regra: só quando `servidor` existe.
- Produces: ao salvar a história numa consulta real (depois de o servidor oficializar a história), a tela chama `gerarDiagnosticos(servidor.id)`; mostra "A IA está pensando nos diagnósticos…" no mesmo estilo de "A IA está montando a história…"; com o resultado, `iniciarDiagnosticos(hipotesesDoServidor(b))` na primeira vez ou `atualizarComReserva(dd.itens, hipotesesDoServidor(b))` nas seguintes; o `resumo` ("Para relembrar") continua montado na tela como hoje. Falha ou vazio: aviso "A IA não conseguiu; adicione o diagnóstico à mão" e a página abre só com o botão de adicionar. Salvar os diagnósticos envia `salvarDiagnosticos(id, diagnosticosParaServidor(itens, ultimoBloco))` e `oficializarEtapa(id, 'diagnosticos')` antes de seguir para a conduta simulada; falha mostra a mensagem do servidor e não marca como salvo. Recarregar: se o servidor tem o bloco dos diagnósticos, `itensDoServidor` volta como rascunho (sem reserva).

- [ ] **Step 1: Write the failing test:** a lógica nova de decisão já está coberta nas Tasks 3–4; não há teste de componente. Em vez disso, escrever em `diagnosticos-servidor.test.ts` `test_regerar_mantem_a_decisao_do_medico_pelo_id_estavel` (`atualizarComReserva(itens, hipotesesDoServidor(novo))` com a mesma hipótese em duas gerações mantém `decisao: 'confirmada'` e, com `pct` diferente, gera o aviso `mudou`).
- [ ] **Step 2: Run** esse teste — Expected: FAIL antes de `idDaHipotese` estar ligado, PASS depois (ele prova que o id estável funciona com a lógica existente).
- [ ] **Step 3: Implement** a ligação em `pagina-consulta.tsx` sem mudar o JSX existente além de um parágrafo de "carregando" (como na história) e do estado novo.
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src` passam. Conferir na tela: Docker com `IA_PROVEDOR=demonstracao` e `npx vite --port 5191` (se já não estiver rodando); criar um pedido pela API com nome comum (ex.: "Joaquim Ferraz Lobo"; não use nome com palavras como "Paciente"), enviar o formulário, abrir a consulta, salvar anamnese e exame, responder uma pergunta com Sim, salvar a história, ver os Diagnósticos (3 hipóteses, o "+" traz a 4ª), confirmar uma, adicionar um diagnóstico do médico sem CID, salvar; conferir no banco (`select content->'itens' from diagnostic_hypotheses`) que as decisões e o diagnóstico do médico estão lá; recarregar a página 1 e voltar. Tirar print da página dos Diagnósticos em 1280×690 e **medir que cabe**; mostrar ao autor. **Apagar os dados de teste do banco local** ao terminar (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: os Diagnósticos da consulta real vêm do servidor"`

---

## Fora deste plano (decidido)

- **"Para relembrar"** (o resumo V/F que alimenta a conduta) segue simulado na tela: o servidor não tem esse motor; ele entra na parte da conduta.
- **"Não pode perder" e "Rastrear"** já ficam guardados no bloco, mas a tela ainda não os mostra (não foram pedidos).
- **Conduta, anexos e prontuário no servidor:** próximas partes, uma por vez. Um diagnóstico do médico sem CID válido não consegue ser o principal na conduta do servidor; isso será tratado na parte da conduta.
- Retorno e atendimentos de exemplo continuam simulados.
