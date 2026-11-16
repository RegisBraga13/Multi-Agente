# Página inicial do módulo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/modulo/dermatologia` mostra a agenda do dia do médico, pacientes em ordem de horário, uma linha por paciente com tipo (Consulta/Retorno), modalidade, formulário e link Prontuário.

**Architecture:** Tela React nova em `frontend/src/modulo/`, no mesmo padrão de `frontend/src/medico/`: regras puras testadas (`dia.ts`), dados de exemplo (`exemplo.ts`), tela (`pagina-inicial.tsx`). Cor e nome vêm de `especialidades.ts` pelo slug do endereço.

**Tech Stack:** React 19, TypeScript, Tailwind 4, react-router-dom 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-pagina-inicial-modulo-design.md`

## Global Constraints
- Textos em pt-BR; datas locais (nunca `toISOString`; usar `dataLocal` de `src/medico/exemplo.ts`).
- Cor da especialidade via CSS `--esp` (como `Moldura`); nome via `NomeModulo` de `src/marca.tsx`.
- Sem Topo/Rodapé da landing: é app.
- Tela inteira cabe em ~690 px de altura no PC/tablet (1280×690, 1366×768, 1717×900, 820×1180, 1180×820); celular pode rolar. Linha do paciente não quebra no PC.
- Nada é gravado; sem login.

## Review Focus
1. Dia sem pacientes (domingo, feriado) → mensagem "Nenhum paciente neste dia.", sem lista vazia nem espaço sobrando. Teste em Task 2.
2. Dia passado → todos atendidos e nenhum "próximo"; dia futuro → nenhum atendido e nenhum "próximo". Teste em Task 1 (`proximoPaciente`).
3. Todos atendidos hoje → nenhum destaque. Teste em Task 1.
4. Slug inexistente ou especialidade `em-breve` → página "não encontrada" (`NaoEncontrada`). Verificado em Task 3.
5. Aniversário hoje / ainda não fez → idade correta. Teste em Task 1.

---

### Task 1: Tipos e regras do dia

**Files:**
- Create: `frontend/src/modulo/tipos.ts`, `frontend/src/modulo/dia.ts`
- Test: `frontend/src/modulo/dia.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // tipos.ts — no formato da futura tabela appointments
  export type TipoAtendimento = 'consulta' | 'retorno'
  export type Atendimento = {
    id: string
    inicio: string                 // 'HH:MM'
    paciente: { nome: string; nascimento: string /* 'YYYY-MM-DD' */ }
    tipo: TipoAtendimento
    modalidade: Modalidade         // de src/medico/tipos.ts
    formulario: 'preenchido' | 'pendente'
    atendido: boolean
    temHistorico: boolean          // mostra o link Prontuário
  }
  // dia.ts
  export function ordenarPorHorario(lista: Atendimento[]): Atendimento[]   // nova lista, não muta
  export function idade(nascimento: string, em: Date): number
  export function proximoPaciente(lista: Atendimento[], ehHoje: boolean): string | null  // id
  export function dataPorExtenso(data: string): string   // 'Segunda, 16 de novembro'
  export function somarDias(data: string, n: number): string  // 'YYYY-MM-DD'
  ```

- [ ] **Step 1: Testes que falham** (`dia.test.ts`)
  - `ordenarPorHorario`: entrada `['10:30','08:00','09:00']` → `['08:00','09:00','10:30']`; a lista original fica igual.
  - `idade('1992-11-16', new Date(2026,10,16))` → 34; `idade('1992-11-17', new Date(2026,10,16))` → 33.
  - `proximoPaciente`: lista ordenada com 08:00 atendido, 08:30 e 09:00 não → id de 08:30; todos atendidos → `null`; `ehHoje=false` → `null`.
  - `dataPorExtenso('2026-11-16')` → `'Segunda, 16 de novembro'`; `'2026-11-21'` → `'Sábado, 21 de novembro'`.
  - `somarDias('2026-11-30', 1)` → `'2026-12-01'`; `somarDias('2026-11-16', -1)` → `'2026-11-15'`.
- [ ] **Step 2:** `npx vitest run src/modulo/dia.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `tipos.ts` e `dia.ts`. `proximoPaciente` = primeiro não atendido em ordem de horário (sem olhar o relógio). Datas construídas com `new Date(a, m-1, d)` (local).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** `git add frontend/src/modulo && git commit -m "Módulo: tipos e regras da agenda do dia"`

