# Consulta — página 1 (Anamnese e exame) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A consulta abre a partir da página inicial do módulo e mostra a página 1 (anamnese à esquerda, exame à direita, cada um com Oficializar), com topo, navegador das 4 etapas e painel de Anexos, tudo cabendo em ~690 px.

**Architecture:** Pasta nova `frontend/src/consulta/`. Regras puras (estados das etapas, gating, "desatualizado", sinais de alerta) em `etapas.ts`, testadas com vitest; conteúdo de exemplo em `exemplo.ts` (gerado a partir da ficha do paciente da agenda + rascunhos por paciente); telas em `.tsx`. Estado da consulta em `useReducer` na página (só memória, dados de exemplo). Páginas 2–4 existem no navegador e mostram o estado de bloqueio/próxima entrega.

**Tech Stack:** React 19 + TS + Tailwind 4 + react-router-dom 7 + vitest (o que o projeto já usa).

**Spec:** `docs/superpowers/specs/2026-11-16-consulta-design.md`

## Global Constraints
- Endereço `/modulo/:slug/consulta/:atendimento/:etapa`, etapas `anamnese-exame` · `historia` · `diagnosticos` · `conduta`.
- Estados: `rascunho_ia` → `revisado_medico` → `oficializado`; mais `desatualizado` (derivado) e `bloqueado` (IA aguardando a etapa anterior).
- Só tokens de `index.css`; cor da especialidade via `--esp` + classe `cor-esp`; alergia em bloco cheio `bg-alerta-clinico text-branco`.
- Sugestão da IA = borda tracejada `border-(--esp-medio)`; confirmado pelo médico = borda cheia.
- Topo: só o nome do módulo; especIAlista no rodapé. Sem rolagem dentro de cartões; cabe em 1280×690, 1366×768, 1717×900, 820×1180, 1180×820 (celular pode rolar).
- Textos curtos, em português; nada de "IA decide" — tudo espera o clique do médico.

## Review Focus
1. Paciente sem ficha ou com transcrição recusada → gravar desabilitado com motivo; modo "escrever" disponível (teste em `etapas.test.ts`: `podeGravar`).
2. Endereço com atendimento ou etapa inexistente → página "não encontrada", sem quebrar (teste `buscarAtendimento` devolve `undefined`).
3. Editar a anamnese depois de oficializar → história, DD e conduta já oficializadas ficam `desatualizado` (teste `editar`).
4. Oficializar anamnese com sinal de alerta sem resposta → botão bloqueado com "Falta avaliar N sinais" (teste `pendenciasAnamnese`).
5. Exame complementar com valor `MISSING` → mostra "não encontrado no laudo", nunca um número inventado (teste em `exemplo.test.ts`).

---

### Task 1: Tipos e regras das etapas

**Files:** Create `src/consulta/tipos.ts`, `src/consulta/etapas.ts`, Test `src/consulta/etapas.test.ts`

**Interfaces — Produces:**
- `type EtapaId = 'anamnese-exame' | 'historia' | 'diagnosticos' | 'conduta'`; `ETAPAS: { id: EtapaId; rotulo: string; curto: string }[]` (rótulos: "Anamnese e exame", "História clínica", "Diagnósticos", "Conduta e tratamento").
- `type Bloco = 'anamnese' | 'exame' | 'historia' | 'diagnosticos' | 'conduta'` (página 1 tem dois blocos).
- `type Estado = 'rascunho_ia' | 'revisado_medico' | 'oficializado'`; `type Situacao = Estado | 'desatualizado' | 'bloqueado'`.
- `type Proveniencia = 'relatado' | 'observado' | 'inferido_ia' | 'confirmado'`.
- `type Extraido<T> = { status: 'PRESENT'; valor: T; origem: string } | { status: 'INFERRED'; valor: T; origem: string; aviso: string } | { status: 'MISSING'; valor: null }`.
- `type EstadoConsulta = { blocos: Record<Bloco, { estado: Estado; desatualizado: boolean }>; alertas: Record<string, 'avaliado' | 'nao-se-aplica' | null> }`.
- `inicial(alertas: string[]): EstadoConsulta` — anamnese/exame `rascunho_ia`; demais `rascunho_ia` sem conteúdo.
- `oficializar(e, bloco): EstadoConsulta` — vira `oficializado`, limpa `desatualizado` do próprio bloco.
- `editar(e, bloco): EstadoConsulta` — vira `revisado_medico`; se estava `oficializado`, marca `desatualizado` nos blocos seguintes que estavam oficializados (ordem: anamnese, exame → historia → diagnosticos → conduta; anamnese e exame alimentam a história).
- `responderAlerta(e, id, r)`; `pendenciasAnamnese(e): number` (alertas sem resposta).
- `situacaoDaEtapa(e, etapa): Situacao` — `anamnese-exame` = o menos avançado dos dois blocos; `historia` é `bloqueado` até anamnese **e** exame oficializados; `diagnosticos` até história; `conduta` até diagnósticos; `desatualizado` vence `oficializado`.
- `podeGravar(ficha: Ficha): boolean` — só com ficha `pronta` e `transcricao === 'aceita'`.

