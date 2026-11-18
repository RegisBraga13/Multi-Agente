# Servidor da Dermatologia — Marco 2: Esqueleto — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servidor FastAPI que roda local em Docker, com contratos tipados, política de decisão da IA, provedor de IA falso atrás de interface, privacidade antes da IA, banco da consulta (migration 0007 com RLS) e cadastro de paciente com id próprio — tudo testado, sem IA real ainda.

**Architecture:** Monólito modular em `backend/app/` (desenho §7.1). O banco é o dono do estado; o servidor acessa o Postgres **sob RLS** (em cada transação assume o papel `authenticated` com o `sub` do médico), então o isolamento por médico vale também para o backend. Serviços externos ficam atrás de `Protocol`s nossos (IA, relógio, identidade, repositório). Desenvolvimento e testes de banco usam Postgres local em Docker com um "calço" do esquema `auth` do Supabase; as mesmas migrations rodam no Supabase.

**Tech Stack:** Python 3.13 · FastAPI · Pydantic 2 · psycopg 3 · uvicorn · pytest · ruff · mypy · Docker (postgres:16-alpine) · GitHub Actions.

**Spec:** [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md) — §2, §6, §7.1, §7.2, §7.4, §7.5, §7.6, §8 item 2, §12. Regras: [docs/constituicao.md](../../constituicao.md), [docs/modelo-de-dados.md](../../modelo-de-dados.md).

## Global Constraints

- Domínio em português (paciente, consulta, prontuário, motor); termos do ecossistema em inglês. Nomes de tabela em inglês, como em `modelo-de-dados.md`.
- **Pydantic é a fonte única dos formatos.** JSON da API em camelCase (igual ao frontend: `exameFisico`, `examesTexto`), Python em snake_case (`alias_generator=to_camel`, `populate_by_name=True`, respostas `by_alias`).
- Estados de bloco: `rascunho_ia` → `revisado_medico` → `oficializado` (Constituição).
- Ação de política só `HUMAN_REVIEW` ou `REJECT`; **nunca** `AUTO_EXECUTE` de efeito clínico (§7.2).
- Registro de decisão: `decisionId`, motor, modelo, versão do modelo, versão do esquema, versão do prompt, confiança, ação, tokens, horário. **Sem** prompt nem dado pessoal (§7.2).
- Nada com nome, CPF, telefone, e-mail ou endereço vai ao provedor de IA; paciente = "Paciente, 34 anos, …" (§7.5).
- Toda tabela nova tem `doctor_id`, RLS ligada e política `doctor_id = auth.uid()`; `audit_log` só cresce.
- Entrada do prontuário guarda `DadosEntrada` em JSONB com `schema_version`; depois de finalizada nunca muda; correção só por adendo (§6).
- Leitura/escrita de arquivos com `encoding="utf-8"`. Comandos rodam em `backend/` com `.venv/Scripts/python`.
- Branch `servidor-esqueleto` criado a partir de `servidor-casos-de-teste`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Paciente de outro médico pedido pelo id** → 404, sem vazar nada → teste de API (Task 6) e de RLS (Task 5).
2. **Dado de identidade dentro dos dados enviados à IA** (nome numa fala, CPF) → a chamada é bloqueada antes do provedor e nada é registrado com o dado → Task 4.
3. **Saída da IA com campo a mais, tipo errado ou JSON quebrado** → `REJECT` e nenhum uso parcial → Task 4.
4. **Tentativa de alterar consulta finalizada ou apagar adendo** → o banco recusa → Task 5.
5. **Servidor iniciado sem `DATABASE_URL` ou `MEDICO_LOCAL_ID`** → falha na partida com mensagem clara, não no primeiro pedido → Task 6.

---

## Estrutura de arquivos

