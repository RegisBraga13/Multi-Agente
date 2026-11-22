# Prontuário no servidor (parte F): finalizar a consulta — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** numa consulta real (pedido, primeira consulta), a página do Prontuário usa o servidor: ele propõe o prontuário a partir de tudo que foi salvo (história, perguntas respondidas, diagnósticos, conduta e anexos enviados); o médico revisa e edita como hoje; **Salvar prontuário** finaliza a consulta no servidor (a entrada fica imutável, só recebe adendo).

**Architecture:** o servidor já propõe (`GET /consultas/{id}/prontuario`) e finaliza (`POST /consultas/{id}/finalizar`, que exige as 5 etapas salvas e em dia e todos os documentos enviados). Falta: (1) o servidor aplicar as edições do médico às **linhas narrativas** (queixa, HDA, antecedentes, exame físico, exames, orientações) dentro dos próprios dados, como a tela faz hoje, porque hoje ele só guarda `edicoes` à parte; (2) a tela buscar a proposta do servidor e finalizar por ele. A leitura dos prontuários já finalizados (janela, lista, retorno) continua pela cópia local nesta parte; trocar essa leitura para o servidor é a parte F2.

**Tech Stack:** FastAPI + pytest; React + TypeScript + vitest.

**Spec:** [ADR 0005](../../decisoes/0005-consulta-no-servidor.md), partes [C](2026-11-22-diagnosticos-no-servidor.md), [D](2026-11-22-conduta-no-servidor.md), [E](2026-11-22-anexos-no-servidor.md); regras do autor em `docs/regras-do-autor.md` §13 (prontuário).

## Global Constraints

- **Nenhuma mudança visual** na página do Prontuário.
- Prontuário finalizado é **imutável**; correção é só por adendo datado (a tela de adendo não faz parte desta parte).
- O texto que o médico editou nas linhas narrativas **vai para o próprio dado** (e some a linha se ele apagar o texto), igual a hoje; as linhas estruturadas (diagnósticos, receita…) guardam a edição em `edicoes`.
- A origem ("sugestão da IA") nunca entra no prontuário.
- O nome do paciente continua só no prontuário e nos documentos; nunca vai à IA.
- **Cópia local temporária:** em consulta real, ao finalizar, a tela também grava a entrada na cópia local (como hoje) para a janela, a lista e o retorno continuarem funcionando até a parte F2; o servidor é o registro.
- Só pedido real de primeira consulta usa o servidor; exemplos e retorno seguem simulados.
- Erros para o médico: linguagem simples; se o servidor recusar finalizar, a consulta **não** fica finalizada.

## Review Focus

- O médico edita a HDA e uma linha de diagnóstico e finaliza: a HDA editada fica nos dados da entrada; o texto da linha do diagnóstico fica em `edicoes`; ao reabrir a entrada, as duas aparecem como editadas.
- O médico apaga o texto de uma linha narrativa: a linha some do prontuário (campo vazio), sem erro.
- Finalizar duas vezes seguidas (duplo toque): a segunda não duplica nem quebra (a consulta já finalizada).
- Falta um anexo escolhido sem enviar: o servidor recusa com mensagem clara e a tela mostra essa mensagem.
- Servidor fora do ar ao finalizar: a tela avisa, a consulta não fica finalizada e o médico pode tentar de novo.
- O prontuário proposto pelo servidor traz as respostas das perguntas na HDA e o diagnóstico escrito pelo médico sem percentual.
- Recarregar a página do Prontuário antes de salvar: a proposta é a mesma (vem do servidor), e as edições não salvas se perdem (aviso já existente de rascunho).

---

## File Structure

- `backend/app/prontuario/montar.py` (modificar): `aplicar_edicoes_narrativas`.
- `backend/app/api/prontuario.py` (modificar): `finalizar` usa a função.
- `frontend/src/servidor/consulta.ts` (modificar): proposta, finalizar e lista do paciente.
- `frontend/src/consulta/prontuario.ts` (modificar): `edicoesDoMedico` (todas as linhas que ele mudou).
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): busca a proposta e finaliza pelo servidor.

