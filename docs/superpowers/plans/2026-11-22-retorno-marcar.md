# Retorno — parte 1: marcar o retorno — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O médico marca (ou dispensa) o retorno na página 5 da consulta; ao Finalizar, o servidor cria o cartão "Retorno" na agenda e grava o dia (ou "Sem retorno") no prontuário.

**Architecture:** O rascunho do retorno vive só na tela e vai no corpo de `POST /consultas/{id}/finalizar` como `retornoMarcado` (ou nulo). O servidor confere o horário, cria o retorno numa tabela própria (`return_bookings`), finaliza a consulta e, se a finalização falhar, desfaz o retorno. A linha da Conduta "Retorno em X semanas" vira "Avaliação em X semanas" e o campo `retorno` do prontuário vira `avaliacao`; o campo novo `retornoMarcado` guarda o que foi marcado.

**Tech Stack:** FastAPI + Pydantic + psycopg (Postgres com RLS), pytest, ruff, mypy; React + TypeScript + Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-retorno-marcar-design.md`

## Global Constraints

- Nada é gravado até Finalizar; trocar Sim↔Não ou o horário antes disso não deixa nada no servidor.
- Rótulo exato da Conduta: **"Avaliação em X semanas"** (frase gerada: `Avaliação em 8 semanas, em 08/01/2027.`). "Retorno" só é o que foi marcado no botão.
- Prontuário termina com `Sem retorno` (sem marcação) ou o dia marcado (`Retorno: 05/12/2026 às 14:00, presencial`). Campo não colhido some das outras linhas; estas duas sempre aparecem.
- `SCHEMA_VERSION_PRONTUARIO` sobe de 1 para 2.
- Horário no passado ou ocupado recusa o Finalizar (409) sem perder o prontuário nem finalizar a consulta.
- Textos ao paciente/médico em português, sem jargão. Convenções do projeto: contratos Pydantic com `ModeloApi` (camelCase), RLS por médico (`transacao_do_medico`), repositório com versão em memória para testes.
- Dias reservados para retorno e a abertura do cartão (parte 2) ficam **fora** desta parte.

## Review Focus

- Finalizar duas vezes com retorno: o 2º recebe 409 e **não** cria outro cartão (Task 3).
- Horário ocupado por pedido do paciente OU por outro retorno: 409 e a consulta continua aberta (Task 2, 3).
- `finalizar` falha depois de criar o retorno: o cartão é desfeito (Task 3).
- Retorno marcado para o mesmo instante da própria consulta ou no passado: 409 (Task 3).
- Registro antigo (schema 1, com `retorno`) no banco de desenvolvimento: ao ler, não derrubar o prontuário (Task 1).
- Sim marcado, depois voltou para Não antes de finalizar: o corpo vai com `retornoMarcado: null` (Task 6).

---

### Task 1: Contrato do prontuário — `avaliacao` e `retornoMarcado`

**Files:**
- Modify: `backend/app/contratos/agenda.py` (novo `RetornoMarcado`)
- Modify: `backend/app/contratos/prontuario.py` (`DadosEntrada`, `SCHEMA_VERSION_PRONTUARIO`)
- Modify: `backend/app/prontuario/montar.py:~95-105`
- Modify: `backend/openapi.json` (regenerar como o projeto já faz; ver `app/openapi.py`)
- Test: `backend/tests/test_prontuario_montar.py`, `backend/tests/test_api_prontuario.py`

**Interfaces:**
- Produces: `RetornoMarcado(Horario)` com `modalidade: Modalidade` (campos `data`, `inicio`, `modalidade`); `DadosEntrada.avaliacao: str`; `DadosEntrada.retorno_marcado: RetornoMarcado | None = None`; `dados_da_consulta(...)` devolve `retorno_marcado=None`.

- [ ] **Step 1: Escrever os testes que falham.** Em `test_prontuario_montar.py`: `test_avaliacao_vem_da_conduta` (conduta com `"Avaliação em 8 semanas."` → `dados.avaliacao == "em 8 semanas."` e a frase não vai para `orientacoes`) e `test_retorno_marcado_nasce_nulo`. Em `test_api_prontuario.py`: trocar o texto da conduta para `"Avaliação em 8 semanas."` e as asserções `["retorno"] == "em 8 semanas."` por `["avaliacao"] == "em 8 semanas."`; novo `test_registro_antigo_com_retorno_ainda_le` (grava no repositório em memória um `DadosEntrada` construído a partir de dict com a chave `retorno` e sem `avaliacao`; `GET /pacientes/{id}/prontuario` devolve 200 com `avaliacao` igual ao antigo `retorno`).
- [ ] **Step 2: Rodar e ver falhar.** `cd backend && pytest tests/test_prontuario_montar.py tests/test_api_prontuario.py -q` → FAIL (campo `avaliacao` inexistente).
- [ ] **Step 3: Implementar.** `class RetornoMarcado(Horario)` em `contratos/agenda.py` com `modalidade: Modalidade`. Em `DadosEntrada`: renomear `retorno` → `avaliacao`, acrescentar `retorno_marcado: RetornoMarcado | None = None`, e um `model_validator(mode="before")` que, se vier `retorno` e não vier `avaliacao`, move o valor (leitura de schema 1). `SCHEMA_VERSION_PRONTUARIO = 2`. Em `montar.py`: prefixo `"Avaliação "` no lugar de `"Retorno "` nas duas linhas de `orientacoes`/`avaliacao`.
- [ ] **Step 4: Rodar e ver passar** o mesmo comando; depois `pytest -q` inteiro, `ruff check .`, `mypy app`. Expected: verde. Regenerar `openapi.json`.
- [ ] **Step 5: Commit** `feat(prontuario): avaliação separada do retorno marcado`.

### Task 2: Retorno na agenda (repositório em memória, Postgres e migração)

**Files:**
- Create: `supabase/migrations/0013_agenda_retornos.sql`
- Modify: `backend/app/contratos/agenda.py` (`Retorno`)
- Modify: `backend/app/agenda/repositorio.py` (Protocol + `RepositorioAgendaMemoria`)
- Modify: `backend/app/agenda/repositorio_postgres.py`
- Test: `backend/tests/test_repositorio_agenda.py` (novo, em memória), `backend/tests/banco/test_repositorio_agenda_postgres.py` (acrescentar; roda onde há banco)

**Interfaces:**
- Produces: `Retorno(ModeloApi)` com `id: UUID`, `paciente_id: UUID`, `paciente_nome: str`, `consulta_origem_id: UUID`, `data: date`, `inicio: str`, `modalidade: Modalidade`.
- Protocol `RepositorioAgenda` ganha: `criar_retorno(medico_id: UUID, paciente_id: UUID, paciente_nome: str, consulta_origem_id: UUID, marcado: RetornoMarcado) -> Retorno` (levanta `HorarioOcupado` se o instante já tem pedido não cancelado ou outro retorno); `retornos(medico_id: UUID, de: date, ate: date) -> list[Retorno]` (ordenado por data/hora); `desfazer_retorno(medico_id: UUID, consulta_origem_id: UUID) -> None`; e `ocupados(...)` passa a incluir os retornos.

- [ ] **Step 1: Testes que falham** (memória): `test_criar_retorno_aparece_em_retornos_e_em_ocupados`; `test_retorno_no_horario_de_pedido_levanta_horario_ocupado`; `test_pedido_no_horario_de_retorno_levanta_horario_ocupado`; `test_dois_retornos_no_mesmo_horario_levantam_horario_ocupado`; `test_desfazer_retorno_libera_o_horario`; `test_retornos_so_do_medico_dono`.
- [ ] **Step 2: Rodar:** `pytest tests/test_repositorio_agenda.py -q` → FAIL.
- [ ] **Step 3: Implementar em memória** seguindo o padrão de `criar_pedido`/`ocupados` do `RepositorioAgendaMemoria`.
- [ ] **Step 4: Migração `0013`:** tabela `public.return_bookings (id uuid pk default gen_random_uuid(), doctor_id uuid not null references doctors, patient_id uuid not null, origin_encounter_id uuid not null unique references encounters(id), scheduled_at timestamptz not null, modality public.modalidade_atendimento not null, created_at timestamptz default now())`, FK composta `(patient_id, doctor_id)` como as outras tabelas do médico, índice único `(doctor_id, scheduled_at)`, os mesmos gatilho de auditoria, RLS e grants do bloco do `0009`. Sem coluna de nome: o nome vem de `patients` na leitura.
- [ ] **Step 5: Implementar no Postgres:** `criar_retorno` e `criar_pedido` tomam `pg_advisory_xact_lock(hashtextextended(doctor_id::text || scheduled_at::text, 0))` e conferem as duas tabelas na mesma transação antes de inserir (o índice único de cada tabela não vê a outra); `UniqueViolation` → `HorarioOcupado`. `ocupados` faz `union all` das duas tabelas. `retornos` junta `patients` para o nome. Teste em `tests/banco/` espelhando os de memória.
- [ ] **Step 6: Rodar** `pytest tests/test_repositorio_agenda.py -q` (e `tests/banco` se houver banco local), `ruff`, `mypy`. Expected: verde.
- [ ] **Step 7: Commit** `feat(agenda): retorno marcado como item da agenda`.

### Task 3: Finalizar com `retornoMarcado`

**Files:**
- Modify: `backend/app/api/prontuario.py` (`Finalizacao`, `finalizar`)
- Modify: `backend/app/agenda/servico.py` (nova `marcar_retorno`)
- Test: `backend/tests/test_api_prontuario.py`

**Interfaces:**
- Consumes: `RetornoMarcado`, `RepositorioAgenda.criar_retorno/desfazer_retorno` (Tasks 1–2).
- Produces: `Finalizacao.retorno_marcado: RetornoMarcado | None = None`; `servico.marcar_retorno(repo, medico, paciente_id, paciente_nome, consulta_id, marcado, agora) -> Retorno` (levanta `ErroAgenda("Esse horário já passou. Escolha outro.")` se `instante(...) <= agora`).

- [ ] **Step 1: Testes que falham** em `test_api_prontuario.py` (usar `consulta_pronta`; o fixture `mundo` já traz a agenda em memória — se `cliente(mundo)` não expõe o repositório da agenda, ajustar `tests/test_api_consultas.py::cliente` para expô-lo, sem mudar o que os outros testes veem): `test_finalizar_com_retorno_cria_cartao_e_grava_dia` (`GET /agenda/retornos` traz 1 item; `dados.retornoMarcado` igual ao enviado); `test_finalizar_sem_retorno_nao_cria_cartao`; `test_finalizar_com_horario_ocupado_e_409_e_consulta_continua_aberta` (ocupa com um pedido; depois `finalizadaEm` é `null` e um 2º Finalizar com outro horário funciona); `test_finalizar_com_horario_no_passado_e_409`; `test_finalizar_duas_vezes_nao_duplica_o_cartao`; `test_finalizar_que_falha_desfaz_o_retorno` (repositório de consultas que levanta no `finalizar`; depois o horário volta a ficar livre).
- [ ] **Step 2: Rodar:** `pytest tests/test_api_prontuario.py -q` → FAIL.
- [ ] **Step 3: Implementar `finalizar`:** nesta ordem — `_proposto` (já falha com 409 se finalizada ou etapa faltando), conferir documentos, aplicar edições; se houver `retorno_marcado`: `marcar_retorno(...)`; então `repo.finalizar(...)` com `dados.model_copy(update={"retorno_marcado": corpo.retorno_marcado})`; se `finalizar` levantar, chamar `desfazer_retorno` e repassar o erro. `ErroAgenda` deve virar 409 nesta rota (hoje o mapa em `app/aplicacao.py` não o cobre — acrescentar o mapeamento sem mudar as rotas públicas: usar `HTTPException(409, str(e))` na própria rota).
- [ ] **Step 4: Rodar** o arquivo e depois `pytest -q`, `ruff check .`, `mypy app`. Expected: verde.
- [ ] **Step 5: Commit** `feat(prontuario): finalizar marca o retorno na agenda`.

### Task 4: Lista de retornos da agenda

**Files:**
- Modify: `backend/app/api/agenda.py`, `backend/openapi.json`
- Test: `backend/tests/test_api_agenda.py`, `backend/tests/test_openapi.py`

**Interfaces:**
- Produces: `GET /agenda/retornos?de=&ate=` → `list[Retorno]` (médico logado; mesmo limite de período de `/agenda/pedidos` via `servico.periodo_valido`).

- [ ] **Step 1: Testes que falham:** `test_retornos_do_periodo` (cria via repositório; só os do médico e do período voltam); `test_retornos_periodo_invalido_e_422_ou_409_como_pedidos` (mesma resposta de `/agenda/pedidos`); `test_openapi_publica_retornos`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar** a rota espelhando `pedidos`. **Step 4: Rodar** tudo (`pytest -q`, `ruff`, `mypy`), regenerar `openapi.json`. **Step 5: Commit** `feat(agenda): lista os retornos marcados`.

### Task 5: Tela — avaliação e linhas finais do prontuário

**Files:**
- Modify: `frontend/src/consulta/conduta-exemplo.ts` (textos das opções do grupo "retorno": `Avaliação em 4 semanas.` etc.; rótulo do grupo e da linha: "Avaliação")
- Modify: `frontend/src/consulta/conduta.ts` (comentários e o que gera a data no fim da frase, se citar "Retorno")
- Modify: `frontend/src/consulta/prontuario.ts` (`retorno` → `avaliacao`; linhas finais)
- Modify: `frontend/src/prontuario/registro.ts` (`DadosEntrada.avaliacao`, `retornoMarcado?: { data: string; inicio: string; modalidade: 'presencial' | 'online' } | null`; `ehEntrada` valida `avaliacao`; exemplos João/Mariana)
- Test: `frontend/src/consulta/prontuario.test.ts`, `frontend/src/consulta/conduta.test.ts`, `frontend/src/prontuario/registro.test.ts`

**Interfaces:**
- Produces: `dadosDaConsulta(...)` aceita `retornoMarcado` e o põe em `DadosEntrada`; `secoesDosDados` termina com a linha `Retorno` = `Sem retorno` quando `retornoMarcado` é `null`/ausente e `Retorno: 05/12/2026 às 14:00, presencial` quando existe (chaves `P.avaliacao` e `P.retorno`).

- [ ] **Step 1: Testes que falham:** em `prontuario.test.ts`, trocar `t['P.retorno']` por `t['P.avaliacao']` com `'em 8 semanas, em 08/01/2027.'` e a frase vinda de `Avaliação em 8 semanas`; `it('termina com "Sem retorno" quando não há retorno marcado')`; `it('termina com o dia, a hora e a modalidade do retorno marcado')` (`{ data: '2026-12-05', inicio: '14:00', modalidade: 'presencial' }` → `'Retorno: 05/12/2026 às 14:00, presencial'`). Em `conduta.test.ts`: o texto da opção `8s` do grupo é `Avaliação em 8 semanas.`.
- [ ] **Step 2: Rodar:** `cd frontend && npx vitest run src/consulta src/prontuario` → FAIL.
- [ ] **Step 3: Implementar** renomeando e acrescentando as duas linhas, mantendo a regra de que linha não colhida some (exceto estas duas). Atualizar os exemplos locais de `registro.ts`.
- [ ] **Step 4: Rodar** `npx vitest run`, `npx tsc -b`, `npm run lint`. Expected: verde.
- [ ] **Step 5: Commit** `feat(tela): avaliação na conduta e linha final do retorno no prontuário`.

### Task 6: Tela — botão Retorno Sim/Não na página 5, agenda e envio no Finalizar

**Files:**
- Modify: `frontend/src/servidor/consulta.ts` (`finalizarConsulta(id, edicoes, retornoMarcado)`)
- Modify: `frontend/src/servidor/agenda.ts` (`retornosDaAgenda(de, ate)` + tipo `RetornoNaAgenda`)
- Create: `frontend/src/consulta/retorno.ts` (estado e regras puras do rascunho) e `frontend/src/consulta/retorno-pagina.tsx` (escolha Sim/Não ao lado de "anexos" + seletor de dia/hora)
- Modify: `frontend/src/consulta/anexos-pagina.tsx` (monta o controle ao lado da lista de anexos), `frontend/src/consulta/pagina-consulta.tsx:~476-500` (estado `retorno`, passa ao prontuário e ao `finalizarConsulta`)
- Test: `frontend/src/consulta/retorno.test.ts`, `frontend/src/consulta/servidor-mapa.test.ts` ou `frontend/src/servidor/consulta.test.ts` (corpo do Finalizar)

**Interfaces:**
- Produces em `retorno.ts`: `type RascunhoRetorno = { escolha: 'nao' } | { escolha: 'sim'; marcado: RetornoMarcado | null }`; `RASCUNHO_INICIAL: RascunhoRetorno = { escolha: 'nao' }`; `retornoParaEnvio(r: RascunhoRetorno): RetornoMarcado | null` (devolve `null` para `nao` e para `sim` sem horário escolhido); `podeSalvarAnexos(r): boolean` (falso para `sim` sem horário).
- O seletor reaproveita `AgendaMedico` (`frontend/src/medico/agenda.tsx`) e `marcarOcupados` (`frontend/src/medico/exemplo.ts`), com os horários ocupados vindos de `pedidosDaAgenda` + `retornosDaAgenda` do período mostrado, em vez da rota pública.

- [ ] **Step 1: Testes que falham** em `retorno.test.ts`: `retornoParaEnvio({escolha:'nao'})` é `null`; `sim` sem horário é `null` e `podeSalvarAnexos` é `false`; `sim` com horário devolve o horário; trocar de `sim` para `nao` descarta o horário (função `escolher(r, 'nao')` devolve `{ escolha: 'nao' }`). Em teste do cliente: o corpo enviado é `{ edicoes, retornoMarcado: null }` quando não há retorno e `{ edicoes, retornoMarcado: { data, inicio, modalidade } }` quando há.
- [ ] **Step 2: Rodar:** `npx vitest run src/consulta/retorno.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `retorno.ts` e o cliente; a página: padrão `Não` (minha escolha, não do autor); `Sim` abre o seletor (dia, hora, online/presencial só se o médico atende online); mostra "Retorno: dd/mm às hh:mm, presencial" depois de escolher; `Salvar anexos` fica desabilitado enquanto `podeSalvarAnexos` for falso. Nos exemplos locais (sem servidor), o controle aparece e o dia entra no prontuário local, sem criar cartão. Erro 409 do Finalizar mostra a mensagem do servidor (já tratada em `salvarProntuario` via `setAviso`) e volta à página 5 com o seletor aberto.
- [ ] **Step 4: Rodar** `npx vitest run`, `npx tsc -b`, `npm run lint`. Expected: verde. Conferir no navegador (skill `run`): Não → prontuário termina com "Sem retorno"; Sim com horário → termina com o dia; horário ocupado → aviso e o prontuário continua aberto. Medir a página 5 em 690 px de altura (regra "uma tela").
- [ ] **Step 5: Commit** `feat(tela): botão Retorno na página 5 e envio no Finalizar`.

