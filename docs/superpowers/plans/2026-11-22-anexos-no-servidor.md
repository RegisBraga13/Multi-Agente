# Anexos no servidor (parte E) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa consulta real (pedido, primeira consulta), cada anexo (receita, pedido de exames, encaminhamento, orientações, atestado, laudo) que o médico **envia** fica guardado no servidor; ao recarregar, os já enviados voltam como enviados. O prontuário seguirá simulado até a parte F.

**Architecture:** o servidor já guarda documentos por consulta (`PUT /consultas/{id}/documentos/{tipo}`, `GET /consultas/{id}/documentos`) e a finalização exigirá todos "enviados". Os anexos são montados na tela a partir da conduta (função `montarAnexos`, que não muda). Aqui só se **grava no servidor quando o médico envia** (estado `enviado`, com o texto final e o resumo do atestado/laudo) e se **restaura** o que já foi enviado. Rascunho, revisão e assinatura seguem só na tela.

**Tech Stack:** React + TypeScript + vitest (o servidor não muda).

**Spec:** [ADR 0005](../../decisoes/0005-consulta-no-servidor.md), partes [C](2026-11-22-diagnosticos-no-servidor.md) e [D](2026-11-22-conduta-no-servidor.md); regras do autor em `docs/regras-do-autor.md`.

## Global Constraints

- **Nenhuma mudança visual** na página dos Anexos.
- Assinatura e envio continuam **simulação** (regras do CFM chegam antes do deploy); "enviado" só marca o estado e grava.
- Só **documento enviado** é gravado no servidor. O servidor não tem como apagar documento; por isso nada de rascunho é gravado (um rascunho que o médico depois desmarcasse ficaria preso e bloquearia a finalização).
- Documento enviado **não se edita nem se desmarca** (regra que a tela já tem).
- O atestado e o laudo levam o **resumo de uma linha** do prontuário (`registro`); receita, exames, encaminhamento e orientações levam `registro: null`.
- Só pedido real de primeira consulta usa o servidor; exemplos e retorno seguem simulados.
- Erros para o médico: linguagem simples; se o servidor não gravar, o documento **não** fica como enviado.

## Review Focus

- O servidor está fora do ar ao enviar: a tela avisa, o documento continua como estava (revisado/assinado) e pode ser enviado de novo.
- Enviar o mesmo documento duas vezes seguidas: grava uma vez só (um por tipo no servidor), sem erro.
- Recarregar depois de enviar a receita: ela volta como enviada, com o texto que foi enviado; os demais anexos voltam como a conduta os monta.
- Atestado com período: o `registro` leva `de`, `ate` e o resumo; sem período, "comparecimento à consulta.". Laudo sem finalidade escolhida não chega a ser enviado (a tela já bloqueia).
- A conduta mudou depois de enviar um anexo: o anexo já enviado não é refeito nem perdido.
- Receita enviada leva o texto exato que a folha mostrava (o que vai para o prontuário).

---

## File Structure

- `frontend/src/servidor/consulta.ts` (modificar): tipos e chamadas dos documentos.
- `frontend/src/consulta/prontuario.ts` (modificar): exportar `registroDoAnexo` (hoje a função privada `documento`).
- `frontend/src/consulta/anexos-servidor.ts` (criar): funções puras de tradução e de regra.
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): grava ao enviar e restaura ao retomar.

---

### Task 1: Cliente do servidor para os documentos

**Files:**
- Modify: `frontend/src/servidor/consulta.ts`
- Test: `frontend/src/servidor/consulta.test.ts`

**Interfaces:**
- Produces: `type DocumentoServidor = { tipo: 'receita' | 'exames' | 'encaminhamento' | 'orientacoes' | 'atestado' | 'laudo'; estado: 'rascunho' | 'revisado' | 'assinado' | 'enviado'; texto: string; registro: { tipo: 'atestado'; de: string | null; ate: string | null; resumo: string } | { tipo: 'laudo'; finalidade: string; resumo: string } | null }`; `urlDoDocumento(id: string, tipo: DocumentoServidor['tipo']): string` (`/api/consultas/<id>/documentos/<tipo>`); `salvarDocumento(id: string, doc: DocumentoServidor): Promise<void>` (PUT em `/consultas/<id>/documentos/<tipo>`); `listarDocumentos(id: string): Promise<DocumentoServidor[]>` (GET `/consultas/<id>/documentos`).

- [ ] **Step 1: Write the failing test:** `urlDoDocumento('abc', 'atestado')` devolve `/api/consultas/abc/documentos/atestado`.
- [ ] **Step 2: Run** `npm test -- src/servidor/consulta.test.ts` em `frontend` — Expected: FAIL.
- [ ] **Step 3: Implement** os tipos, `urlDoDocumento` e as duas chamadas (reaproveitar `chamar`, que já trata resposta 204).
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/servidor` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor para os documentos"`

### Task 2: Tradução e regras dos anexos (funções puras)

**Files:**
- Create: `frontend/src/consulta/anexos-servidor.ts`
- Modify: `frontend/src/consulta/prontuario.ts` (a função privada `documento(a: Anexo): DocumentoRegistro[]` vira `export function registroDoAnexo(a: Anexo): DocumentoRegistro | null`, com o mesmo comportamento; os usos atuais passam a `flatMap` do resultado em lista)
- Test: `frontend/src/consulta/anexos-servidor.test.ts`