```
backend/
  pyproject.toml                    + fastapi, uvicorn, psycopg[binary], httpx; dev: ruff, mypy
  Dockerfile, .dockerignore
  app/
    main.py                         criar_app(dependencias) e app (uvicorn)
    config.py                       Configuracao (env)
    privacidade.py                  encontrar_identidade(), descrever_paciente()
    identidade.py                   Identidade (Protocol), MedicoLocal
    contratos/__init__.py
    contratos/base.py               ModeloApi (camelCase, extra=forbid)
    contratos/prontuario.py         DadosEntrada, EntradaProntuario, ItemReceita… (espelho de registro.ts)
    contratos/motor.py              Evidencia, PropostaIA[T], Acao, RegistroDecisao
    contratos/paciente.py           NovoPaciente, Paciente
    consulta/__init__.py
    consulta/politica.py            decidir()
    provedores/__init__.py
    provedores/ia.py                PedidoIA, RespostaIA, ProvedorIA (Protocol)
    provedores/ia_falso.py          ProvedorIAFalso
    provedores/relogio.py           Relogio (Protocol), RelogioSistema, RelogioFixo
    motores/__init__.py
    motores/chamada.py              chamar_motor(), ErroPrivacidade
    pacientes/__init__.py
    pacientes/repositorio.py        RepositorioPacientes (Protocol), RepositorioPacientesMemoria
    pacientes/repositorio_postgres.py  RepositorioPacientesPostgres, transacao_do_medico()
    api/__init__.py
    api/pacientes.py                rotas /pacientes
    api/saude.py                    GET /saude
  banco_local/00_auth_calco.sql     esquema auth mínimo do Supabase (só local/testes)
  banco_local/99_semente.sql        médico local fictício
  banco_local/aplicar.py            aplica calço + supabase/migrations/*.sql + semente numa URL
  docker-compose.yml                db (postgres:16-alpine) + api
  tests/banco/conftest.py           fixture: Postgres em Docker com tudo aplicado
  tests/banco/test_migracao_0007.py
  tests/banco/test_repositorio_postgres.py
  tests/test_privacidade.py, test_contratos.py, test_politica.py, test_chamada_motor.py, test_api_pacientes.py, test_config.py
supabase/migrations/0007_fase3_consulta.sql
.github/workflows/backend.yml
docs/decisoes/0003-banco-da-consulta.md
```

---

### Task 1: Ferramentas e checagens automáticas

**Files:** Modify `backend/pyproject.toml`, `backend/casos_de_teste/*.py` e `backend/app/especialidades/pacote.py` (só o que ruff/mypy apontarem) · Create `.github/workflows/backend.yml`

**Interfaces:** Produces: comandos `ruff check .`, `ruff format --check .`, `mypy app casos_de_teste`, `pytest` — todos verdes; marcador pytest `banco` (testes que precisam de Docker).

- [ ] **Step 1:** `git checkout -b servidor-esqueleto`. Em `pyproject.toml`: dependências `fastapi>=0.115`, `uvicorn[standard]>=0.32`, `psycopg[binary]>=3.2`; dev `ruff>=0.8`, `mypy>=1.13`, `httpx>=0.28`, `types-PyYAML`. `[tool.ruff] line-length = 120, target-version = "py312"`, `lint.select = ["E","F","I","B","UP","N"]`. `[tool.mypy] strict = true, plugins = ["pydantic.mypy"]`. `[tool.pytest.ini_options] markers = ["banco: precisa de Docker (Postgres local)"]`. Reinstalar: `.venv/Scripts/python -m pip install -e ".[dev]"`.
- [ ] **Step 2:** Rodar `ruff check . && ruff format --check . && mypy app casos_de_teste`. Esperado na primeira vez: apontamentos no código do marco 1.
- [ ] **Step 3:** Corrigir até os três passarem sem mudar comportamento; `pytest -q` → 71 passed.
- [ ] **Step 4:** `.github/workflows/backend.yml`: em push/PR que toque `backend/**` ou `supabase/**`, ubuntu-latest, Python 3.13, `working-directory: backend`, instala `.[dev]`, roda ruff, mypy e `pytest` (Docker já existe no runner, então os testes `banco` rodam lá).
- [ ] **Step 5:** Commit "Backend: ruff, mypy e checagens no GitHub".

