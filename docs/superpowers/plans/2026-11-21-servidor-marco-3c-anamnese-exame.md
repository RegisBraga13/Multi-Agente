# Marco 3C, passo 1: anamnese e exame no servidor — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a consulta de um pedido real da agenda nasce no servidor, e a página 1 (anamnese e exame) grava e lê dali, sem mudar a aparência nem o fluxo da tela.

**Architecture:** o servidor ganha os campos que a tela já tem (texto, perguntas, formulário) e liga a consulta ao pedido da agenda (assim as fotos do formulário continuam no pedido, sem cópia). A tela ganha um cliente do servidor e um mapeador puro entre os dados da tela e os blocos do servidor. Atendimentos de exemplo (sem pedido) continuam simulados, como hoje. A história, os diagnósticos e a conduta continuam simulados neste passo.

**Tech Stack:** FastAPI + Pydantic + Postgres (RLS), pytest; React + TypeScript, vitest.

**Spec:** [2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md), [ADR 0005](../../decisoes/0005-consulta-no-servidor.md). Decisão do autor (21/11): ampliar o servidor para guardar o que a tela tem (perguntas, formulário), em vez de deixar só no navegador.

## Global Constraints

- Fluxo e estilo da tela intocáveis: nenhuma mudança visual (regras do autor).
- O nome do paciente nunca vai para a IA; só o prontuário e os documentos o levam.
- Etapa só é oficializada com a anterior oficializada e em dia; consulta finalizada não muda.
- Campos novos dos blocos têm valor padrão: blocos já gravados continuam válidos.
- Exame físico = os 5 campos da especialidade (morfologia, localização, extensão, gravidade, achados) mais Observações.
- Linguagem de erro para o médico: simples, sem jargão.
- Migrations numeradas em `supabase/migrations/`; `0011` já existe. **Não aplicar no Supabase de produção sem o ok do autor** (só local, Docker).

## Review Focus

- Pedido sem formulário recebido: abrir a consulta é recusado com mensagem clara (a regra do autor exige Identificação antes).
- Abrir a mesma consulta duas vezes (duplo toque, recarregar a página): devolve a mesma consulta, sem duplicar consulta nem paciente.
- Mesma pessoa em dois pedidos (consulta e depois retorno): reaproveita o paciente (mesmo nome completo e nascimento, mesmo médico), sem criar outro.
- Sexo "I" (intersexo) do formulário: o cadastro e a descrição para a IA aceitam, sem erro nem "feminino" inventado.
- Servidor fora do ar ao salvar: a tela avisa, não marca como salvo e não perde o que foi escrito.
- Recarregar a página no meio da consulta: a anamnese e o exame voltam como estavam.
- Sinal de alerta com id que o servidor não conhece é recusado (422), nunca ignorado em silêncio.

---

## File Structure

- `backend/app/contratos/consulta_blocos.py` (modificar): campos novos de `AnamneseBloco` e `ExameBloco`.
- `backend/app/contratos/consulta.py` (modificar): tipos `PerguntaRespondida`, `FormularioDaConsulta`.
- `backend/app/consulta/abertura.py` (criar): abrir a consulta a partir do pedido (paciente + consulta, idempotente).
- `backend/app/api/consultas.py` (modificar): rota `POST /consultas/do-pedido/{pedido_id}` e `GET /especialidades/{slug}/sinais`.
- `backend/app/privacidade.py` (modificar): sexo "I".
- `supabase/migrations/0012_consulta_pedido_e_sexo.sql` (criar): `encounters.booking_request_id`, sexo "I".
- `frontend/src/servidor/consulta.ts` (criar): cliente do servidor da consulta.
- `frontend/src/consulta/servidor-mapa.ts` (criar): mapeadores puros tela ⇄ servidor, com testes.
- `frontend/src/consulta/pagina-consulta.tsx` (modificar): abrir, salvar e recarregar via servidor quando o atendimento vem de um pedido.

---

### Task 1: Blocos de anamnese e exame com os campos da tela

**Files:**
- Modify: `backend/app/contratos/consulta.py`, `backend/app/contratos/consulta_blocos.py`
- Test: `backend/tests/test_consulta_blocos.py`