---

### Task 1: O servidor aplica as edições narrativas aos dados

**Files:**
- Modify: `backend/app/prontuario/montar.py`, `backend/app/api/prontuario.py`
- Test: `backend/tests/test_prontuario_montar.py`, `backend/tests/test_api_prontuario.py`

**Interfaces:**
- Produces: `NARRATIVAS: dict[str, str]` = `{"S.qp": "qp", "S.hda": "hda", "S.ap": "ap", "S.hp": "hp", "S.hf": "hf", "O.exame": "exame_fisico", "O.exames": "exames_texto", "P.orientacoes": "orientacoes"}` (as mesmas chaves da tela); `aplicar_edicoes_narrativas(dados: DadosEntrada, edicoes: dict[str, str]) -> tuple[DadosEntrada, dict[str, str]]` (devolve os dados com os campos narrativos trocados pelo texto editado, sem espaços nas pontas, e as `edicoes` que sobram: as chaves que não são narrativas); `POST /consultas/{id}/finalizar` grava os dados já com as edições narrativas e só o resto em `edicoes`.

- [ ] **Step 1: Write the failing tests:** (`test_prontuario_montar`) `test_edicao_narrativa_vai_para_o_dado_e_sai_das_edicoes` (`{"S.hda": " HDA nova. "}` → `dados.hda == "HDA nova."`, `edicoes == {}`); `test_linha_estruturada_fica_em_edicoes` (`{"A.hd.0": "Meu texto"}` volta igual em `edicoes` e os dados não mudam); `test_texto_vazio_apaga_a_narrativa` (`{"S.ap": "  "}` → `dados.ap == ""`); `test_chave_desconhecida_fica_em_edicoes`; `test_nao_muda_o_objeto_original`; (`test_api_prontuario`) `test_finalizar_aplica_a_edicao_da_hda_e_guarda_a_do_diagnostico`: depois de finalizar com `{"S.hda": "HDA editada.", "A.hd.0": "Linha do HD"}`, `GET /pacientes/{id}/prontuario` devolve `dados.hda == "HDA editada."` e `edicoes == {"A.hd.0": "Linha do HD"}`.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_prontuario_montar.py tests/test_api_prontuario.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** a função (cópia profunda dos dados; `strip()` no texto) e usá-la na rota de finalizar.
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q`, `ruff`, `mypy app` e os testes de banco `tests/banco` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: finalizar aplica as edições narrativas do médico aos dados"`

### Task 2: Cliente do servidor para finalizar e edições do médico

**Files:**
- Modify: `frontend/src/servidor/consulta.ts`, `frontend/src/consulta/prontuario.ts`
- Test: `frontend/src/servidor/consulta.test.ts`, `frontend/src/consulta/prontuario.test.ts`

**Interfaces:**
- Produces: `prontuarioProposto(id: string): Promise<DadosEntrada>` (`GET /consultas/{id}/prontuario`; `DadosEntrada` é o tipo de `prontuario/registro.ts`); `finalizarConsulta(id: string, edicoes: Record<string, string>): Promise<EntradaProntuario>` (`POST /consultas/{id}/finalizar` com `{ edicoes }`); `prontuarioDoPaciente(pacienteId: string): Promise<EntradaProntuario[]>` (`GET /pacientes/{id}/prontuario`, para o título da próxima entrada); `urlDaFinalizacao(id: string): string` (`/api/consultas/<id>/finalizar`, pura); em `prontuario.ts`: `edicoesDoMedico(d: DadosEntrada, textos: Record<string, string>): Record<string, string>` (**todas** as linhas que o médico mudou, narrativas e estruturadas, chave → texto, na mesma regra de `aplicarEdicoes`: ignora o que não mudou e o que não tem texto novo).

