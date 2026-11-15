# Página do médico (entrada do paciente) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página `/medico/ana-souza`, clicável e com dados de exemplo, onde o paciente escolhe modalidade, dia e horário, informa contato, responde sobre a transcrição e escolhe como preencher o formulário.

**Architecture:** Nova pasta `frontend/src/medico/` no app React já existente (`app.html`). Regras (agenda de exemplo, validações) em funções puras com testes Vitest, como em `src/cadastro/`; telas em componentes React + Tailwind usando os tokens de `src/index.css`. Nada é gravado nem enviado.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind 4, react-router-dom 7.18, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-11-15-pagina-do-medico-design.md`

## Global Constraints

- Visual da landing: Source Serif 4 nos títulos (`font-titulo`), Inter no texto, fundo de papel (já no `body`), cantos retos (já global), rótulos em maiúsculas com `tracking-[.14em]`.
- Cor da especialidade: `--esp` = `#A85A2E` (dermatologia, de `especialidades.ts`) aplicado no elemento raiz da página; todo destaque usa `var(--esp)`.
- Sem a `Moldura` do especIAlista: a página é do médico. Marca só no rodapé, pequena: "Agendamento com especIAlista".
- RQE opcional: só aparece se existir. Nenhuma regra de publicidade do CFM é aplicada.
- Nome e WhatsApp sempre obrigatórios para enviar o pedido. Recusar a transcrição nunca bloqueia.
- Sem CPF. Nada gravado, nada enviado: a tela diz o que vai acontecer.
- Celular primeiro (360 px sem rolagem horizontal); a partir de 768 px (`md:`) o painel do agendamento fica ao lado da agenda; abaixo disso ocupa a tela.
- Textos curtos, em português, no tom da landing.

## Review Focus

1. Página aberta à noite (ex.: 23:30): a agenda começa amanhã pela data local, nunca mostra hoje nem um dia vencido. → teste em Task 1.
2. Paciente troca a modalidade depois de escolher um horário que não existe na outra: o horário escolhido é limpo, não fica um pedido inválido. → teste em Task 1 (`horarioExiste`) e uso em Task 3.
3. WhatsApp digitado de vários jeitos (`+55`, parênteses, traço, espaços) é aceito; telefone fixo e números curtos são recusados com mensagem clara. → teste em Task 2.
4. Paciente volta um passo no painel: o que já digitou continua lá. → conferido na Task 4 (estado único do rascunho no painel).
5. Foto da pré-consulta grande ou que não é imagem: recusada com aviso, sem travar o formulário. → teste em Task 2 (`validarFoto`).

---

### Task 1: Tipos e agenda de exemplo

**Files:**
- Create: `frontend/src/medico/tipos.ts`
- Create: `frontend/src/medico/exemplo.ts`
- Test: `frontend/src/medico/exemplo.test.ts`
- Add (commit junto): `docs/superpowers/specs/2026-11-15-pagina-do-medico-design.md`, este plano

**Interfaces:**
- Produces (`tipos.ts`):
  - `type Modalidade = 'presencial' | 'online'`
  - `type Medico = { slug: string; nome: string; tratamento: 'Dra.' | 'Dr.'; especialidade: string /* slug */; crm: string; uf: string; rqe?: string; foto?: string; endereco: string; cidade: string; atendeOnline: boolean; whatsappConsultorio: string }`
  - `type Horario = { inicio: string /* 'HH:MM' */; livre: boolean }`
  - `type DiaAgenda = { data: string /* 'YYYY-MM-DD' */; horarios: Horario[] }`
  - `type Agenda = Record<Modalidade, DiaAgenda[]>`
- Produces (`exemplo.ts`):
  - `MEDICO_EXEMPLO: Medico` — slug `ana-souza`, `Dra.`, Ana Souza, `dermatologia`, CRM `12345`, UF `CE`, sem RQE, endereço e cidade de exemplo (Fortaleza), `atendeOnline: true`.
  - `gerarAgenda(hoje: Date): Agenda`
  - `horarioExiste(agenda: Agenda, modalidade: Modalidade, data: string, inicio: string): boolean` (existe e está livre)
  - `buscarMedico(slug: string): Medico | undefined`