**Interfaces:**
- Produces: `PerguntaRespondida(texto: str, resposta: Literal["sim","nao"], detalhe: str | None)`; `FormularioDaConsulta(respostas: dict[str, str | list[str]], fotos: list[str])` (`fotos` = ids das perguntas de foto do pedido); `AnamneseBloco.texto: str = ""`, `.perguntas: list[PerguntaRespondida] = []`, `.formulario: FormularioDaConsulta | None = None`; `ExameBloco.observacoes: str = ""`.

- [ ] **Step 1: Write the failing tests** em `test_consulta_blocos.py`: `test_anamnese_antiga_continua_valida` (payload só com os 6 campos antigos valida e traz `texto == ""`, `perguntas == []`, `formulario is None`); `test_anamnese_com_perguntas_e_formulario_ida_e_volta` (monta com uma pergunta sim com detalhe e um formulário com 1 resposta e 1 foto, `model_dump(by_alias=True)` e `model_validate` devolvem igual); `test_exame_antigo_continua_valido` (`observacoes == ""`).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_consulta_blocos.py -q` — Expected: FAIL (campos inexistentes).
- [ ] **Step 3: Implement** os tipos e campos acima, todos com padrão; `extra="forbid"` do `ModeloApi` continua.
- [ ] **Step 4: Run** a suíte inteira `.venv/Scripts/python -m pytest -q` — Expected: tudo passa.
- [ ] **Step 5: Commit** `git add backend && git commit -m "Servidor: anamnese e exame guardam texto, perguntas, formulário e observações"`

### Task 2: Sexo "I" no cadastro e na descrição para a IA

**Files:**
- Modify: `backend/app/contratos/paciente.py`, `backend/app/privacidade.py`; Create: `supabase/migrations/0012_consulta_pedido_e_sexo.sql` (só a parte do sexo neste passo)
- Test: `backend/tests/test_privacidade.py`, `backend/tests/test_contratos.py`

**Interfaces:**
- Produces: `NovoPaciente.sexo: Literal["F","M","I"]`; `descrever_paciente(idade, sexo: Literal["F","M","I"], ...)` devolve `"Paciente, 40 anos, intersexo"` para "I".

- [ ] **Step 1: Write the failing tests:** `test_descrever_paciente_intersexo` (`"Paciente, 40 anos, intersexo"`); `test_novo_paciente_aceita_sexo_i`.
- [ ] **Step 2: Run** os dois testes — Expected: FAIL.
- [ ] **Step 3: Implement** os tipos e a descrição; a migration troca a restrição `check (sex in ('F','M'))` de `patients` por `('F','M','I')` (descobrir o nome da restrição em `0007`).
- [ ] **Step 4: Run** `.venv/Scripts/python -m pytest -q` — Expected: tudo passa.
- [ ] **Step 5: Commit** `"Cadastro e IA aceitam sexo intersexo"`

### Task 3: Abrir a consulta a partir do pedido (idempotente)

**Files:**
- Create: `backend/app/consulta/abertura.py`
- Modify: `backend/app/contratos/consulta_blocos.py` (`Consulta.pedido_id: UUID | None = None`), `backend/app/consulta/repositorio.py`, `backend/app/consulta/repositorio_postgres.py`, `backend/app/api/consultas.py`, `backend/app/api/dependencias.py` (já expõe `dep.agenda`), `supabase/migrations/0012_consulta_pedido_e_sexo.sql` (coluna `encounters.booking_request_id uuid unique references booking_requests(id)`)
- Test: `backend/tests/test_abertura_consulta.py`, `backend/tests/test_api_consultas.py`

**Interfaces:**
- Consumes: `RepositorioAgenda.buscar_pedido`-equivalente do médico (descobrir o nome em `app/agenda/repositorio.py`), `RepositorioPacientes`, `RepositorioConsultas.criar`.
- Produces: `abrir_do_pedido(dep: Dependencias, medico: UUID, pedido_id: UUID, especialidade: str) -> Consulta`; `RepositorioConsultas.do_pedido(medico_id, pedido_id) -> Consulta | None`; rota `POST /consultas/do-pedido/{pedido_id}` com corpo `{"especialidade": str}` → 200 `Consulta`. Erros: pedido inexistente 404; pedido sem formulário 409 "Preencha a Identificação do paciente antes de abrir a consulta".

- [ ] **Step 1: Write the failing tests** (memória): `test_abre_cria_paciente_e_consulta_com_tipo_e_hora_do_pedido`; `test_abrir_duas_vezes_devolve_a_mesma_consulta` (mesmo `id`, 1 paciente); `test_pedido_sem_formulario_e_409`; `test_mesma_pessoa_em_outro_pedido_reaproveita_paciente` (mesmo nome completo e nascimento, dois pedidos → 1 paciente, 2 consultas); `test_pedido_de_outro_medico_e_404`; API: `test_do_pedido_especialidade_desconhecida_e_422`.
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_abertura_consulta.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** `abrir_do_pedido`: se `do_pedido` existe, devolve; senão exige formulário, monta `NovoPaciente` de `DadosPessoais` (nome = `nome_completo`, `estado_civil` e `profissao` do formulário, `telefone` = whatsapp do pedido), procura paciente do médico com o mesmo nome completo e nascimento (acrescentar `procurar(medico, nome, nascimento)` ao repositório de pacientes, memória e Postgres), cria o que faltar e cria a consulta (`tipo`, `modalidade`, `agendada_para` do pedido no fuso do consultório). A gravação de paciente + consulta é uma transação no Postgres; a restrição `unique` do pedido garante a idempotência sob corrida.
- [ ] **Step 4: Run** a suíte inteira, e os testes de banco com Docker (`docker compose up -d` em `backend/`, depois `.venv/Scripts/python -m pytest tests/banco -q`) — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: abrir a consulta a partir do pedido da agenda"`