---

### Task 2: Privacidade antes da IA

**Files:** Create `backend/app/privacidade.py`, `backend/tests/test_privacidade.py` · Modify `backend/casos_de_teste/carregar.py` (passa a importar daqui)

**Interfaces:**
- Produces: `encontrar_identidade(texto: str) -> list[str]` — tipos encontrados entre `"CPF"`, `"telefone"`, `"e-mail"` (padrões atuais de `casos_de_teste/carregar.py`, movidos sem mudança); `descrever_paciente(idade: int, sexo: Literal["F","M"], estado_civil: str | None, profissao: str | None) -> str`.

- [ ] **Step 1: Testes que falham:**

```python
def test_descreve_sem_identidade():
    assert descrever_paciente(52, "M", "casado", "comerciante") == "Paciente, 52 anos, masculino, casado, comerciante"
    assert descrever_paciente(34, "F", None, None) == "Paciente, 34 anos, feminino"

@pytest.mark.parametrize("texto,tipo", [("CPF 123.456.789-09", "CPF"), ("zap 98765-4321", "telefone"), ("ana@x.com", "e-mail")])
def test_encontra_identidade(texto, tipo):
    assert tipo in encontrar_identidade(texto)

def test_numero_clinico_nao_e_identidade():
    assert encontrar_identidade("Plaquetas 250.000-300.000; lesão de 8 mm em 2019") == []
```
- [ ] **Step 2:** `pytest tests/test_privacidade.py -v` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar; `carregar.py` usa `encontrar_identidade` (apaga o dicionário local).
- [ ] **Step 4:** `pytest -q` → tudo verde (os testes de identidade do marco 1 continuam passando).
- [ ] **Step 5:** Commit "Privacidade: detecção de identidade e descrição do paciente sem nome".

---

### Task 3: Contratos e política de decisão

**Files:** Create `app/contratos/base.py`, `prontuario.py`, `motor.py`, `paciente.py`, `app/consulta/politica.py`, `tests/test_contratos.py`, `tests/test_politica.py`, `tests/dados/entrada_joao.json`

**Interfaces:**
- `ModeloApi(BaseModel)`: `ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True)`.
- `contratos/prontuario.py` — espelho exato de `frontend/src/prontuario/registro.ts` e `ItemReceita` de `frontend/src/consulta/conduta.ts`: `ItemReceita`, `DiagnosticoRegistro` (situacao `assinalado|sugerido`), `ExameRegistro` (status `PRESENT|INFERRED|MISSING`), `FotoRegistro`, `DocumentoRegistro` (união discriminada por `tipo`: `atestado|laudo`), `ReceitaRegistro`, `DadosEntrada` (`diagnosticos` com no máximo 3), `Adendo`, `EntradaProntuario`. Constante `SCHEMA_VERSION_PRONTUARIO = 1`.
- `contratos/motor.py`: `Acao = Literal["HUMAN_REVIEW", "REJECT"]`; `Evidencia(trecho: str, origem: str)`; `PropostaIA(Generic[T])` com `resultado: T | None`, `confianca: float` (0–1), `evidencias: list[Evidencia]`, `avisos: list[str]`, `origem: str`, `acao: Acao`, `motivos: list[str]`; `RegistroDecisao(decision_id: UUID, motor: str, modelo: str, versao_modelo: str, versao_esquema: int, versao_prompt: str, confianca: float | None, acao: Acao, tokens_entrada: int, tokens_saida: int, quando: datetime)`.
- `contratos/paciente.py`: `NovoPaciente(nome: str, nascimento: date, sexo: Literal["F","M"], estado_civil: str | None = None, profissao: str | None = None, cpf: str | None = None  # 11 dígitos, telefone: str | None = None)`; `Paciente(NovoPaciente)` + `id: UUID`, `criado_em: datetime`.
- `consulta/politica.py`: `decidir(estrutura_valida: bool, confianca: float | None) -> tuple[Acao, list[str]]` — inválida → `("REJECT", ["saída estruturalmente inválida"])`; válida → `("HUMAN_REVIEW", ["toda proposta é revisada pelo médico (Constituição)"])`, qualquer confiança. `confianca` entra só como sinal registrado (thresholds a calibrar no marco 3).