Regras da agenda de exemplo: 14 dias a partir de **amanhã** (data local); domingo sem horário; presencial seg–sex 08:00–11:30 e sáb 08:00–10:30, a cada 30 min; online seg–qui 18:00–20:30, a cada 30 min; um horário a cada três (pelo índice dentro do dia, `i % 3 === 1`) fica ocupado. Dias sem horário não entram na lista.

- [ ] **Step 1: Escrever os testes**

```ts
describe('gerarAgenda', () => {
  it('começa amanhã, mesmo tarde da noite', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 23, 30)) // seg 16/11
    expect(a.presencial[0].data).toBe('2026-11-17')
  })
  it('não tem domingo e cobre 14 dias', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const datas = [...a.presencial, ...a.online].map((d) => d.data)
    expect(datas).not.toContain('2026-11-22') // domingo
    expect(datas.every((d) => d >= '2026-11-17' && d <= '2026-11-30')).toBe(true)
  })
  it('sábado só presencial, de manhã', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const sab = a.presencial.find((d) => d.data === '2026-11-21')!
    expect(sab.horarios.map((h) => h.inicio)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30'])
    expect(a.online.find((d) => d.data === '2026-11-21')).toBeUndefined()
  })
  it('online seg–qui à noite, com horários ocupados', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    const ter = a.online.find((d) => d.data === '2026-11-17')!
    expect(ter.horarios[0]).toEqual({ inicio: '18:00', livre: true })
    expect(ter.horarios[1].livre).toBe(false)
    expect(a.online.find((d) => d.data === '2026-11-20')).toBeUndefined() // sexta
  })
})
describe('horarioExiste', () => {
  it('só vale para horário livre da mesma modalidade', () => {
    const a = gerarAgenda(new Date(2026, 10, 16, 9, 0))
    expect(horarioExiste(a, 'presencial', '2026-11-17', '08:00')).toBe(true)
    expect(horarioExiste(a, 'presencial', '2026-11-17', '08:30')).toBe(false) // ocupado
    expect(horarioExiste(a, 'online', '2026-11-17', '08:00')).toBe(false)     // outra modalidade
  })
})
describe('buscarMedico', () => {
  it('acha a médica de exemplo e recusa slug desconhecido', () => {
    expect(buscarMedico('ana-souza')?.crm).toBe('12345')
    expect(buscarMedico('nao-existe')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**
Run: `cd frontend; npx vitest run src/medico/exemplo.test.ts` — Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `tipos.ts` e `exemplo.ts`** com as interfaces acima. Datas formatadas a partir de `getFullYear/getMonth/getDate` (local), nunca `toISOString()`.

- [ ] **Step 4: Rodar e ver passar** — mesmo comando, Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/medico docs/superpowers
git commit -m "Página do médico: design, plano, tipos e agenda de exemplo"
```

---

### Task 2: Regras do agendamento

**Files:**
- Create: `frontend/src/medico/regras.ts`
- Test: `frontend/src/medico/regras.test.ts`

**Interfaces:**
- Consumes: `Modalidade` (Task 1).
- Produces:
  - `type FormaFormulario = 'whatsapp' | 'pagina' | 'consulta'`
  - `type Transcricao = 'aceita' | 'recusada'`
  - `type RascunhoPedido = { modalidade: Modalidade; data: string | null; inicio: string | null; nome: string; whatsapp: string; transcricao: Transcricao | null; forma: FormaFormulario | null }`
  - `type ErrosPedido = Partial<Record<'horario' | 'nome' | 'whatsapp' | 'transcricao' | 'forma', string>>`
  - `normalizarWhatsapp(texto: string): string | null` → `'55' + DDD + 9 dígitos`, ou `null`
  - `validarContato(r: Pick<RascunhoPedido, 'nome' | 'whatsapp'>): ErrosPedido`
  - `validarPedido(r: RascunhoPedido): ErrosPedido`
  - `type DadosPessoais = { nomeCompleto: string; nascimento: string /* YYYY-MM-DD */; sexo: 'F' | 'M' | 'outro' | ''; whatsapp: string; email: string; cidade: string; uf: string }`
  - `type PreConsulta = { queixa: string; desdeQuando: string; medicamentos: string; alergias: string }`
  - `validarDadosPessoais(d: DadosPessoais, hoje: Date): Partial<Record<keyof DadosPessoais, string>>`
  - `validarFoto(f: { type: string; size: number }): string | null` (mensagem de erro ou `null`)
  - `FOTO_MAX_BYTES = 10 * 1024 * 1024`

