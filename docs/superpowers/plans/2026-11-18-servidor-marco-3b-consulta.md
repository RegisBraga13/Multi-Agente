# Marco 3B — A consulta no servidor: etapas, oficialização, IA real e prontuário gravado — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma consulta da Dermatologia inteira pela API — anamnese → exame → história (IA) → diagnósticos (IA) → conduta (tabela + IA) → documentos → prontuário gravado no Postgres —, com a Constituição (só o oficializado alimenta a etapa seguinte) garantida pelo servidor.

**Architecture:** Cada etapa é um bloco no Postgres (`rascunho_ia → revisado_medico → oficializado`, decisão 0003). Um serviço puro aplica as regras (gating, desatualização, consulta finalizada) sobre um repositório trocável (memória nos testes, Postgres sob RLS em produção). As rotas `gerar` chamam os motores do 3A e gravam cada decisão em `ai_proposals`. Ao finalizar, o servidor monta o prontuário (`DadosEntrada`) a partir dos blocos oficializados — porte de `dadosDaConsulta` do frontend — e grava em `encounters.record`.

**Tech Stack:** Python 3.12, FastAPI, Pydantic 2, psycopg 3, Postgres (Supabase), pytest (+ `-m banco` com Docker).

**Spec:** [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md) (§4 Constituição, §6, §7.1–7.7, §13), [constituicao.md](../../constituicao.md), [ADR 0003](../../decisoes/0003-banco-da-consulta.md), [ADR 0004](../../decisoes/0004-motores-tabela-primeiro-e-medico-simulado.md).

**Branch:** `servidor-consulta`, a partir de `master` (189f876).

## Decisões deste plano (do engenheiro, desenho §9)

1. **Escrita ao vivo como no desenho (§7.7):** `gerar` responde em SSE; a tela mostra o texto enquanto a IA escreve, sem mudar o visual. Eventos `parcial` (o resultado até ali) e `pronto` (a proposta validada). O parcial só é mostrado; nada parcial é gravado nem passa adiante.
2. **[PERGUNTA AO AUTOR] Fila:** o desenho (§2.1) põe tarefas longas em fila; o §9 deixa começar simples. Proposta: sem fila no primeiro uso (um médico, local), atrás de uma interface para entrar depois.
3. **O servidor monta o prontuário** (dados clínicos, fonte única Pydantic). **[PERGUNTA AO AUTOR] Documentos:** o desenho (§7.5) diz que o servidor recoloca o nome nos documentos ao paciente. Proposta: o texto da receita, atestado e laudo continua montado pela tela (formato já aprovado, com o nome, que nunca vai à IA); o servidor guarda o texto final e o estado (`rascunho → revisado → assinado → enviado`).
4. **Gerar de novo sobre bloco já mexido pelo médico não sobrescreve:** a proposta volta como sugestão (e fica em `ai_proposals`); a tela decide lado a lado (regra "IA atualiza só o que mudou").
5. **Sem migration nova.** As tabelas da 0007/0008 bastam: anamnese → `transcripts`, exame → `clinical_facts`, história → `clinical_histories`, diagnósticos → `diagnostic_hypotheses`, conduta → `care_plans`, documentos → `documents`, prontuário → `encounters.record`, adendos → `addenda`.

## Global Constraints