- [ ] **Step 1: Testes que falham** (`tests/dados/entrada_joao.json` = o objeto `EXEMPLOS[JOAO_ID][0]` de `registro.ts`, transcrito em JSON):

```python
def test_entrada_do_frontend_valida_sem_perda():
    bruto = json.loads(Path("tests/dados/entrada_joao.json").read_text(encoding="utf-8"))
    entrada = EntradaProntuario.model_validate(bruto)
    assert entrada.dados.exame_fisico.startswith("Placas")
    assert entrada.model_dump(by_alias=True, mode="json") == bruto

def test_mais_de_3_diagnosticos_e_recusado(): ...   # 4 diagnósticos → ValidationError
def test_campo_desconhecido_no_prontuario_e_recusado(): ...  # dados.extra → ValidationError
def test_confianca_fora_de_0_1_e_recusada(): ...    # PropostaIA(confianca=1.2, ...) → ValidationError
def test_auto_execute_nao_existe(): ...              # PropostaIA(acao="AUTO_EXECUTE", ...) → ValidationError
def test_cpf_com_letras_e_recusado(): ...            # NovoPaciente(cpf="123abc") → ValidationError

def test_invalida_rejeita(): assert decidir(False, None)[0] == "REJECT"
@pytest.mark.parametrize("c", [0.0, 0.5, 0.99, 1.0])
def test_valida_sempre_vai_ao_medico(c): assert decidir(True, c)[0] == "HUMAN_REVIEW"
```
- [ ] **Step 2:** `pytest tests/test_contratos.py tests/test_politica.py -v` → FAIL.
- [ ] **Step 3:** Implementar os módulos. `quantidade` de `ItemReceita` é objeto `{n, unidade, feminino}`; `controlado` opcional, omitido no dump quando ausente (`exclude_none` no teste de ida e volta só se o JSON do frontend não tiver a chave).
- [ ] **Step 4:** Testes → PASS; `ruff`/`mypy` verdes.
- [ ] **Step 5:** Commit "Contratos do prontuário e dos motores; política: tudo vai ao médico".

---

### Task 4: Provedores e chamada de motor

**Files:** Create `app/provedores/ia.py`, `ia_falso.py`, `relogio.py`, `app/motores/chamada.py`, `tests/test_chamada_motor.py`

**Interfaces:**
- `PedidoIA(motor: str, versao_prompt: str, instrucoes: str, dados: dict[str, Any])` (dataclass congelada).
- `RespostaIA(bruto: dict[str, Any] | None, modelo: str, versao_modelo: str, tokens_entrada: int, tokens_saida: int, erro: str | None)`.
- `class ProvedorIA(Protocol): def gerar(self, pedido: PedidoIA, esquema: type[BaseModel]) -> RespostaIA`.
- `ProvedorIAFalso(respostas: dict[str, dict[str, Any] | str])` — por motor; `dict` = JSON devolvido, `str` = erro; registra `self.pedidos: list[PedidoIA]`; modelo `"falso"`, versão `"0"`, tokens 0.
- `class Relogio(Protocol): def agora(self) -> datetime`; `RelogioSistema` (UTC), `RelogioFixo(quando: datetime)`.
- `class ErroPrivacidade(Exception)`.
- `chamar_motor(provedor: ProvedorIA, pedido: PedidoIA, esquema: type[T], versao_esquema: int, relogio: Relogio, registrar: Callable[[RegistroDecisao], None]) -> PropostaIA[T]` — ordem: (1) varre todos os textos de `pedido.dados` com `encontrar_identidade`; achou → `ErroPrivacidade` com os tipos, **sem** chamar o provedor e sem registrar; (2) chama o provedor; (3) erro ou `esquema.model_validate(bruto)` falha → proposta com `resultado=None`, `acao="REJECT"`; (4) válida → `resultado` validado, `confianca`/`evidencias`/`avisos`/`origem` lidos do campo `meta` do bruto, ação por `decidir()`; (5) registra um `RegistroDecisao` com `uuid4()` e `relogio.agora()`.