Regras: WhatsApp = só dígitos, remove `55` inicial se ficarem 13 dígitos, precisa de 11 dígitos com DDD 11–99 e terceiro dígito `9`. Nome do contato ≥ 3 caracteres após `trim`. Nome completo ≥ 2 palavras. Nascimento: data válida, não futura, idade ≤ 120 anos. E-mail opcional, mas se preenchido segue a mesma regex do cadastro (`src/cadastro/validacao.ts`). UF reaproveita `UFS` do cadastro. Sexo, cidade e UF obrigatórios. Pré-consulta inteira opcional (sem validação). Foto: tipo `image/*` e até `FOTO_MAX_BYTES`.

- [ ] **Step 1: Escrever os testes**

```ts
const base: RascunhoPedido = { modalidade: 'presencial', data: '2026-11-17', inicio: '08:00',
  nome: 'Maria Lima', whatsapp: '(85) 99101-8813', transcricao: 'aceita', forma: 'whatsapp' }

it('normaliza WhatsApp digitado de vários jeitos', () => {
  for (const t of ['(85) 99101-8813', '85991018813', '+55 85 99101-8813', '55 (85) 9 9101 8813'])
    expect(normalizarWhatsapp(t)).toBe('5585991018813')
})
it('recusa fixo, curto e DDD inválido', () => {
  for (const t of ['85 3101-8813', '991018813', '(05) 99101-8813', ''])
    expect(normalizarWhatsapp(t)).toBeNull()
})
it('pedido completo passa; recusar a transcrição também passa', () => {
  expect(validarPedido(base)).toEqual({})
  expect(validarPedido({ ...base, transcricao: 'recusada' })).toEqual({})
})
it('exige horário, nome, WhatsApp, resposta da transcrição e forma', () => {
  const e = validarPedido({ ...base, data: null, nome: '  ', whatsapp: '123', transcricao: null, forma: null })
  expect(Object.keys(e).sort()).toEqual(['forma', 'horario', 'nome', 'transcricao', 'whatsapp'])
})
it('quem escolhe preencher na consulta ainda precisa de nome e WhatsApp', () => {
  expect(validarPedido({ ...base, forma: 'consulta', whatsapp: '' }).whatsapp).toBeDefined()
})
it('dados pessoais: nome completo, nascimento válido, e-mail opcional', () => {
  const hoje = new Date(2026, 10, 15)
  const d: DadosPessoais = { nomeCompleto: 'Maria Lima', nascimento: '1990-05-02', sexo: 'F',
    whatsapp: '85991018813', email: '', cidade: 'Fortaleza', uf: 'CE' }
  expect(validarDadosPessoais(d, hoje)).toEqual({})
  expect(validarDadosPessoais({ ...d, nomeCompleto: 'Maria' }, hoje).nomeCompleto).toBeDefined()
  expect(validarDadosPessoais({ ...d, nascimento: '2027-01-01' }, hoje).nascimento).toBeDefined()
  expect(validarDadosPessoais({ ...d, nascimento: '1890-01-01' }, hoje).nascimento).toBeDefined()
  expect(validarDadosPessoais({ ...d, nascimento: '2026-02-31' }, hoje).nascimento).toBeDefined()
  expect(validarDadosPessoais({ ...d, email: 'maria@' }, hoje).email).toBeDefined()
})
it('foto: só imagem até 10 MB', () => {
  expect(validarFoto({ type: 'image/jpeg', size: 2_000_000 })).toBeNull()
  expect(validarFoto({ type: 'application/pdf', size: 1000 })).not.toBeNull()
  expect(validarFoto({ type: 'image/png', size: FOTO_MAX_BYTES + 1 })).not.toBeNull()
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/medico/regras.test.ts`, Expected: FAIL.
- [ ] **Step 3: Implementar `regras.ts`** com as interfaces e regras acima. Para extrair a regex de e-mail do cadastro, exportá-la de `src/cadastro/validacao.ts` como `EMAIL_REGEX` e usar nos dois lugares.
- [ ] **Step 4: Rodar todos os testes** — `npx vitest run`, Expected: PASS (inclusive os 14 antigos).
- [ ] **Step 5: Commit** — `git add frontend/src/medico frontend/src/cadastro/validacao.ts` · `git commit -m "Página do médico: regras do agendamento com testes"`