- [ ] Step 1: testes: `inicial` → página 1 `rascunho_ia`, história `bloqueado`; oficializar só anamnese → história segue `bloqueado`; oficializar os dois → história `rascunho_ia`; com tudo oficializado, `editar(e,'anamnese')` → anamnese `revisado_medico`, história/diagnósticos/conduta `desatualizado`; `pendenciasAnamnese` conta 2 → responde 1 → 1; `podeGravar` falso para `link-enviado`, `sem-ficha` e `transcricao: 'recusada'`.
- [ ] Step 2: `npx vitest run src/consulta` → FAIL. Step 3: implementar. Step 4: PASS.

### Task 2: Conteúdo de exemplo

**Files:** Create `src/consulta/exemplo.ts`, Test `src/consulta/exemplo.test.ts`

**Interfaces — Consumes:** `agendaDoDia` (modulo/exemplo), `Atendimento`, tipos da Task 1. **Produces:**
- `buscarAtendimento(id: string, agora: Date): Atendimento | undefined` — id `YYYY-MM-DD-HH:MM`; data = 10 primeiros caracteres.
- `type Fala = { quem: 'Médico' | 'Paciente'; texto: string; aos: string /* 'mm:ss' */ }`
- `type Alerta = { id: string; texto: string }`; `type CampoExame = { rotulo: string; valor: string; prov: Proveniencia }`
- `type Complementar = { exame: string; data: string; itens: { nome: string; v: Extraido<string> }[] }`
- `conteudoDaConsulta(at: Atendimento, slug: string): { falas: Fala[]; faltouPerguntar: string[]; alertas: Alerta[]; fotos: number; exame: CampoExame[]; complementares: Complementar[] }`
  - falas: geradas da ficha (queixa → "Paciente"; em uso, antecedentes, alergias) + 2 falas do exame; sem ficha → falas curtas genéricas.
  - alertas: um por alergia ("Alergia a X na ficha") + por paciente (Carlos: lesão pigmentada que mudou; Antônio: ferida que não cicatriza > 4 semanas).
  - exame: campos de Dermatologia (Morfologia, Localização, Extensão, Gravidade estimada, Achados associados) com rascunho por paciente, `prov: 'inferido_ia'`; outra especialidade → mesmos rótulos vazios (pacote só de Dermatologia por enquanto).
  - complementares: Carlos (glicemia/HbA1c, um `INFERRED`), Antônio (biópsia anterior com um item `MISSING`), demais vazio.

- [ ] Step 1: testes: `buscarAtendimento('2026-11-16-08:00', …)` acha; `'xyz'` → `undefined`; todo paciente da agenda de 16/11 tem 5 campos de exame e ≥ 3 falas; paciente com alergia gera alerta; item `MISSING` tem `valor === null`; `INFERRED` tem `aviso`.
- [ ] Step 2–4: FAIL → implementar → PASS.

### Task 3: Página da consulta (estrutura comum + página 1 + Anexos)

**Files:** Create `src/consulta/pagina-consulta.tsx` (rota, topo, navegador, rodapé, Anexos, páginas 2–4 bloqueadas), `src/consulta/anamnese.tsx`, `src/consulta/exame.tsx`; Modify `src/App.tsx` (rota), `src/modulo/pagina-inicial.tsx` (cartão Consulta → `/modulo/<slug>/consulta/<próximo ou selecionado>/anamnese-exame`; sem paciente → aviso "Nenhum paciente a seguir hoje").

- Topo (uma linha): `NomeModulo` · nome, idade · Consulta/Retorno · Presencial/Online · alergia (bloco cheio) · botão **Anexos**.
- Navegador: 4 etapas numeradas em uma linha, atual marcada (fundo `--esp`), situação escrita pequena (Rascunho · Revisado · Oficializado · Desatualizado · Aguardando etapa anterior).
- Anamnese: gravar/pausar + relógio (segundos correm só gravando); sem consentimento → aviso + "Escrever"; últimas falas que cabem + "Ver tudo (N)" abrindo painel por cima; "Faltou perguntar"; sinais de alerta com **Avaliado** / **Não se aplica**; **Oficializar anamnese** (bloqueado com "Falta avaliar N").
- Exame: abas Exame físico | Complementares; fotos numeradas (quadros `suave`, foto real só em `acne-exemplo.jpg` para queixa de espinhas) + "Adicionar"; campos editáveis tracejados até editar/oficializar; complementares com PRESENT/INFERRED (aviso) /MISSING ("não encontrado no laudo"); **Oficializar exame**.
- Páginas 2–4: cartão com a situação; bloqueada → "Oficialize anamnese e exame para a IA montar a história"; liberada → "Próxima entrega".
- Anexos: painel por cima com Receita · Orientações · Atestado · Pedido de exames · Encaminhamento · Laudo; cada um "disponível após a conduta" (visual).

- [ ] Step 1: `npm run build` e `npm run lint` sem erro; `npx vitest run` tudo PASS.
- [ ] Step 2: medir com Chrome headless (script `medir.mjs` do scratchpad) em 1280×690, 1366×768, 1717×900, 820×1180, 1180×820: base ≤ altura e largura sem vazar; olhar os prints. Ajustar até passar.
- [ ] Step 3: commit no branch `consulta` só quando o autor pedir.