- **Nenhuma mudança no fluxo nem no estilo das telas decididos pelo autor** (estética ousada é ponto forte). O servidor só troca a origem dos dados; a escrita ao vivo continua com o mesmo visual e ritmo da tela de hoje (3 letras a cada 33 ms): o SSE alimenta o texto, a tela continua animando no ritmo dela.
- Constituição: a IA da etapa N recebe **apenas** o oficializado da etapa N-1 (+ dados de segurança da história); gerar sem o predecessor oficializado → **409**. Toda etapa é revisada e oficializada pelo médico.
- Ordem das etapas: `anamnese`, `exame`, `historia`, `diagnosticos`, `conduta`. Reoficializar/editar a etapa N marca as etapas seguintes `stale` (desatualizado).
- Consulta finalizada é imutável (gatilhos 0007): qualquer escrita → **409 "consulta finalizada; use adendo"**; adendo só depois de finalizar.
- Consulta ou paciente de outro médico → **404** (não existe para quem pergunta), como em `/pacientes`.
- Nada de identidade vai à IA: pedido montado só com campos desidentificados + `termos_proibidos` do paciente (partes do nome com 3+ letras, CPF, telefone). `ErroPrivacidade` → **422**, nada enviado.
- Proposta `REJECT` não sobrescreve bloco; a resposta diz "A IA não conseguiu; escreva ou tente de novo".
- Diagnósticos no prontuário: sempre até 3 — assinalados (confirmados; >3 → maior %) + sugeridos (pendentes) para completar; descartado não entra.
- JSON em camelCase (`ModeloApi`); termos do domínio em português.
- Comandos (de `backend/`): `.venv/Scripts/python -m pytest -m "not banco" -q`; `.venv/Scripts/python -m pytest -m banco -q` (Docker); `ruff check .`; `mypy app casos_de_teste banco_local`.

## Review Focus

1. **Gerar com a etapa anterior não oficializada** (ou desatualizada) → 409 com o nome da etapa que falta; a IA não é chamada. Teste: Task 5 (`test_gerar_sem_predecessor_oficializado_e_409_sem_chamar_ia`).
2. **Médico mexe na anamnese depois da conduta pronta** → história, diagnósticos e conduta ficam desatualizados; finalizar é bloqueado até reoficializar. Teste: Task 3 (`test_editar_etapa_oficializada_desatualiza_as_seguintes`), Task 7 (`test_finalizar_com_etapa_desatualizada_e_409`).
3. **Consulta finalizada recebendo escrita** (editar, gerar, oficializar, documento) → 409 "use adendo"; adendo antes de finalizar → 409. Teste: Task 3 (`test_consulta_finalizada_nao_muda`), Task 2/8 (repositório Postgres respeita os gatilhos).
4. **Nome do paciente dentro de uma fala** → `gerar historia` responde 422 sem chamar a IA. Teste: Task 5 (`test_nome_na_fala_e_422_sem_chamar_ia`).
5. **Consulta de outro médico** → 404 em todas as rotas. Teste: Task 6 (`test_consulta_de_outro_medico_e_404`).

---

### Task 1: Contratos dos blocos e entrada da IA a partir da consulta

**Files:**
- Create: `backend/app/contratos/consulta_blocos.py`
- Modify: `backend/app/contratos/consulta.py` (funções de montagem)
- Test: `backend/tests/test_consulta_blocos.py`