---

### Task 3: Página, rota e agenda

**Files:**
- Create: `frontend/src/medico/pagina-medico.tsx` (`PaginaMedico`)
- Create: `frontend/src/medico/agenda.tsx` (`Agenda`)
- Create: `frontend/src/medico/informacoes.tsx` (`ComoFunciona`, `SobreTranscricao`, `Duvidas`)
- Modify: `frontend/src/App.tsx` (rota `/medico/:slug`)
- Modify: `frontend/vite.config.ts:11` (`ROTAS_DO_APP` ganha `'/medico'`)

**Interfaces:**
- Consumes: `buscarMedico`, `gerarAgenda`, `horarioExiste`, `Modalidade`, `Agenda` (Task 1); `buscarEspecialidade` (`src/especialidades.ts`) para nome e cor da especialidade do médico.
- Produces:
  - `Agenda` props: `{ agenda: Agenda; modalidade: Modalidade; onModalidade(m: Modalidade): void; selecionado: { data: string; inicio: string } | null; onSelecionar(data: string, inicio: string): void }`
  - `TEXTO_TRANSCRICAO: string` exportado de `informacoes.tsx` (o mesmo texto curto aparece na seção e no passo de consentimento da Task 4).
  - `PaginaMedico` guarda `modalidade` e `selecionado`; ao trocar a modalidade, limpa `selecionado` se `horarioExiste` der falso.

Conteúdo:
- Cabeçalho: foto (placeholder com iniciais "AS" se `foto` ausente), "Dra. Ana Souza", "Dermatologista", "CRM 12345-CE" (+ " · RQE x" só se houver), endereço, "Atende online"; botão "Agendar consulta" que rola até a agenda.
- Agenda: alternador Presencial | Online (`aria-pressed`); faixa de dias rolável na horizontal (dia da semana abreviado + número), botões de horário em grade; ocupados não aparecem. Primeiro dia já vem escolhido.
- Como funciona (3 passos), Sobre a transcrição (o que é gravado, quem lê, que o áudio é apagado após transcrever, que pode recusar sem perder a consulta), Dúvidas (4–5 `details`).
- Rodapé pequeno: "Agendamento com espec**IA**lista".
- Slug desconhecido: `NaoEncontrada` existente. `document.title` = "Dra. Ana Souza · Dermatologia".

- [ ] **Step 1: Implementar os três componentes, a rota e a regra de reescrita.**
- [ ] **Step 2: Verificar** — `npm run lint; npx vitest run; npm run build`, Expected: tudo passa. `npx vite` e abrir `http://localhost:5173/medico/ana-souza`: a página carrega, trocar a modalidade muda os horários, tocar num horário marca-o. `/medico/xyz` mostra "Página não encontrada".
- [ ] **Step 3: Commit** — `git commit -m "Página do médico: cabeçalho, agenda e informações ao paciente"`

---

### Task 4: Painel do agendamento

**Files:**
- Create: `frontend/src/medico/painel-agendamento.tsx` (`PainelAgendamento`)
- Modify: `frontend/src/medico/pagina-medico.tsx` (abre o painel ao escolher horário)

**Interfaces:**
- Consumes: `RascunhoPedido`, `validarContato`, `validarPedido`, `normalizarWhatsapp`, `FormaFormulario` (Task 2); `TEXTO_TRANSCRICAO` (Task 3); `Medico` (Task 1).
- Produces: `PainelAgendamento` props `{ medico: Medico; rascunho: RascunhoPedido; onMudar(r: RascunhoPedido): void; onFechar(): void; onPreencherNaPagina(): void }`. O rascunho mora em `PaginaMedico`, então voltar ou fechar e reabrir não apaga o que foi digitado.