### Task 4: Lista fixa de sinais da especialidade pelo servidor

**Files:**
- Modify: `backend/app/api/consultas.py` (ou rota própria `backend/app/api/especialidades.py`), `backend/app/consulta/servico.py` (validar ids ao editar a anamnese)
- Test: `backend/tests/test_api_consultas.py`

**Interfaces:**
- Produces: `GET /especialidades/{slug}/sinais` → `list[{id: str, texto: str}]` (a lista fixa, na ordem do YAML); 404 se a especialidade não existe. `editar(..., "anamnese", ...)` recusa sinal cujo `id` não está na lista da especialidade da consulta (`ErroEtapa`, 422 "Sinal de alerta desconhecido").

- [ ] **Step 1: Write the failing tests:** `test_lista_de_sinais_da_dermatologia_tem_os_13_do_yaml`; `test_especialidade_inexistente_na_lista_e_404`; `test_anamnese_com_sinal_desconhecido_e_422`.
- [ ] **Step 2: Run** esses três — Expected: FAIL.
- [ ] **Step 3: Implement** a rota (lê `carregar_pacote(slug).sinais`) e a validação em `editar` para a etapa `anamnese`.
- [ ] **Step 4: Run** a suíte inteira — Expected: passa.
- [ ] **Step 5: Commit** `"Servidor: lista fixa de sinais por especialidade e validação do id"`

### Task 5: Cliente do servidor e mapeadores da tela

**Files:**
- Create: `frontend/src/servidor/consulta.ts`, `frontend/src/consulta/servidor-mapa.ts`
- Test: `frontend/src/consulta/servidor-mapa.test.ts`

**Interfaces:**
- Consumes: `ErroServidor` e o padrão `chamar` de [agenda.ts](../../../frontend/src/servidor/agenda.ts) (exportar `chamar`).
- Produces em `servidor/consulta.ts`: `abrirConsultaDoPedido(pedidoId: string, especialidade: string): Promise<ConsultaServidor>`; `buscarConsulta(id: string): Promise<ConsultaServidor>`; `salvarAnamnese(id: string, corpo: AnamneseServidor): Promise<ConsultaServidor>`; `salvarExame(id: string, corpo: ExameServidor): Promise<ConsultaServidor>`; `oficializarEtapa(id: string, etapa: 'anamnese' | 'exame'): Promise<ConsultaServidor>`; `sinaisDaEspecialidade(slug: string): Promise<{ id: string; texto: string }[]>`.
- Produces em `servidor-mapa.ts` (funções puras): `anamneseParaServidor(entrada: { texto: string; falas: Fala[]; ficha: Ficha; alertas: Record<string, RespostaAlerta | null>; sinais: { id: string; texto: string }[]; perguntas: RespostaPergunta[]; formulario: FormularioConsulta | null }): AnamneseServidor`; `exameParaServidor(valores: { rotulo: string; valor: string }[]): ExameServidor` (os 5 rótulos viram os 5 campos; vazio vira `null`; "Observações" vira `observacoes`); `anamneseDoServidor(b: AnamneseServidor): { texto: string; perguntas: RespostaPergunta[]; alertas: Record<string, RespostaAlerta> }`; `exameDoServidor(b: ExameServidor): { rotulo: string; valor: string }[]`.