**Interfaces:**
- Consumes: `HistoriaClinica` (`app/motores/historia.py`), `SinalDisparado`, `SinaisConsulta` (`app/motores/sinais.py`), `HipoteseIA`, `NaoPerderIA`, `DadosSeguranca` (`app/motores/diagnosticos.py`), `CondutaProposta`, `DiagnosticoConfirmado` (`app/motores/conduta.py`), `ItemReceita`, `DocumentoRegistro` (`app/contratos/prontuario.py`), `Paciente` (`app/contratos/paciente.py`).
- Produces (`app/contratos/consulta_blocos.py`):
  - `Etapa = Literal["anamnese", "exame", "historia", "diagnosticos", "conduta"]`; `ETAPAS: tuple[Etapa, ...]` nessa ordem; `ETAPAS_IA: tuple[Etapa, ...] = ("historia", "diagnosticos", "conduta")`; `EstadoBloco = Literal["rascunho_ia", "revisado_medico", "oficializado"]`
  - `class AnamneseBloco(ModeloApi)`: `queixa: str`, `falas: list[Fala]`, `sinais: list[SinalRespondido]`, `em_uso: list[str]`, `antecedentes: list[str]`, `alergias: list[Alergia]`
  - `class ExameBloco(ModeloApi)`: `exame: ExameDerm`, `complementares: list[ExameComplementar]`
  - `class HistoriaBloco(ModeloApi)`: `historia: HistoriaClinica`, `seguranca: DadosSeguranca`, `conflitos: list[SinalDisparado]`, `extras_ia: list[str]`
  - `class ItemDD(ModeloApi)`: `hipotese: HipoteseIA`, `decisao: Literal["pendente", "confirmada", "descartada"]`, `propria: bool`  (diagnóstico do próprio médico: `propria=True`, `pct` livre)
  - `class DiagnosticosBloco(ModeloApi)`: `itens: list[ItemDD]`, `nao_pode_perder: NaoPerderIA | None`, `rastrear: list[str]`
  - `class CondutaBloco(ModeloApi)`: `proposta: CondutaProposta`, `diagnostico: DiagnosticoConfirmado`, `escolha: dict[str, list[str]]`, `textos: list[str]` (4 grupos, na ordem de `GRUPOS_CONDUTA`), `receita: list[ItemReceita]`, `livres: list[str]`
  - `class Bloco(ModeloApi)`: `etapa: Etapa`, `estado: EstadoBloco`, `desatualizado: bool`, `conteudo: dict[str, Any]`, `oficializado_em: datetime | None`
  - `CONTEUDO: dict[Etapa, type[ModeloApi]]` (etapa → modelo) e `VERSAO_ESQUEMA_BLOCO = 1`
  - `class NovaConsulta(ModeloApi)`: `paciente_id: UUID`, `tipo: Literal["consulta", "retorno"]`, `modalidade: Literal["presencial", "online"]`, `agendada_para: datetime`
  - `class Consulta(NovaConsulta)`: `id: UUID`, `finalizada_em: datetime | None`, `blocos: list[Bloco]`
  - `TipoDocumento = Literal["receita", "exames", "encaminhamento", "orientacoes", "atestado", "laudo"]`; `class Documento(ModeloApi)`: `tipo`, `estado: Literal["rascunho", "revisado", "assinado", "enviado"]`, `texto: str`, `registro: DocumentoRegistro | None` (resumo de uma linha do atestado/laudo para o prontuário)
- Produces (`app/contratos/consulta.py`):
  - `entrada_da_consulta(paciente: Paciente, anamnese: AnamneseBloco, exame: ExameBloco, quando: date) -> EntradaConsulta` — idade na data da consulta, `descrever_paciente(...)`; nada de nome/CPF/telefone.
  - `termos_do_paciente(paciente: Paciente) -> list[str]` — partes do nome com 3+ letras, CPF (só dígitos), telefone (como cadastrado).

- [ ] **Step 1: Testes que falham** — `test_entrada_da_consulta_e_desidentificada` (paciente "Mariana Souza", nasc. 1992-03-10, consulta 2026-11-13 → `paciente == "Paciente, 34 anos, feminino, casada, professora"`; `"Mariana" not in entrada.model_dump_json()`), `test_idade_na_data_da_consulta` (aniversário no dia seguinte → ainda 33), `test_termos_do_paciente` (`["Mariana", "Souza", "12345678909", "11987654321"]`; "da"/"de" fora), `test_conteudo_por_etapa_valida` (cada `CONTEUDO[etapa].model_validate` de um exemplo mínimo), `test_conduta_bloco_exige_4_textos` (`textos` com 3 → `ValidationError`; use `Field(min_length=4, max_length=4)`).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar** + ruff + mypy.
- [ ] **Step 5: Commit** — `"Contratos dos blocos da consulta e entrada desidentificada a partir do paciente"`

---

### Task 2: Repositório da consulta (interface + memória)

**Files:**
- Create: `backend/app/consulta/repositorio.py`, `backend/app/prontuario/titulo.py`
- Test: `backend/tests/test_repositorio_consulta.py`, `backend/tests/test_titulo_prontuario.py`