### Task 7: Cartão "Retorno" visível na agenda do dia

**Files:**
- Modify: `frontend/src/modulo/pedidos.ts` (nova `atendimentoDoRetorno(r: RetornoNaAgenda, agora: Date): Atendimento`), `frontend/src/modulo/pagina-inicial.tsx` (carrega `retornosDaAgenda` junto com os pedidos e mistura na lista do dia)
- Test: `frontend/src/modulo/pedidos.test.ts`

**Interfaces:**
- Consumes: `retornosDaAgenda`, `RetornoNaAgenda` (Task 6).
- Produces: `atendimentoDoRetorno` devolve `Atendimento` com `tipo: 'retorno'`, `id: 'retorno-<id>'`, `inicio`, `modalidade`, nome do paciente e etiqueta "Retorno" no lugar de "Pedido novo"; **abrir** o cartão fica para a parte 2 (nesta parte o cartão só aparece).

- [ ] **Step 1: Testes que falham:** `atendimentoDoRetorno` mantém hora/modalidade/nome; `tipo === 'retorno'`; ordena junto com pedidos por `ordenarPorHorario`.
- [ ] **Step 2: Rodar** → FAIL. **Step 3: Implementar**; no cartão do dia, a ação "Abrir consulta" não aparece para `retorno-*` (nada quebra; a parte 2 liga). **Step 4: Rodar** `npx vitest run`, `npx tsc -b`, `npm run lint`; conferir no navegador que o cartão aparece no dia marcado. **Step 5: Commit** `feat(tela): cartão Retorno na agenda do dia`.

---

## Auto-revisão

- **Cobertura do design:** botão Sim/Não (T6); Não → "Sem retorno" / Sim → dia (T5, T6); nada gravado até Finalizar (T3, T6); cartão só ao finalizar (T3); horário ocupado recusa sem perder o prontuário (T2, T3); rótulo "Avaliação" (T1, T5); cartão na agenda (T4, T7); idempotência (T3).
- **Fora desta parte:** dias reservados de retorno; abrir o cartão (parte 2).
- **Suposições minhas a confirmar:** (1) padrão do botão é **Não**; (2) tabela própria `return_bookings` em vez de reaproveitar `booking_requests`; (3) registros de prontuário do schema 1 só existem no banco de desenvolvimento (a leitura os aceita, mas nada migra); (4) o seletor mostra os horários livres comuns até o autor definir os dias de retorno.