- [ ] **Step 1: Testes que falham** (esquema de teste `Hipoteses(ModeloApi): nomes: list[str]`; bruto válido `{"resultado": {"nomes": ["Acne"]}, "meta": {"confianca": 0.8, "evidencias": [], "avisos": [], "origem": "sugestão da IA"}}`):

```python
def test_saida_valida_vai_ao_medico_e_e_registrada(): ...  # acao HUMAN_REVIEW, resultado.nomes == ["Acne"], 1 registro com motor/modelo/versões e quando == RelogioFixo
def test_saida_com_campo_a_mais_e_rejeitada(): ...         # resultado {"nomes": [...], "x": 1} → REJECT, resultado None
def test_saida_com_tipo_errado_e_rejeitada(): ...          # {"nomes": "Acne"} → REJECT
def test_erro_do_provedor_e_rejeitado(): ...               # respostas["dd"] = "timeout" → REJECT, registrado
def test_identidade_nos_dados_bloqueia_antes_do_provedor():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO}); registros = []
    pedido = PedidoIA("dd", "v1", "…", {"falas": [{"texto": "Meu CPF é 123.456.789-09"}]})
    with pytest.raises(ErroPrivacidade):
        chamar_motor(falso, pedido, Hipoteses, 1, RelogioFixo(QUANDO), registros.append)
    assert falso.pedidos == [] and registros == []
def test_registro_nao_guarda_prompt_nem_dados(): ...       # campos de RegistroDecisao.model_dump() não contêm instrucoes nem valores de dados
```
- [ ] **Step 2:** `pytest tests/test_chamada_motor.py -v` → FAIL.
- [ ] **Step 3:** Implementar. O envelope `{"resultado": …, "meta": …}` é o formato que os prompts do marco 3 vão pedir; `meta` inválido também → `REJECT`.
- [ ] **Step 4:** Testes → PASS; ruff/mypy verdes.
- [ ] **Step 5:** Commit "Provedor de IA atrás de interface, provedor falso e chamada de motor com privacidade e registro".

---

### Task 5: Banco da consulta (migration 0007) testado em Postgres local

**Files:** Create `supabase/migrations/0007_fase3_consulta.sql`, `backend/banco_local/00_auth_calco.sql`, `99_semente.sql`, `aplicar.py`, `backend/tests/banco/conftest.py`, `test_migracao_0007.py`, `docs/decisoes/0003-banco-da-consulta.md`

**Interfaces:**
- `banco_local/aplicar.py`: `aplicar(url: str) -> None` — executa, em ordem, `00_auth_calco.sql`, todos os `supabase/migrations/*.sql` por nome, `99_semente.sql`. CLI: `python -m banco_local.aplicar <url>`.
- `00_auth_calco.sql`: papéis `anon`, `authenticated`, `service_role` (nologin); esquema `auth`; `auth.users(id uuid pk, email text, raw_user_meta_data jsonb)`; `auth.uid()` = `nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid`. É só o necessário para 0001–0007 rodarem como no Supabase.
- `99_semente.sql`: insere em `auth.users` o médico local `00000000-0000-4000-8000-000000000001` com `raw_user_meta_data = {"crm":"123456","uf":"SP","nome":"Médico Local (fictício)","especialidade":"dermatologia"}` (o gatilho da 0005 cria o médico).
- `tests/banco/conftest.py`: fixture de sessão `url_banco` — sobe `postgres:16-alpine` com `docker run -d --rm -P -e POSTGRES_PASSWORD=teste`, espera ficar pronto, roda `aplicar(url)`, entrega a URL e remove o contêiner no fim. Sem Docker rodando → `pytest.fail` com "Inicie o Docker Desktop". Todos os testes da pasta levam `pytestmark = pytest.mark.banco`. Ajudante `como_medico(conn, medico_id)` = `set local role authenticated` + `set_config('request.jwt.claims', '{"sub": …}', true)`.