**Interfaces:**
- Consumes: Task 1 (todos os modelos), `RegistroDecisao`, `EntradaProntuario`, `DadosEntrada`, `Adendo`.
- Produces:
  - Exceções: `ConsultaNaoEncontrada`, `ConsultaFinalizada`, `ConsultaAberta` (adendo antes de finalizar).
  - `class RepositorioConsultas(Protocol)`:
    - `criar(medico_id: UUID, nova: NovaConsulta) -> Consulta` (paciente de outro médico → `ConsultaNaoEncontrada`)
    - `buscar(medico_id, consulta_id) -> Consulta` (não existe/de outro médico → `ConsultaNaoEncontrada`)
    - `gravar_bloco(medico_id, consulta_id, etapa: Etapa, estado: EstadoBloco, conteudo: ModeloApi, oficializado_em: datetime | None) -> None` (cria ou substitui; zera `desatualizado`)
    - `desatualizar(medico_id, consulta_id, etapas: list[Etapa]) -> None` (só as que existem)
    - `registrar_proposta(medico_id, consulta_id, registro: RegistroDecisao, conteudo: dict[str, Any] | None) -> None`
    - `gravar_documento(medico_id, consulta_id, documento: Documento) -> None` (um por tipo; substitui) e `documentos(medico_id, consulta_id) -> list[Documento]`
    - `finalizar(medico_id, consulta_id, dados: DadosEntrada, edicoes: dict[str, str], quando: datetime) -> None`
    - `adicionar_adendo(medico_id, consulta_id, texto: str, motivo: str, quando: datetime) -> None`
    - `prontuario(medico_id, paciente_id) -> list[EntradaProntuario]` (finalizadas, mais recente no topo, `titulo` por `titulo_nova_entrada`)
  - `app/prontuario/titulo.py`: `titulo_nova_entrada(antes: list[tuple[str, str, str]], tipo: str) -> str` — `antes` = (tipo, data, hora) das anteriores; consulta → "Consulta N+1"; retorno → "Consulta N — Retorno", "— Retorno 2"… (porte de `tituloNovaEntrada` em `frontend/src/prontuario/registro.ts`).
  - `class RepositorioConsultasMemoria` — mesmas regras dos gatilhos: qualquer escrita em consulta finalizada → `ConsultaFinalizada`; adendo em aberta → `ConsultaAberta`; `ai_proposals` e adendos só crescem.
  - Recebe `pacientes: RepositorioPacientes` no construtor (para conferir o dono do paciente).

- [ ] **Step 1: Testes que falham** — `test_titulo_consulta_e_retornos` (mesmos casos do frontend), `test_criar_e_buscar`, `test_paciente_de_outro_medico_nao_vira_consulta`, `test_consulta_de_outro_medico_nao_existe`, `test_gravar_bloco_substitui_e_zera_desatualizado`, `test_desatualizar_so_as_existentes`, `test_finalizada_recusa_qualquer_escrita` (bloco, documento, proposta, finalizar de novo → `ConsultaFinalizada`), `test_adendo_so_depois_de_finalizar`, `test_documento_um_por_tipo`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"Repositório da consulta: interface e versão em memória com as regras dos gatilhos"`

---

### Task 3: Serviço da consulta — edição, oficialização e desatualização

**Files:**
- Create: `backend/app/consulta/servico.py`
- Test: `backend/tests/test_servico_consulta.py`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces:
  - `class ErroEtapa(Exception)` (mensagem para o médico; vira 409)
  - `editar(repo, medico_id, consulta_id, etapa: Etapa, conteudo: ModeloApi) -> Consulta` — grava `revisado_medico`; se a etapa estava oficializada, desatualiza as seguintes.
  - `oficializar(repo, medico_id, consulta_id, etapa: Etapa, quando: datetime) -> Consulta` — exige bloco existente; exige a etapa anterior oficializada e não desatualizada; regras próprias: `diagnosticos` exige ≥1 item `confirmada` ("Confirme ao menos um diagnóstico"); `conduta` exige algum texto não vazio ("Escreva a conduta"); grava `oficializado` e desatualiza as seguintes.
  - `exigir_predecessor(consulta: Consulta, etapa: Etapa) -> Bloco` — devolve o bloco oficializado anterior ou levanta `ErroEtapa("Oficialize <rótulo> antes")` (rótulos: Anamnese, Exame físico, História clínica, Diagnósticos).
  - `seguintes(etapa: Etapa) -> list[Etapa]`

- [ ] **Step 1: Testes que falham** — `test_editar_grava_revisado`, `test_oficializar_sem_anterior_oficializada_e_erro`, `test_oficializar_com_anterior_desatualizada_e_erro`, `test_editar_etapa_oficializada_desatualiza_as_seguintes` (anamnese reeditada → história/diagnósticos/conduta `desatualizado`), `test_reoficializar_desatualiza_as_seguintes`, `test_diagnosticos_sem_confirmado_nao_oficializa`, `test_conduta_sem_texto_nao_oficializa`, `test_consulta_finalizada_nao_muda` (editar/oficializar → `ConsultaFinalizada`).
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"Serviço da consulta: oficialização encadeada e etapas desatualizadas"`