Passos (um por vez, com "Voltar" e indicador "passo n de 4"):
1. **Resumo:** dia por extenso, hora, modalidade (link "trocar" fecha o painel e volta à agenda).
2. **Contato:** nome, WhatsApp (`inputMode="tel"`); avança só com `validarContato` vazio; erros com `aria-invalid` e `aria-describedby`, como em `pagina-contratar.tsx`.
3. **Transcrição:** `TEXTO_TRANSCRICAO` + dois botões grandes "Concordo" / "Não concordo"; os dois avançam.
4. **Formulário:** três opções. WhatsApp em destaque com selo "Recomendado" e a razão (preenche com calma, no seu tempo); "Preencher aqui agora"; "Prefiro preencher na consulta" menor, por último. Escolher "na consulta" mostra um pedido curto para reconsiderar (a consulta rende mais quando o médico já conhece o caso) com "Manter na consulta" e "Receber pelo WhatsApp". Botão final "Enviar pedido" só com `validarPedido` vazio.
- Final: tela "Pedido enviado" com o resumo e "O consultório confirma o horário pelo WhatsApp (85) 9xxxx-xxxx" (número normalizado e formatado). Se a forma for `whatsapp`: "Você vai receber o formulário no WhatsApp". Se for `pagina`: botão "Preencher agora" → `onPreencherNaPagina`. Faixa discreta: "Demonstração: nada foi enviado."
- Layout: abaixo de 768 px, painel em tela cheia (`fixed inset-0`, rolável, foco no título ao abrir, Esc fecha); a partir de `md:`, coluna fixa ao lado da agenda (`sticky`).

- [ ] **Step 1: Implementar o painel e ligar à página.**
- [ ] **Step 2: Verificar** — lint, testes e build passam. No navegador, percorrer: horário → contato com WhatsApp "85 3101-8813" (aparece erro) → corrigir → "Não concordo" → "na consulta" (aparece o pedido para reconsiderar) → manter → enviar → tela final. Voltar do passo 4 ao 2 mantém nome e WhatsApp.
- [ ] **Step 3: Commit** — `git commit -m "Página do médico: painel do agendamento em passos"`

---

### Task 5: Formulário na página

**Files:**
- Create: `frontend/src/medico/formulario-paciente.tsx` (`FormularioPaciente`)
- Modify: `frontend/src/medico/pagina-medico.tsx` (mostra o formulário depois de `onPreencherNaPagina`)

**Interfaces:**
- Consumes: `DadosPessoais`, `PreConsulta`, `validarDadosPessoais`, `validarFoto` (Task 2); `UFS` (`src/cadastro/validacao.ts`); `Medico`.
- Produces: `FormularioPaciente` props `{ medico: Medico; inicial: { nome: string; whatsapp: string }; onConcluir(): void }`.

Conteúdo: duas partes com títulos. **Dados pessoais** (nome completo e WhatsApp já vêm do contato; nascimento `type="date"`; sexo; e-mail opcional; cidade; UF). **Pré-consulta — opcional** (dermatologia): "O que trouxe você à consulta?", "Desde quando?", "Medicamentos e cremes que usa ou já usou", "Alergia a algum medicamento?", foto opcional (`accept="image/*"`, mostra miniatura; erro de `validarFoto` aparece e a foto é descartada). Botão "Enviar" valida só os dados pessoais; tela final "Recebido. A Dra. Ana Souza vai ler antes da consulta." + "Demonstração: nada foi enviado."

- [ ] **Step 1: Implementar o formulário e ligar à página.**
- [ ] **Step 2: Verificar** — lint, testes e build passam. No navegador: escolher "Preencher aqui agora" → formulário com nome e WhatsApp preenchidos → enviar vazio mostra erros só nos dados pessoais → enviar um PDF como foto mostra aviso → preencher e enviar mostra a tela final.
- [ ] **Step 3: Commit** — `git commit -m "Página do médico: formulário do paciente na página"`

---

### Task 6: Conferência visual e documentação

**Files:**
- Modify: `docs/fase-1.md` (registrar que PC-01/PC-09 foram começados visualmente em 15/11/2026, por decisão do autor, antes de fechar a Fase 1; link para o design)

- [ ] **Step 1: Capturas** em 360×800, 390×844, 820×1180, 1180×820 e 1366×768 de `/medico/ana-souza` (página, painel aberto em cada passo, formulário), medindo que nada passa da largura da tela (mesma técnica do script de medição usado na auditoria: Chrome headless + `getBoundingClientRect`). Expected: nenhum elemento além da borda; painel em tela cheia abaixo de 768 px e ao lado da agenda acima.
- [ ] **Step 2: Corrigir o que as capturas mostrarem** e repetir o Step 1.
- [ ] **Step 3: Rodar tudo** — `npm run lint; npx vitest run; npm run build`, Expected: PASS.
- [ ] **Step 4: Commit** — `git commit -m "Página do médico: conferência em celular, tablet e PC; fase-1 atualizada"`