- [ ] **Step 1: Write the failing tests:** `urlDaFinalizacao('abc')` devolve `/api/consultas/abc/finalizar`; `edicoesDoMedico` com a HDA editada e uma linha de HD editada devolve as duas chaves; sem mudança devolve `{}`; linha apagada (texto vazio) vem com `''`; `edicoesDoMedico` + `aplicarEdicoes` concordam (as chaves narrativas de uma são os campos mudados da outra).
- [ ] **Step 2: Run** `npm test -- src/servidor/consulta.test.ts src/consulta/prontuario.test.ts` em `frontend` — Expected: FAIL.
- [ ] **Step 3: Implement** as chamadas e a função pura.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor para finalizar a consulta"`

### Task 3: O Prontuário pelo servidor

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx`

**Interfaces:**
- Consumes: Tasks 1–2. Regra: só quando `servidor` existe.
- Produces: ao salvar os anexos numa consulta real, a tela busca `prontuarioProposto(servidor.id)` (no lugar de montar `dadosP` localmente) e mostra "A IA está escrevendo o prontuário…" no estilo dos outros; o título da entrada vem de `tituloNovaEntrada` com `prontuarioDoPaciente(servidor.pacienteId)`; falha mostra a mensagem do servidor (ou "Não foi possível montar o prontuário. Tente de novo.") e a página do Prontuário não abre. **Salvar prontuário** envia `finalizarConsulta(servidor.id, edicoesDoMedico(dados, textos))`; só depois grava a cópia local (`salvarEntrada`, com os dados e as edições aplicados como hoje), marca como salvo e volta à página inicial com o aviso "Consulta finalizada. Prontuário de <nome> salvo."; falha mostra a mensagem do servidor e **nada** é gravado nem marcado.

- [ ] **Step 1: Write the failing test:** a lógica pura está nas Tasks 1–2; não há teste de componente. Em `prontuario.test.ts`, `test_a_copia_local_igual_ao_que_o_servidor_guarda`: `aplicarEdicoes(dados, textos)` aplicada ao mesmo conjunto de edições de `edicoesDoMedico` produz os dados que o servidor guardaria (narrativas nos dados; o resto em `edicoes`), provando que a cópia local e o registro do servidor não divergem.
- [ ] **Step 2: Run** esse teste — Expected: PASS (a prova de consistência); ajustar até passar.
- [ ] **Step 3: Implement** a ligação em `pagina-consulta.tsx` sem mudar o JSX além de um parágrafo de "carregando".
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src`, `.venv/Scripts/python -m pytest -q` (em `backend`) passam. Conferir na tela: Docker com `IA_PROVEDOR=demonstracao` e `npx vite --port 5191`; criar um pedido pela API com nome comum (ex.: "Joaquim Ferraz Lobo"), percorrer a consulta até os Anexos, enviar a receita (e o pedido de exames e as orientações, que vêm marcados), salvar os anexos, ver o Prontuário, **editar a HDA e uma linha de diagnóstico**, salvar; conferir no banco (`select finalized_at, record->'dados'->>'hda', record->'edicoes' from encounters`) que a HDA editada está nos dados, a edição do diagnóstico em `edicoes` e `finalized_at` preenchido; conferir que `POST finalizar` de novo devolve erro claro e não muda nada. Tirar print do Prontuário em 1280×690 (página que rola) e mostrar ao autor. **Apagar os dados de teste do banco local** ao terminar (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: o Prontuário da consulta real é finalizado no servidor"`

---

## Fora deste plano (decidido)

- **Parte F2 — ler do servidor:** a janela do prontuário, a lista de pacientes com prontuário, o histórico de exames e o retorno passam a ler do servidor (hoje leem a cópia local). Precisa de uma rota para listar pacientes com prontuário.
- **Adendo** datado em prontuário finalizado: a rota existe no servidor; a tela de adendo ainda não existe.
- Retorno e atendimentos de exemplo continuam simulados; fotos do exame físico no prontuário continuam como hoje.
- **Login e segurança** (login do médico, CFM): antes de qualquer paciente real.