---

### Task 4: Escrita ao vivo — provedor e motores transmitem o que a IA escreve

**Files:**
- Modify: `backend/app/provedores/ia.py`, `backend/app/provedores/ia_anthropic.py`, `backend/app/provedores/ia_falso.py`, `backend/app/motores/chamada.py`, `backend/app/motores/historia.py`, `backend/app/motores/diagnosticos.py`, `backend/app/motores/conduta.py`
- Test: `backend/tests/test_ia_anthropic.py`, `backend/tests/test_chamada_motor.py`, `backend/tests/test_motor_historia.py`

**Interfaces:**
- Produces:
  - `ProvedorIA.gerar(pedido, esquema, ao_escrever: Callable[[str], None] | None = None) -> RespostaIA` — `ao_escrever` recebe o texto acumulado a cada pedaço que chega.
  - Anthropic: dentro do mesmo `beta.messages.stream(...)`, iterar os pedaços de texto (`fluxo.text_stream` — conferir o nome no SDK 2.10 instalado antes de escrever) chamando `ao_escrever(acumulado)`; depois `get_final_message()` como hoje.
  - `ProvedorIAFalso`: com `ao_escrever`, entrega o JSON em 3 pedaços antes de devolver.
  - `chamar_motor(..., ao_escrever: Callable[[dict[str, Any]], None] | None = None)` — converte o texto acumulado em resultado parcial com `pydantic_core.from_json(texto, allow_partial=True)` e chama `ao_escrever(envelope["resultado"])` quando muda; pedaço que não dá para ler é ignorado. A validação estrita, a política e o registro continuam só sobre a resposta final.
  - `motor_historia`, `motor_diagnosticos`, `motor_conduta` ganham `ao_escrever` (repassado; na conduta, só na chamada à IA).

- [ ] **Step 1: Testes que falham** — `test_ao_escrever_recebe_texto_acumulado` (Anthropic com cliente falso que emite pedaços), `test_parciais_do_resultado_chegam_em_ordem` (`{"nomes": ["Ac"]}` … até o final), `test_parcial_nunca_vira_resultado` (pedaços válidos, resposta final inválida → `REJECT`, `resultado is None`), `test_sem_ao_escrever_funciona_como_antes`, `test_historia_transmite_parciais`.
- [ ] **Step 2–4.** Suíte inteira verde (os testes do 3A não mudam).
- [ ] **Step 5: Commit** — `"Escrita ao vivo: provedor e motores transmitem o que a IA escreve"`

---

### Task 5: Geração pela IA dentro da consulta

**Files:**
- Create: `backend/app/consulta/geracao.py`
- Test: `backend/tests/test_geracao_consulta.py`

