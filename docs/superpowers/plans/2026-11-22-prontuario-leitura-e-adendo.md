# Prontuário lido do servidor + adendo (parte F2) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a janela do prontuário, a lista de prontuários e o retorno passam a ler as entradas finalizadas do **servidor**; cada entrada finalizada ganha o botão **Adendo**: abre uma janela, o médico escreve, sai, e fica registrado com data e hora (só o texto; sem motivo).

**Architecture:** o servidor já finaliza (parte F), guarda adendos (`POST /consultas/{id}/adendos`) e devolve `GET /pacientes/{id}/prontuario`. Faltam: aceitar o adendo só com o texto e uma rota que lista os pacientes com prontuário. No frontend, as entradas do servidor são **somadas** às locais (exemplos e retornos simulados) por funções puras; a consulta real deixa de gravar a cópia local.

**Tech Stack:** FastAPI + Pydantic + pytest (servidor); React + TypeScript + vitest (tela).

**Spec:** [ADR 0005](../../decisoes/0005-consulta-no-servidor.md), [plano F](2026-11-22-prontuario-no-servidor.md); regras 13 e 3 em `docs/regras-do-autor.md`.

## Global Constraints

- **Entrada finalizada nunca muda; só recebe adendo** (o servidor já garante). Adendo salvo não se edita: correção = novo adendo.
- Adendo leva **só o texto** (obrigatório); a data e a hora vêm do servidor (`data_hora_br`), nunca da tela.
- **Nenhuma mudança visual** além do botão Adendo e da caixa; a janela segue uma coluna que rola (regra 13).
- Só **consulta real** (pedido do servidor) usa o servidor. Exemplos (João, Antônio, Mariana) e retornos simulados continuam locais, sem botão Adendo.
- A consulta real **não grava mais cópia local** ao finalizar; o paciente real é lido do servidor (`GET /pacientes/{id}`).
- Não tocar nas alterações locais ainda não commitadas do autor (demonstração da Mariana: `chave.ts`, `exemplo.ts`, `dia.ts`, `pagina-inicial.tsx`, `anamnese.tsx`); `registro.ts` só recebe edições pontuais.
- Servidor fora do ar: a tela mostra os locais e avisa em linguagem simples; nada é inventado.
- Privacidade: nada de nome de paciente em log.

## Review Focus

- Servidor fora do ar na janela e na lista: aparecem os locais + aviso "Não foi possível ler o prontuário do servidor."; sem erro de tela.
- Adendo sem texto (só espaços): não envia, a janela avisa.
- Adendo em consulta ainda aberta (409 do servidor): mensagem simples, nada some.
- Enviar o adendo duas vezes seguidas: botão desabilitado durante o envio; só o que foi confirmado pelo servidor aparece.
- Paciente com entrada do servidor **e** retorno local: as duas aparecem, ordenadas, sem duplicar (mesmo `id`).
- Paciente de outro médico ou inexistente na janela: "não encontrada", sem vazar dados.
- Retorno de paciente real: usa as entradas do servidor (diagnóstico e exame anteriores), não o vazio.

---

## File Structure

- `backend/app/api/prontuario.py` (modificar): `NovoAdendo` só com `texto`.
- `backend/app/consulta/repositorio.py`, `repositorio_postgres.py` (modificar): `pacientes_com_prontuario`.
- `backend/app/api/prontuario.py` (modificar): rota `GET /prontuarios`.
- `backend/app/contratos/prontuario.py` (modificar): `PacienteComProntuario`.
- `frontend/src/servidor/consulta.ts` (modificar): `adicionarAdendo`, `prontuariosDoMedico`, `pacienteDoServidor`.
- `frontend/src/prontuario/juntar.ts` (criar): `juntarEntradas`, `juntarPacientes` (puras).
- `frontend/src/prontuario/janela-prontuario.tsx`, `lista-prontuarios.tsx` (modificar); `frontend/src/prontuario/adendo.tsx` (criar): botão e caixa.
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): sem cópia local na consulta real; entradas somadas no retorno.

---

### Task 1: Servidor — adendo só com o texto

**Files:** `backend/app/api/prontuario.py`; testes `backend/tests/test_api_prontuario.py`.

**Interfaces:** Produces: `POST /consultas/{id}/adendos {texto}` (201); o motivo gravado é a constante `MOTIVO_PADRAO = "adendo do médico"` (a coluna `reason` do banco é obrigatória; nenhuma migration nova).