`0007_fase3_consulta.sql` (comentários em português, padrão da 0001):

| Tabela | Colunas essenciais | Regras |
|---|---|---|
| `patients` | `id uuid pk default gen_random_uuid()`, `doctor_id`, `full_name`, `birth_date`, `sex char(1)` F/M, `marital_status`, `occupation`, `cpf` (null, `^\d{11}$`), `phone`, `created_at`, `updated_at` | id próprio, nunca muda; CPF é cadastro, único por médico quando presente |
| `encounters` | `id`, `doctor_id`, `patient_id`, `kind` (`consulta`/`retorno`), `modality` (`presencial`/`online`), `scheduled_at`, `finalized_at`, `record jsonb`, `record_schema_version int` | `(finalized_at is null) = (record is null)`; finalizada → UPDATE/DELETE recusados por gatilho |
| `transcripts`, `clinical_facts`, `clinical_histories`, `diagnostic_hypotheses`, `care_plans` | `id`, `doctor_id`, `encounter_id` (único), `status estado_bloco`, `content jsonb`, `schema_version int`, `stale bool default false`, `officialized_at`, `created_at`, `updated_at` | um **bloco** por consulta (anamnese, exame, história, DD, conduta); `(status = 'oficializado') = (officialized_at is not null)`; consulta finalizada → bloco imutável |
| `documents` | `id`, `doctor_id`, `encounter_id`, `kind` (`receita`,`exames`,`encaminhamento`,`orientacoes`,`atestado`,`laudo`), `status` (`rascunho`,`revisado`,`assinado`,`enviado`), `content jsonb`, `signed_at`, `sent_at` | anexos da consulta |
| `ai_proposals` | `decision_id uuid pk`, `doctor_id`, `encounter_id`, `motor`, `model`, `model_version`, `schema_version`, `prompt_version`, `confidence numeric` (0–1, null), `action` (`HUMAN_REVIEW`/`REJECT`), `tokens_in`, `tokens_out`, `content jsonb`, `created_at` | só INSERT (gatilho) |
| `addenda` | `id`, `doctor_id`, `encounter_id`, `text`, `reason`, `created_at` | só INSERT; só em consulta finalizada |

Enum `estado_bloco ('rascunho_ia','revisado_medico','oficializado')`. Em todas: RLS + políticas `select/insert/update` com `doctor_id = auth.uid()` (sem `delete` para `authenticated`); `touch_updated_at` e `audit_write` da 0001; grants espelhando a 0002 (authenticated: select/insert/update; service_role: tudo). `attachments` fica para o marco 5 (fotos).

- [ ] **Step 1: Testes que falham** em `test_migracao_0007.py`:

```python
def test_paciente_ganha_id_proprio(...)                # insert sem id → id uuid gerado
def test_medico_nao_ve_paciente_de_outro(...)          # médico B (2º usuário semeado no teste) → select de paciente do A retorna 0 linhas
def test_medico_nao_insere_em_nome_de_outro(...)       # insert com doctor_id do A estando como B → erro de RLS
def test_consulta_finalizada_nao_muda(...)             # update de record após finalized_at → erro "consulta finalizada"
def test_bloco_de_consulta_finalizada_nao_muda(...)    # update em clinical_histories → erro
def test_oficializado_exige_data(...)                  # status oficializado sem officialized_at → erro de check
def test_adendo_so_insere(...)                         # update/delete em addenda → erro; insert em consulta aberta → erro
def test_proposta_da_ia_so_insere_e_nao_aceita_auto_execute(...)
def test_cpf_e_opcional_e_unico_por_medico(...)
```
- [ ] **Step 2:** Iniciar o Docker Desktop se não estiver rodando (`"C:/Program Files/Docker/Docker/Docker Desktop.exe"`, esperar `docker info` responder). `pytest tests/banco -v` → FAIL (0007 não existe).
- [ ] **Step 3:** Escrever calço, semente, `aplicar.py` e a 0007.
- [ ] **Step 4:** `pytest -v` → tudo PASS (inclusive os 71 anteriores).
- [ ] **Step 5:** ADR `0003-banco-da-consulta.md` (≤ 20 linhas): um bloco por consulta por tabela (o que se oficializa é o bloco — Constituição), com a lista dentro do `content` (desvio consciente de "uma linha por fato/hipótese"); servidor sob RLS via claims; Postgres local com calço para desenvolvimento e testes, mesmas migrations do Supabase.
- [ ] **Step 6:** Commit "Banco da consulta (0007): pacientes, consultas, blocos, anexos, propostas da IA e adendos, sob RLS".

---

### Task 6: Servidor FastAPI e pacientes

**Files:** Create `app/config.py`, `identidade.py`, `pacientes/repositorio.py`, `pacientes/repositorio_postgres.py`, `api/saude.py`, `api/pacientes.py`, `main.py`, `tests/test_config.py`, `tests/test_api_pacientes.py`, `tests/banco/test_repositorio_postgres.py`

**Interfaces:**
- `Configuracao(database_url: str, medico_local_id: UUID)`; `carregar_configuracao(env: Mapping[str, str] = os.environ) -> Configuracao` — falta variável → `ErroConfiguracao("faltou DATABASE_URL")` / `("faltou MEDICO_LOCAL_ID")`; id inválido → `ErroConfiguracao` com o nome da variável.
- `class Identidade(Protocol): def medico_atual(self) -> UUID`; `MedicoLocal(medico_id: UUID)` — primeiro uso: só o autor, local (§10); login real fica para os portões (§11).
- `class RepositorioPacientes(Protocol)`: `criar(medico_id: UUID, novo: NovoPaciente) -> Paciente`; `buscar(medico_id: UUID, paciente_id: UUID) -> Paciente | None`. `RepositorioPacientesMemoria` (testes de API). `RepositorioPacientesPostgres(url: str)` — cada operação em `transacao_do_medico(conn, medico_id)` (papel `authenticated` + claims), então a RLS filtra.
- `@dataclass Dependencias(identidade: Identidade, pacientes: RepositorioPacientes)`; `criar_app(dep: Dependencias) -> FastAPI`; em `main.py`, `app = criar_app(...)` montado de `carregar_configuracao()` na importação (falha na partida, Review Focus 5).
- Rotas: `GET /saude` → `{"ok": true}`; `POST /pacientes` (corpo `NovoPaciente`) → 201 + `Paciente`; `GET /pacientes/{id}` → 200 `Paciente` ou 404 `{"detail": "paciente não encontrado"}`. JSON em camelCase.

- [ ] **Step 1: Testes que falham:**