- [ ] **Step 1: Write the failing tests** em `servidor-mapa.test.ts`: `exameParaServidor` com 5 valores e Observações (campo vazio → `null`, nunca `""`); ida e volta do exame; `anamneseParaServidor` leva `queixa` da ficha, `em_uso`, `antecedentes`, `alergias` da ficha, sinais só os respondidos (`v` → `sim`, `f` → `nao`, `null` fica de fora); pergunta aberta leva `detalhe`; ida e volta da anamnese preserva texto e perguntas.
- [ ] **Step 2: Run** `npm test -- servidor-mapa` em `frontend` — Expected: FAIL.
- [ ] **Step 3: Implement** os dois arquivos; os nomes dos campos em camelCase como os contratos (ver `agenda.ts`).
- [ ] **Step 4: Run** `npm test` e `npm run lint` e `npx tsc -b` — Expected: passam.
- [ ] **Step 5: Commit** `"Tela: cliente do servidor da consulta e mapeadores da página 1"`

### Task 6: Página 1 lê e grava no servidor

**Files:**
- Modify: `frontend/src/consulta/pagina-consulta.tsx` (a função `salvarPagina1` e a abertura), `frontend/src/modulo/exemplo.ts` (só se o atendimento do pedido precisar carregar `consultaId`), `frontend/src/consulta/exemplo.ts` (os alertas do tipo `sinal` de atendimento do servidor vêm da lista fixa)
- Test: `frontend/src/consulta/servidor-mapa.test.ts` (acrescentar) e conferência manual abaixo

**Interfaces:**
- Consumes: Task 5. Regra: só atendimentos com `at.pedido` usam o servidor; os de exemplo seguem simulados.
- Produces: a consulta do servidor é aberta ao entrar na página 1 (`abrirConsultaDoPedido(at.pedido.id, esp.slug)`); `salvarPagina1('anamnese' | 'exame')` primeiro envia (`salvarAnamnese`/`salvarExame` e `oficializarEtapa`) e só então marca como salvo na tela; falha mostra o `aviso` existente "Não foi possível salvar. Tente de novo." e não marca; ao recarregar, `buscarConsulta` repõe texto, perguntas, respostas dos sinais e valores do exame.

- [ ] **Step 1: Write the failing test** em `servidor-mapa.test.ts`: `test_sinais_da_tela_do_servidor_usam_os_ids_da_lista_fixa` (a função `alertasDeSinais(lista)` devolve `{ id, tipo: 'sinal', texto }` na ordem da lista; alergias da ficha continuam `alergia-N`).
- [ ] **Step 2: Run** esse teste — Expected: FAIL.
- [ ] **Step 3: Implement** a ligação em `pagina-consulta.tsx`, sem mudar JSX nem classes; carregamento: enquanto a consulta abre, a tela mostra o mesmo estado de "carregando" usado nas outras páginas do app (descobrir em `ui.tsx`; se não houver, nada visível: a página 1 só habilita Salvar quando a consulta abriu).
- [ ] **Step 4: Verify** `npm test`, `npm run lint`, `npx tsc -b` passam; depois conferência manual com Docker + `npx vite --port 5191`: criar um pedido pela página do médico, preencher o formulário, tocar em Abrir consulta, salvar anamnese e exame, recarregar a página (volta como estava) e conferir no banco que a consulta e o paciente existem uma vez só (`docker compose exec db psql -U postgres -c "select count(*) from encounters"`). Parar o servidor ao terminar.
- [ ] **Step 5: Commit** `"Tela: página 1 da consulta grava e lê do servidor (pedidos reais)"`

---

## Fora deste passo (decidido)

- História, diagnósticos, conduta, anexos e prontuário no servidor: um passo por vez, cada um só depois do ok do autor (regra do autor: uma etapa por vez).
- Fotos do exame físico: a tela ainda não tem envio de foto (usa foto de exemplo); o armazenamento entra junto com esse envio.
- Login: o servidor continua com o médico local (só o autor, neste computador).
- Aplicar as migrations `0011` e `0012` no Supabase de produção: só com o ok do autor.