**Interfaces:**
- Consumes: Tasks 1–3; motores do 3A (`motor_sinais`, `motor_historia`, `motor_diagnosticos`, `motor_conduta`, `seguranca_de`); `RepositorioPacientes`.
- Produces:
  - `@dataclass(frozen=True) class Contexto`: `repo: RepositorioConsultas`, `pacientes: RepositorioPacientes`, `provedor: ProvedorIA`, `relogio: Relogio`, `sinais: list[SinalAlerta]`, `protocolos: dict[str, Protocolo]`
  - `class ResultadoGeracao(ModeloApi)`: `acao: Acao`, `gravado: bool` (False = REJECT ou bloco já mexido pelo médico), `conteudo: dict[str, Any] | None`, `avisos: list[str]`, `mensagem: str`
  - `gerar(ctx: Contexto, medico_id: UUID, consulta_id: UUID, etapa: Literal["historia", "diagnosticos", "conduta"], ao_escrever: Callable[[dict[str, Any]], None] | None = None) -> ResultadoGeracao` — gating e privacidade conferidos ANTES de qualquer escrita; `ao_escrever` repassado ao motor da etapa (na história, só ao motor da história).
    - `historia`: exige `exame` oficializado (e `anamnese`, por encadeamento); entrada = `entrada_da_consulta(...)`; `motor_sinais` + `motor_historia` → `HistoriaBloco` (seguranca = `seguranca_de`, conflitos, extras).
    - `diagnosticos`: exige `historia` oficializada; `motor_diagnosticos(historia, seguranca)` → `DiagnosticosBloco` (todos `pendente`, `propria=False`).
    - `conduta`: exige `diagnosticos` oficializado; diagnóstico = primeiro item `confirmada` por ordem do bloco (como `diagnosticoPrincipal` da tela); seguranca = da história oficializada; `motor_conduta` → `CondutaBloco(proposta, diagnostico, escolha={}, textos=["", "", "", ""], receita=[], livres=[])`.
    - Toda chamada de IA registra em `repo.registrar_proposta` (com o `encounter_id`); `termos_proibidos = termos_do_paciente(paciente)`.
    - Grava `rascunho_ia` só se o bloco não existe ou ainda é `rascunho_ia`; senão `gravado=False`, mensagem "Sugestão da IA ao lado: o bloco já foi revisado pelo médico".
    - REJECT → `gravado=False`, mensagem "A IA não conseguiu; escreva ou tente de novo".
    - `ErroPrivacidade` propaga (a rota vira 422).