- [ ] **Step 1: Write the failing tests:** em `test_api_prontuario.py`, `POST .../adendos {texto:'Biópsia confirmou.'}` (sem `motivo`) devolve 201 e o prontuário traz o adendo com `quando` e `texto`; texto só com espaços devolve 422; antes de finalizar devolve 409.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest -q tests/test_api_prontuario.py` (em `backend`) — Expected: FAIL (422 por falta de `motivo`).
- [ ] **Step 3: Implement** `NovoAdendo` só com `texto: str = Field(min_length=1)` (rejeitar texto só de espaços) e passar `MOTIVO_PADRAO` ao repositório. Ajustar os testes antigos que enviam `motivo`.
- [ ] **Step 4: Run** `pytest -q`, `ruff check .`, `mypy app` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: o adendo pede só o texto"`

### Task 2: Servidor — lista dos pacientes com prontuário

**Files:** `backend/app/contratos/prontuario.py`, `backend/app/consulta/repositorio.py`, `repositorio_postgres.py`, `backend/app/api/prontuario.py`; testes nos mesmos arquivos da Task 1.

**Interfaces:** Produces: `RepositorioConsultas.pacientes_com_prontuario(medico_id: UUID) -> list[UUID]` (pacientes do médico com ≥1 consulta finalizada); `PacienteComProntuario(id: UUID, nome: str, nascimento: date, entradas: int, ultima: date)`; `GET /prontuarios -> list[PacienteComProntuario]`, mais recente primeiro, depois nome.

- [ ] **Step 1: Write the failing tests:** (a) sem consulta finalizada, lista vazia; (b) duas consultas finalizadas do mesmo paciente → um item com `entradas == 2` e `ultima` da mais recente; (c) consulta aberta não conta; (d) paciente de outro médico não aparece.
- [ ] **Step 2: Run** `pytest -q backend/tests/test_api_prontuario.py` — Expected: FAIL (404 na rota).
- [ ] **Step 3: Implement** o método (memória: ids das consultas com `finalizada_em`; Postgres: `select distinct patient_id from encounters where finalized_at is not null` sob RLS) e a rota: para cada id, `dep.pacientes.buscar` (nome e nascimento) e `dep.repo.prontuario` (contagem e data). Registrar a rota **antes** de qualquer rota com `{...}` que a capture.
- [ ] **Step 4: Run** `pytest -q`, `ruff check .`, `mypy app` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: lista dos pacientes com prontuário"`

### Task 3: Cliente do servidor e funções puras de junção

**Files:** `frontend/src/servidor/consulta.ts`, `frontend/src/prontuario/juntar.ts`; testes `frontend/src/servidor/consulta.test.ts`, `frontend/src/prontuario/juntar.test.ts`.

**Interfaces:** Produces: `adicionarAdendo(consultaId: string, texto: string): Promise<void>` (POST `/consultas/<id>/adendos`); `prontuariosDoMedico(): Promise<PacienteServidor[]>` (GET `/prontuarios`; `PacienteServidor = { id: string; nome: string; nascimento: string; entradas: number; ultima: string }`); `pacienteDoServidor(id: string): Promise<{ id: string; nome: string; nascimento: string }>` (GET `/pacientes/<id>`); `juntarEntradas(locais: EntradaProntuario[], servidor: EntradaProntuario[]): EntradaProntuario[]` (sem repetir `id`, a do servidor vence, mais recente no topo); `juntarPacientes(locais: PacienteComProntuario[], servidor: PacienteServidor[]): PacienteComProntuario[]` (mesmo `id`: soma `entradas`, maior `ultima`, nome do servidor).

- [ ] **Step 1: Write the failing tests:** `juntarEntradas` com um `id` repetido devolve uma só (a do servidor); ordena por data+hora decrescente; lista vazia de um lado devolve o outro. `juntarPacientes`: paciente só local, só do servidor e nos dois (soma e maior data). `adicionarAdendo` envia `{texto}` por POST ao endereço certo (com `fetch` simulado, como os testes existentes do cliente).
- [ ] **Step 2: Run** `npm test -- src/prontuario/juntar.test.ts src/servidor/consulta.test.ts` (em `frontend`) — Expected: FAIL.
- [ ] **Step 3: Implement** as três chamadas (reaproveitar `chamar`, que já trata 204) e as duas funções puras.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do prontuário e junção de entradas"`