### Task 2: Dados de exemplo

**Files:**
- Create: `frontend/src/modulo/exemplo.ts`
- Test: `frontend/src/modulo/exemplo.test.ts`

**Interfaces:**
- Consumes: `Atendimento`, `dataLocal` (de `src/medico/exemplo.ts`), `MEDICO_EXEMPLO` (Dra. Ana Souza, dermatologia).
- Produces: `export function agendaDoDia(data: string, agora: Date): Atendimento[]` — já ordenada.

- [ ] **Step 1: Testes que falham**
  - Domingo (`'2026-11-22'`) → `[]`.
  - Segunda `'2026-11-16'` com `agora = new Date(2026,10,16,10,0)` → 9 atendimentos, ordenados; os com `inicio` < '10:00' têm `atendido: true`, os demais `false`; há ao menos um `retorno`, um `online`, um `pendente`; todo `retorno` tem `temHistorico: true`.
  - Dia anterior a hoje → todos `atendido: true`; dia posterior → todos `false`.
  - Mesma data → mesma lista (determinística, sem `Math.random`).
- [ ] **Step 2:** `npx vitest run src/modulo/exemplo.test.ts` → FAIL.
- [ ] **Step 3:** Lista fixa de 9 pacientes fictícios (horários 08:00–11:30 e 14:00–16:00, nomes variados); varia a ordem/subconjunto por dia da semana para trocar de dia parecer real (sábado: só manhã, ~4). `atendido` = data < hoje, ou data = hoje e `inicio` < hora atual.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "Módulo: agenda de exemplo"`

### Task 3: Tela e rota

**Files:**
- Create: `frontend/src/modulo/pagina-inicial.tsx`
- Modify: `frontend/src/App.tsx` (rota `/modulo/:slug`), `frontend/vite.config.ts` (`ROTAS_DO_APP` += `'/modulo'`)

**Interfaces:**
- Consumes: Task 1 e 2; `buscarEspecialidade`, `NomeModulo`, `NaoEncontrada`, `MEDICO_EXEMPLO`.
- Produces: `export function PaginaInicialModulo()`.

- [ ] **Step 1:** Tela:
  - Especialidade inexistente ou `status !== 'disponivel'` → `<NaoEncontrada />`.
  - Cabeçalho numa linha: `NomeModulo` · "Dra. Ana Souza" · `dataPorExtenso(dia)` com botões ‹ e › (`somarDias`) e "Hoje" (só aparece fora de hoje). `document.title = 'dermatologIA · Agenda'`.
  - Lista (`<ol>`), uma linha por atendimento: horário · nome, idade ("34 a") · etiqueta Consulta (fundo `--esp`, texto papel) / Retorno (borda `--esp`) · Presencial/Online · "✓ formulário" / "○ formulário" · link "Prontuário" se `temHistorico`. Atendido: opacidade reduzida + "Atendido". Próximo: realce na cor da especialidade (borda esquerda) + rótulo "Próximo".
  - Clique/Enter na linha → aviso curto (`role="status"`): "O atendimento é a próxima etapa do módulo." Link Prontuário → mesmo aviso, com "prontuário".
  - Dia vazio → "Nenhum paciente neste dia."
- [ ] **Step 2:** Rota e `ROTAS_DO_APP`. `npm run build` → sem erro; `npm test` → tudo PASS; `npm run lint` limpo.
- [ ] **Step 3:** Medir com Chrome headless (CDP) em 1280×690, 1366×768, 1717×900, 820×1180, 1180×820: base do último elemento ≤ altura da janela e `scrollWidth ≤ innerWidth`; prints em 1280×690 e 820×1180. Ajustar até passar.
- [ ] **Step 4:** `git commit -m "Módulo: página inicial com a agenda do dia"`