- [ ] **Step 1: Testes que falham** (com `ProvedorIAFalso`/roteiro por motor, repositório em memória): `test_gerar_sem_predecessor_oficializado_e_409_sem_chamar_ia` (levanta `ErroEtapa`; `provedor.pedidos == []`), `test_gerar_historia_grava_rascunho_e_propostas` (bloco `rascunho_ia`; uma proposta por motor chamado), `test_historia_leva_sinais_respondidos_mesmo_com_ia_falhando`, `test_nome_na_fala_e_422_sem_chamar_ia` (fala "Sou a Mariana" → `ErroPrivacidade`; nenhuma chamada de história), `test_reject_nao_sobrescreve`, `test_bloco_revisado_nao_e_sobrescrito`, `test_conduta_usa_o_primeiro_confirmado_e_a_seguranca_da_historia`, `test_pedido_nao_leva_nome_nem_cpf`.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"Geração pela IA dentro da consulta, com gating, privacidade e auditoria em ai_proposals"`

---

### Task 6: Rotas da consulta

**Files:**
- Create: `backend/app/api/consultas.py`
- Modify: `backend/app/api/dependencias.py` (consultas, provedor, relógio, sinais, protocolos), `backend/app/aplicacao.py` (incluir rotas), `backend/tests/conftest.py` (app de teste com memória + provedor roteiro)
- Test: `backend/tests/test_api_consultas.py`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (prefixo `/consultas`, tag `consultas`):
  - `POST /consultas` (`NovaConsulta`) → 201 `Consulta`; paciente inexistente/de outro médico → 404.
  - `GET /consultas/{id}` → `Consulta`.
  - `PUT /consultas/{id}/anamnese|exame|historia|diagnosticos|conduta` (corpo = modelo da etapa, uma rota tipada por etapa) → `Consulta`.
  - `POST /consultas/{id}/{etapa}/oficializar` → `Consulta`.
  - `POST /consultas/{id}/{etapa}/gerar` (`historia|diagnosticos|conduta`) → `text/event-stream`: eventos `parcial` (`data` = resultado parcial em JSON camelCase) e, no fim, `pronto` (`data` = `ResultadoGeracao`). Gating (409), consulta inexistente (404) e privacidade (422) são conferidos antes de abrir o fluxo e voltam como resposta HTTP normal. O motor roda numa thread e entrega os eventos por uma fila (`queue.Queue`) ao gerador do `StreamingResponse`.
  - `PUT /consultas/{id}/documentos/{tipo}` (`Documento`) → 204; `GET /consultas/{id}/documentos` → `list[Documento]`.
  - Erros: `ConsultaNaoEncontrada` → 404 "consulta não encontrada"; `ErroEtapa` → 409 (mensagem); `ConsultaFinalizada` → 409 "consulta finalizada; use adendo"; `ErroPrivacidade` → 422 "dado de identidade no pedido à IA; nada foi enviado".

- [ ] **Step 1: Testes que falham** (TestClient) — `test_fluxo_ate_a_conduta` (paciente → consulta → anamnese → oficializar → exame → oficializar → gerar história → oficializar → gerar diagnósticos → confirmar via PUT → oficializar → gerar conduta → PUT com textos → oficializar), `test_gerar_transmite_parciais_e_termina_com_pronto` (eventos na ordem; o `pronto` traz o bloco gravado), `test_gerar_fora_de_ordem_e_409`, `test_corpo_invalido_e_422`, `test_consulta_de_outro_medico_e_404` (todas as rotas com outro `MedicoLocal`), `test_finalizada_e_409_use_adendo`, `test_privacidade_e_422`.
- [ ] **Step 2–4.** Regerar `openapi.json` (`python -m app.openapi`) e rodar `tests/test_openapi.py`.
- [ ] **Step 5: Commit** — `"Rotas da consulta: etapas, oficialização, geração pela IA e documentos"`

---

### Task 7: Prontuário montado pelo servidor, finalizar e adendo

**Files:**
- Create: `backend/app/prontuario/montar.py`, `backend/app/api/prontuario.py`
- Modify: `backend/app/aplicacao.py`
- Test: `backend/tests/test_prontuario_montar.py`, `backend/tests/test_api_prontuario.py`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces (`app/prontuario/montar.py`, porte de `frontend/src/consulta/prontuario.ts` e `frontend/src/prontuario/registro.ts`):
  - `diagnosticos_do_prontuario(itens: list[ItemDD]) -> list[DiagnosticoRegistro]` — confirmados por `pct` desc (empate: ordem original, `None` por último) até 3 → `assinalado`; completam pendentes do mesmo jeito → `sugerido`; descartados nunca.
  - `dados_da_consulta(historia: HistoriaBloco, dd: DiagnosticosBloco, conduta: CondutaBloco, exame: ExameBloco, documentos: list[Documento]) -> DadosEntrada` — seções da história direto dos campos; `exames` dos complementares (`valor None` → `MISSING`, senão `PRESENT`; `origem = "laudo"`); `receita` = itens/livres da conduta + texto do documento `receita` **enviado** (sem ele, `None`); `conduta_texto` = textos dos grupos 1–3 juntos; grupo 4 separado por frase: "Solicito exames de rotina…" → "exames de rotina", "Solicito X." → "X" (`solicitado`), "Encaminho para X." → `encaminhado`, "Retorno …" → `retorno`, o resto → `orientacoes`; `documentos` = `registro` dos documentos atestado/laudo enviados; `fotos = []` (marco 5).
- Produces (rotas):
  - `GET /consultas/{id}/prontuario` → `DadosEntrada` proposto (exige as 5 etapas oficializadas e nenhuma desatualizada; senão 409 com a que falta).
  - `POST /consultas/{id}/finalizar` (corpo `{"edicoes": {chave: texto}}`) → 200 `EntradaProntuario`; exige o mesmo + todo documento gravado `enviado` ("Envie os documentos antes de finalizar").
  - `POST /consultas/{id}/adendos` (`{"texto", "motivo"}`) → 201; consulta aberta → 409 "adendo só em consulta finalizada".
  - `GET /pacientes/{id}/prontuario` → `list[EntradaProntuario]` (mais recente no topo).

- [ ] **Step 1: Testes que falham** — montar: `test_diagnosticos_sempre_ate_3_assinalados_primeiro`, `test_descartado_nunca_entra`, `test_grupo_4_separado_em_solicitado_encaminhado_retorno_orientacoes` (frases do kit e do exemplo da acne), `test_receita_so_com_documento_enviado`, `test_atestado_e_laudo_em_uma_linha`, `test_exames_missing`; API: `test_finalizar_grava_e_aparece_no_prontuario_do_paciente`, `test_finalizar_com_etapa_desatualizada_e_409`, `test_finalizar_com_documento_nao_enviado_e_409`, `test_adendo_so_depois_de_finalizar`, `test_entrada_finalizada_nao_muda` (PUT depois → 409).
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"Prontuário montado pelo servidor a partir dos blocos oficializados; finalizar e adendo"`