```python
def test_falta_database_url():  with pytest.raises(ErroConfiguracao, match="DATABASE_URL"): carregar_configuracao({"MEDICO_LOCAL_ID": ID})
def test_medico_id_invalido():  with pytest.raises(ErroConfiguracao, match="MEDICO_LOCAL_ID"): carregar_configuracao({"DATABASE_URL": "x", "MEDICO_LOCAL_ID": "abc"})

def test_cria_paciente_com_id_proprio(cliente): r = cliente.post("/pacientes", json={"nome": "Ana Teste", "nascimento": "1992-03-14", "sexo": "F"}); assert r.status_code == 201 and UUID(r.json()["id"])
def test_paciente_de_outro_medico_e_404(): ...   # cria como médico A (memória), app com MedicoLocal(B) → GET → 404, corpo sem dados
def test_corpo_invalido_e_422(cliente): ...      # sexo "X" → 422
def test_json_em_camel_case(cliente): ...         # resposta tem "estadoCivil", não "estado_civil"

# tests/banco/test_repositorio_postgres.py (pytest.mark.banco)
def test_cria_e_busca_no_postgres(url_banco): ...
def test_postgres_nao_devolve_paciente_de_outro_medico(url_banco): ...  # buscar como B → None (RLS)
```
- [ ] **Step 2:** `pytest tests/test_config.py tests/test_api_pacientes.py tests/banco/test_repositorio_postgres.py -v` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pytest -v` → PASS; ruff/mypy verdes.
- [ ] **Step 5:** Commit "Servidor FastAPI: configuração, identidade local e cadastro de paciente com id próprio".

---

### Task 7: Docker, README e OpenAPI

**Files:** Create `backend/Dockerfile`, `backend/.dockerignore`, `backend/docker-compose.yml` · Modify `backend/README.md` · Test: `tests/test_openapi.py`

**Interfaces:** `docker compose up` sobe `db` (postgres:16-alpine; um serviço de inicialização roda `python -m banco_local.aplicar`) e `api` (uvicorn `app.main:app` na porta 8000, `DATABASE_URL` apontando para `db`, `MEDICO_LOCAL_ID=00000000-0000-4000-8000-000000000001`). `python -m app.openapi` grava `backend/openapi.json` (base dos tipos TypeScript gerados no marco 3).

- [ ] **Step 1: Teste que falha:** `test_openapi_publica_pacientes()` — `criar_app(...).openapi()["paths"]` contém `/pacientes` e `/pacientes/{paciente_id}`, e o esquema `Paciente` tem a propriedade `estadoCivil`.
- [ ] **Step 2:** `pytest tests/test_openapi.py -v` → FAIL (falta `app/openapi.py`).
- [ ] **Step 3:** Implementar `app/openapi.py`, Dockerfile (python:3.13-slim, usuário sem root, instala o pacote, `CMD uvicorn app.main:app --host 0.0.0.0 --port 8000`), `.dockerignore` (`.venv`, `tests`, `__pycache__`), compose.
- [ ] **Step 4:** Verificar de ponta a ponta: `docker compose up -d --build`; `curl -s localhost:8000/saude` → `{"ok":true}`; `POST /pacientes` com paciente fictício → 201 com `id`; `GET` do mesmo id → 200; `docker compose down -v`.
- [ ] **Step 5:** README: como subir com Docker, variáveis, onde ficam contratos/provedores/migrations, como rodar só os testes rápidos (`pytest -m "not banco"`).
- [ ] **Step 6:** Commit "Docker, README e OpenAPI do servidor"; `git push -u origin servidor-esqueleto`.

---

### Task 8: Aplicar a 0007 no Supabase

**Files:** nenhum (operação no projeto "Multi-Agente", sa-east-1)

- [ ] **Step 1:** Com o token de `.env.supabase` (fora do git), enviar o conteúdo de `0007_fase3_consulta.sql` pela Management API (`POST /v1/projects/{ref}/database/query`), como foi feito com 0001–0006.
- [ ] **Step 2:** Conferir pela mesma API: as 10 tabelas existem e todas têm `relrowsecurity = true`. Esperado: 10 linhas, todas `true`.
- [ ] **Step 3:** Nenhum dado é inserido no Supabase neste marco (só estrutura).

---

## O que fica para depois (não é deste marco)

- Adaptador Anthropic, prompts, avaliadora dos casos e injeção da ação fixa de emergência na conduta → marco 3.
- `ProvedorTranscricao` (Deepgram) → marco 4; `Arquivos` e tabela `attachments` → marco 5.
- Geração dos tipos TypeScript a partir do `openapi.json` → marco 3, quando o frontend passar a chamar o servidor.
- Thresholds de confiança: hoje só registrados; calibração com os casos de teste no marco 3.