### Task 4: Janela, lista e Adendo na tela

**Files:** `frontend/src/prontuario/janela-prontuario.tsx`, `lista-prontuarios.tsx`, `frontend/src/prontuario/adendo.tsx` (criar); teste `frontend/src/prontuario/adendo.test.tsx` (se o projeto já testa componentes; senão a regra de validação fica numa função pura `adendoValido(texto): boolean` em `juntar.ts`, testada em `juntar.test.ts`).

**Interfaces:** Consumes: Task 3. Produces: `adendoValido(texto: string): boolean` (texto não vazio após `trim`).

- [ ] **Step 1: Write the failing test:** `adendoValido('')` e `('   ')` falsos; `('Ajuste de dose')` verdadeiro.
- [ ] **Step 2: Run** esse teste — Expected: FAIL.
- [ ] **Step 3: Implement.** Janela: ao abrir (e no `focus`), lê `prontuarioDoPaciente(id)` e soma com `entradas(id)` por `juntarEntradas`; o cadastro vem do local ou de `pacienteDoServidor`; falha do servidor → locais + aviso simples; paciente inexistente nos dois → `NaoEncontrada`. Cada entrada **vinda do servidor** mostra "Adendo" (abre uma janela sobre a página com uma caixa de **Texto**, "Salvar adendo"/"Sair"; sair sem salvar descarta); salvar → `adicionarAdendo` → recarrega a lista; falha mostra a mensagem do servidor (ou "Não foi possível salvar o adendo. Tente de novo."). Adendos aparecem sob a entrada: "Adendo · {quando}" e o texto. Lista: `juntarPacientes(pacientesComProntuario(), await prontuariosDoMedico())`, com aviso se o servidor falhar.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npx eslint src` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: janela e lista leem o prontuário do servidor; botão Adendo"`

### Task 5: Consulta real sem cópia local e retorno com o servidor

**Files:** `frontend/src/consulta/pagina-consulta.tsx`.

**Interfaces:** Consumes: Tasks 3–4. Regra: só quando `servidor` existe (consulta real) ou o paciente veio do servidor (`doServidor`).

- [ ] **Step 1: Write the failing test:** `juntarEntradas` já coberto na Task 3; aqui não há teste de componente. Acrescentar em `juntar.test.ts` o caso `retorno_enxerga_consulta_do_servidor`: `juntarEntradas([], [consultaDoServidor]).find((e) => e.tipo === 'consulta')` existe (é o que o retorno usa).
- [ ] **Step 2: Run** esse teste — Expected: PASS (documenta o contrato do retorno).
- [ ] **Step 3: Implement.** `concluirProntuario`: com `servidor`, **não** chamar `salvarEntrada`. Em `Consulta`, para paciente real (`servidor` ou pedido do servidor), carregar `prontuarioDoPaciente(at.paciente.id)` uma vez e trocar as quatro leituras de `entradas(at.paciente.id)` por `juntarEntradas(entradas(at.paciente.id), doServidor)`; sem resposta ainda, só os locais.
- [ ] **Step 4: Verify:** `npm test`, `npx tsc -b`, `npx eslint src`, `pytest -q` (backend), `ruff`, `mypy` passam. Na tela (Docker `IA_PROVEDOR=demonstracao`, `npx vite --port 5191`, Chrome headless): criar pedido com nome comum, percorrer até finalizar; abrir a janela do prontuário do paciente → a entrada aparece vinda do servidor (conferir que **não** há chave local `especialista:prontuario:<id>`); clicar Adendo, escrever o texto, salvar → aparece com data e hora; recarregar → continua; conferir no banco (`select text, created_at from addenda`); abrir a lista de Prontuários → o paciente aparece com "1 entrada". Medir a janela e mostrar prints ao autor. **Apagar os dados de teste** (`docker compose down -v` e `up`).
- [ ] **Step 5: Commit** `"Tela: a consulta real não grava cópia local; retorno lê o servidor"`

---

## Fora deste plano (decidido)

- **Adendo em entrada local** (exemplos e retornos simulados): sem botão; nascem junto com o retorno no servidor, em plano futuro.
- **Login e segurança (CFM)** antes de paciente real; **migrations 0011/0012 no Supabase** (só com ok do autor).
- Retorno **gravado** no servidor (hoje simulado) e fotos do exame físico.