---

### Task 8: Repositório da consulta no Postgres (sob RLS)

**Files:**
- Create: `backend/app/consulta/repositorio_postgres.py`
- Test: `backend/tests/banco/test_repositorio_consulta_postgres.py`

**Interfaces:**
- Consumes: Task 2 (mesma interface), `transacao_do_medico` (`app/pacientes/repositorio_postgres.py`).
- Produces: `class RepositorioConsultasPostgres(url: str)` — tabelas por etapa conforme a decisão 5; `content` = `model_dump(by_alias=True, mode="json")`, `schema_version = VERSAO_ESQUEMA_BLOCO`; `stale` ↔ `desatualizado`; `encounters.record = {"dados": ..., "edicoes": ...}`, `record_schema_version = SCHEMA_VERSION_PRONTUARIO`; erros dos gatilhos (`raise exception 'consulta finalizada…'`, `'adendo só em consulta finalizada'`) traduzidos para `ConsultaFinalizada`/`ConsultaAberta`.

- [ ] **Step 1: Testes que falham** (`@pytest.mark.banco`, mesmo `conftest` dos testes de 0007/0008) — rodar os mesmos cenários da Task 2 contra o Postgres (parametrizar a fixture `repo` em memória e Postgres nos testes da Task 2, para não duplicar), mais `test_rls_isola_medicos` e `test_gatilho_de_finalizada_vira_consulta_finalizada`.
- [ ] **Step 2–4:** `.venv/Scripts/python -m pytest -m banco -q` com Docker.
- [ ] **Step 5: Commit** — `"Repositório da consulta no Postgres sob RLS"`

---

### Task 9: Ligar tudo no servidor real e registrar

**Files:**
- Create: `backend/app/provedores/ia_demonstracao.py` (mover `ProvedorDemonstracao` de `casos_de_teste/medir.py`)
- Modify: `backend/app/config.py` (`IA_PROVEDOR`: `anthropic` | `demonstracao`, padrão `demonstracao`; `anthropic` sem `ANTHROPIC_API_KEY` → `ErroConfiguracao`), `backend/app/main.py`, `backend/docker-compose.yml` (passa `IA_PROVEDOR` e `ANTHROPIC_API_KEY` do `.env`), `backend/README.md`
- Create: `docs/decisoes/0005-consulta-no-servidor.md` (as decisões deste plano, com as respostas do autor às perguntas)
- Test: `backend/tests/test_config.py`, `backend/tests/test_api_ponta_a_ponta.py`

- [ ] **Step 1: Testes que falham** — `test_ia_provedor_padrao_e_demonstracao`, `test_anthropic_sem_chave_falha_na_partida`, `test_consulta_ponta_a_ponta_com_demonstracao` (da criação do paciente ao `GET /pacientes/{id}/prontuario` com 1 entrada "Consulta 1", via API, provedor de demonstração).
- [ ] **Step 2–4:** + `docker compose up -d --build` e um `curl` em `/saude` e `/docs`.
- [ ] **Step 5: Uma consulta real** (com o ok do autor, ~US$ 0,20): o caso derm-001 pela API com `IA_PROVEDOR=anthropic`, mostrando ao autor história, diagnósticos e conduta gerados.
- [ ] **Step 6: Commit + push** — `"Marco 3B: a consulta no servidor (ADR 0005)"`; `git push -u origin servidor-consulta`.

---

## O que fica para o 3C (telas)

A tela troca a simulação pelas rotas, uma página por vez, com aprovação do autor: anamnese/exame → história → diagnósticos → conduta → documentos → prontuário. Tipos TS gerados do `openapi.json`; a tabela da acne passa a vir do servidor e `conduta-exemplo.ts`, `exemplo.ts`, `diagnosticos-exemplo.ts` e o `localStorage` do prontuário saem.