**Interfaces:**
- Consumes: Task 1; `Anexo`, `TipoAnexo` de `anexos.ts`.
- Produces: `documentoParaServidor(a: Anexo): DocumentoServidor` (`estado: 'enviado'`, `texto: a.texto`, `registro: registroDoAnexo(a)`); `aplicarDocumentos(anexos: Anexo[], docs: DocumentoServidor[]): Anexo[]` (para cada doc `enviado` com anexo do mesmo tipo: `estado: 'enviado'`, `emitir: true`, `texto` e `textoIA` do servidor; o resto fica como veio); `virouEnviado(antes: Anexo[], depois: Anexo[], tipo: TipoAnexo): boolean` (o anexo do tipo não estava `enviado` e agora está).

- [ ] **Step 1: Write the failing tests:** `documentoParaServidor` de uma receita devolve `estado: 'enviado'`, o texto exato e `registro: null`; de um atestado com período devolve `registro` com `de`, `ate` e `resumo: 'de 13/11 a 15/11/2026.'`; atestado sem período devolve `resumo: 'comparecimento à consulta.'` e `de`/`ate` nulos; laudo com finalidade INSS devolve `finalidade: 'para o INSS'`; `aplicarDocumentos` marca como enviado só o tipo que veio enviado do servidor e põe o texto dele; ignora documento do servidor com estado diferente de `enviado`; `virouEnviado` é verdadeiro só na passagem de não enviado para enviado; ida e volta: `aplicarDocumentos(anexos, [documentoParaServidor(enviado)])` devolve o anexo enviado igual.
- [ ] **Step 2: Run** `npm test -- src/consulta/anexos-servidor.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as funções puras e exportar `registroDoAnexo`.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src/consulta` — Expected: passam (os testes antigos do prontuário continuam verdes).
- [ ] **Step 5: Commit** `"Tela: tradução dos anexos enviados para o servidor"`

### Task 3: Gravar ao enviar e restaurar ao retomar

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx`

**Interfaces:**
- Consumes: Tasks 1–2. Regra: só quando `servidor` existe.
- Produces: no `onAvancar` da página dos Anexos, se `virouEnviado(docs.itens, avancar(docs.itens, tipo), tipo)`, a tela chama `salvarDocumento(servidor.id, documentoParaServidor(anexoNovo))` **antes** de aplicar a mudança; falha mostra a mensagem do servidor (ou "Não foi possível enviar. Tente de novo.") e o anexo não vira enviado; o aviso "enviado ao paciente (simulação)" só aparece depois de gravar. Ao abrir uma consulta retomada, `listarDocumentos(servidor.id)` e, quando já existe `conduta` restaurada, `docs` = `aplicarDocumentos(montarAnexos(conduta.c, dados), documentos)` (sem animação nova). Quando os anexos são montados depois (conduta salva nesta sessão), os documentos já enviados no servidor também são aplicados.

- [ ] **Step 1: Write the failing test:** a lógica está nas funções da Task 2; não há teste de componente. Acrescentar em `anexos-servidor.test.ts` o caso `test_conduta_refeita_nao_desfaz_o_anexo_enviado`: `atualizarAnexos(antes, novos)` (de `anexos.ts`) com o anexo enviado cuja base não mudou devolve o mesmo anexo enviado, e `aplicarDocumentos` sobre o resultado mantém o enviado.
- [ ] **Step 2: Run** esse teste — Expected: PASS ou FAIL conforme o comportamento atual de `atualizarAnexos`; se falhar, corrigir a causa em `anexos.ts` antes de seguir.
- [ ] **Step 3: Implement** a ligação em `pagina-consulta.tsx` sem mudar o JSX.
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src`, `.venv/Scripts/python -m pytest -q` (em `backend`) passam. Conferir na tela: Docker com `IA_PROVEDOR=demonstracao` e `npx vite --port 5191`; criar um pedido pela API com nome comum (ex.: "Joaquim Ferraz Lobo"), percorrer a consulta até a Conduta, escolher uma opção tópica, salvar; nos Anexos revisar e enviar a receita e um atestado com período; conferir no banco (`select kind, status, content->>'texto', content->'registro' from documents`) que os dois estão `enviado` com o texto e o resumo; recarregar a página e confirmar que a receita volta como enviada. Tirar print dos Anexos em 1280×690, **medir que cabe** e mostrar ao autor. **Apagar os dados de teste do banco local** ao terminar (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: os Anexos da consulta real são gravados no servidor ao enviar"`

---

## Fora deste plano (decidido)

- **Prontuário no servidor** (finalizar, adendo, janela e lista): parte F. Ela exige todos os anexos escolhidos enviados e usa o texto da receita e o resumo do atestado/laudo gravados aqui.
- **Assinatura com certificado digital e envio real** ao paciente: dependem das regras do CFM e de integração; seguem simulação.
- **Gravar rascunho no servidor** (para retomar um anexo ainda não enviado): exigiria a opção de apagar documento no servidor; fica para depois.
- Retorno e atendimentos de exemplo continuam simulados.
