# Marco 3A — Motores com IA real e medição nos casos de teste — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os motores de texto da Dermatologia (história, sinais de alerta, diagnósticos diferenciais, conduta) rodando com Claude de verdade, e um comando que mede cada motor nos 20 casos aprovados, com IA avaliadora + regras, custo e tempo.

**Architecture:** Cada motor é uma função pura `motor(provedor, entrada, ...) -> PropostaIA[T]` que monta um pedido desidentificado, chama `chamar_motor` (privacidade → provedor → validação estrita → política → registro) e aplica as regras fixas do pacote. O adaptador Anthropic implementa a interface `ProvedorIA` já existente (troca de fornecedor = troca de adaptador). A medição encadeia os motores como um "médico simulado" que aceita a história da IA e confirma o diagnóstico esperado, e grava um relatório JSON.

**Tech Stack:** Python 3.12, Pydantic 2, SDK oficial `anthropic` (Python), PyYAML, pytest, ruff, mypy strict.

**Spec:** [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md) (§7.2–7.5, §7.8, §8 marco 3, §12) e [ADR 0002](../../decisoes/0002-avaliacao-por-criterios-clinicos.md).

**Divisão do marco 3 (proposta minha):** o §8 junta três subsistemas independentes. Este plano é o **3A** (motores + medição, só backend, sem banco nem tela). Depois: **3B** — rotas da consulta, blocos/estados/oficialização no Postgres, SSE, anexos e prontuário gravado; **3C** — o frontend troca a simulação pelas chamadas, uma página por vez com aprovação do autor. O 3A vem primeiro porque é ele que diz, com números, se os motores servem.

**Branch:** `servidor-motores`, a partir de `master` (8611d51).

## Global Constraints

- Modelo: `claude-opus-5-5` em todos os motores e na avaliadora (desenho §5: descer de modelo só onde os casos mostrarem qualidade igual).
- Esforço inicial (`output_config.effort`, desenho §9): historia `medium`, sinais `low`, diagnosticos `high`, conduta `medium`, avaliadora `medium`. Thinking: omitir o parâmetro (no Opus 5.5 é sempre adaptativo; `disabled` dá 400).
- Recusa: `betas=["server-side-fallback-2026-07-01"]` + `fallbacks="default"` (desenho §7.4). `stop_reason == "refusal"` → erro `"recusa"`; `"max_tokens"` → erro `"saída cortada"`.
- Toda proposta: `HUMAN_REVIEW` se válida, `REJECT` se inválida (política existente, `app/consulta/politica.py`). Nunca `AUTO_EXECUTE`.
- Nada de identidade vai à IA: `encontrar_identidade` + **termos proibidos do paciente** (nome, CPF, telefone) — condição do marco 2 para o marco 3.
- Registro por chamada: `RegistroDecisao` existente (sem prompt, sem dado).
- Prompts versionados no repositório, por especialidade: `app/especialidades/dermatologia/prompts/<motor>.md`, primeira linha `versao: <motor>-derm-N`.
- Termos do domínio em português; JSON em camelCase (`ModeloApi`); `extra="forbid"`.
- Rodada real custa dinheiro: só com a chave do autor e com o ok dele para o custo estimado (Task 10).
- Comandos: `.venv/Scripts/python -m pytest -m "not banco"`, `.venv/Scripts/python -m ruff check .`, `.venv/Scripts/python -m mypy app casos_de_teste banco_local` (rodar de `backend/`).

## Review Focus

1. **Recusa ou saída cortada do modelo** → a proposta vira `REJECT` com o motivo, nada parcial chega adiante, e a medição conta como "saída inválida" sem parar os outros casos. Testes: Task 2 (`test_recusa_vira_erro`, `test_saida_cortada_vira_erro`), Task 9 (`test_motor_rejeitado_nao_para_a_medicao`).
2. **Sinal de urgência imediata com a IA falhando** → a ação fixa de emergência entra na conduta mesmo com o motor de conduta em `REJECT`. Teste: Task 7 (`test_emergencia_entra_mesmo_com_ia_rejeitada`).
3. **Evidência inventada no DD** (trecho que não está na história) → a evidência é descartada com aviso; hipótese sem nenhuma evidência a favor sai. Teste: Task 5 (`test_trecho_inventado_e_descartado`).
4. **Nome do paciente dentro de uma fala** ("Sou a Mariana…") → bloqueado antes do provedor, nada enviado. Teste: Task 1 (`test_termo_proibido_bloqueia_sem_diferenciar_acento_e_caixa`).
5. **Esquema Pydantic com restrição que a saída estruturada não aceita** (mínimo/máximo, tamanho, `$ref`) → o esquema enviado é simplificado e a validação estrita do Pydantic continua valendo depois. Teste: Task 2 (`test_esquema_de_todos_os_motores_e_aceito`).

---

### Task 1: Entrada desidentificada da consulta e termos proibidos

**Files:**
- Create: `backend/app/contratos/consulta.py`
- Modify: `backend/app/provedores/ia.py` (campo `esforco`), `backend/app/motores/chamada.py` (parâmetro `termos_proibidos`)
- Create: `backend/casos_de_teste/entrada.py` (caso → entrada)
- Test: `backend/tests/test_entrada_consulta.py`, `backend/tests/test_chamada_motor.py`

**Interfaces:**
- Produces:
  - `app/contratos/consulta.py`:
    - `class SinalRespondido(ModeloApi)`: `id: str`, `texto: str`, `resposta: Literal["sim", "nao"]`
    - `class Alergia(ModeloApi)`: `substancia: str`, `reacao: str`
    - `class Fala(ModeloApi)`: `quem: Literal["Médico", "Paciente"]`, `texto: str`
    - `class ExameDerm(ModeloApi)`: `morfologia, localizacao, extensao, gravidade, achados: str | None` (None = não examinado)
    - `class ItemComplementar(ModeloApi)`: `nome: str`, `valor: str | None`; `class ExameComplementar(ModeloApi)`: `exame: str`, `data: date`, `itens: list[ItemComplementar]`
    - `class EntradaConsulta(ModeloApi)`: `paciente: str` (saída de `descrever_paciente`), `em_uso: list[str]`, `antecedentes: list[str]`, `alergias: list[Alergia]`, `falas: list[Fala]`, `sinais: list[SinalRespondido]`, `exame: ExameDerm`, `complementares: list[ExameComplementar]`
  - `PedidoIA` ganha `esforco: Literal["low", "medium", "high"] = "medium"` (último campo).
  - `chamar_motor(..., registrar, termos_proibidos: Sequence[str] = ())` — termo encontrado (sem diferença de caixa e acento, palavra inteira) → `ErroPrivacidade` antes do provedor; a mensagem diz só "termo proibido do paciente", nunca o termo.
  - `casos_de_teste/entrada.py`: `entrada_do_caso(caso: Caso, sinais: dict[str, SinalAlerta]) -> EntradaConsulta` (texto do sinal vem da lista fixa; `v`→`sim`, `f`→`nao`).

- [ ] **Step 1: Testes que falham**

```python
# tests/test_entrada_consulta.py
def test_entrada_do_caso_desidentificada():
    caso = Caso.model_validate(caso_minimo() | {...})  # paciente 34 F, estado_civil "casada"
    e = entrada_do_caso(caso, {s.id: s for s in carregar_sinais("dermatologia")})
    assert e.paciente == "Paciente, 34 anos, feminino, casada"
    assert e.exame.morfologia == "Pápulas e pústulas"

def test_sinal_respondido_leva_o_texto_da_lista_fixa():
    # caso com sinais [{sinal: angioedema, resposta: v}]
    assert e.sinais == [SinalRespondido(id="angioedema", texto="Inchaço de lábios/língua ou falta de ar", resposta="sim")]

def test_todos_os_casos_aprovados_viram_entrada():
    for caso in validar_pasta(PASTA_CASOS, sinais).casos:
        entrada_do_caso(caso, por_id)  # não levanta

# tests/test_chamada_motor.py
def test_termo_proibido_bloqueia_sem_diferenciar_acento_e_caixa():
    falso = ProvedorIAFalso({"dd": BRUTO_VALIDO})
    with pytest.raises(ErroPrivacidade) as erro:
        chamar_motor(falso, pedido({"falas": ["Sou a MARIANA, tenho espinhas"]}), Hipoteses, 3,
                     RelogioFixo(QUANDO), [].append, termos_proibidos=["Mariána"])
    assert falso.pedidos == [] and "Mariana" not in str(erro.value).lower().title()

def test_termo_proibido_e_palavra_inteira():
    # termo "Ana" não bloqueia "banana" nem "anamnese"
    proposta, _, _ = chamar(BRUTO_VALIDO, {"t": "anamnese e banana"}, termos=["Ana"])
    assert proposta.acao == "HUMAN_REVIEW"
```

(`chamar` do arquivo de teste ganha o parâmetro `termos`.)

- [ ] **Step 2: Rodar e ver falhar** — `.venv/Scripts/python -m pytest tests/test_entrada_consulta.py tests/test_chamada_motor.py -v` → ImportError / TypeError.
- [ ] **Step 3: Implementar** os modelos, o campo `esforco`, `termos_proibidos` (normalizar com `unicodedata.normalize("NFKD")` sem marcas combinantes + `casefold()`, regex `\b<termo>\b`; termo vazio ignorado) e `entrada_do_caso`.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando + `-m "not banco"` inteiro.
- [ ] **Step 5: Commit** — `git commit -m "Entrada desidentificada da consulta e termos proibidos do paciente antes da IA"`

---

### Task 2: Adaptador Anthropic

**Files:**
- Modify: `backend/pyproject.toml` (dependência `anthropic>=1.0`; confirmar a versão publicada com `pip index versions anthropic` antes de fixar)
- Create: `backend/app/provedores/ia_anthropic.py`, `backend/app/provedores/esquema_saida.py`
- Test: `backend/tests/test_ia_anthropic.py`, `backend/tests/test_esquema_saida.py`

**Interfaces:**
- Consumes: `PedidoIA`, `RespostaIA`, `ProvedorIA` (`app/provedores/ia.py`); `_Meta` da chamada (mover para `app/contratos/motor.py` como `MetaProposta`, público).
- Produces:
  - `esquema_envelope(esquema: type[BaseModel]) -> dict[str, Any]` — JSON Schema de `{"resultado": <esquema>, "meta": MetaProposta}` pronto para `output_config.format`.
  - `class ProvedorAnthropic` com `__init__(self, cliente: Any, modelo: str = "claude-opus-5-5", max_tokens: int = 16000)` e `gerar(pedido, esquema) -> RespostaIA`.
  - `criar_provedor_anthropic() -> ProvedorAnthropic` (usa `anthropic.Anthropic()`; credencial pelo ambiente).

`esquema_envelope`: `model_json_schema(by_alias=True)`, resolver `$ref`/`$defs` em linha, e em todo objeto `additionalProperties: false` + `required` = todas as propriedades; remover `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `default`, `title`. As restrições continuam valendo na validação estrita do Pydantic em `chamar_motor`.

`gerar`: `cliente.beta.messages.stream(model=..., max_tokens=..., betas=["server-side-fallback-2026-07-01"], fallbacks="default", output_config={"effort": pedido.esforco, "format": {"type": "json_schema", "schema": esquema_envelope(esquema)}}, system=[{"type": "text", "text": pedido.instrucoes, "cache_control": {"type": "ephemeral"}}], messages=[{"role": "user", "content": json.dumps(pedido.dados, ensure_ascii=False, sort_keys=True)}])` → `get_final_message()`. `modelo` e `versao_modelo` = `mensagem.model` (registra o modelo que de fato respondeu, inclusive o de fallback). Tokens de `usage.input_tokens` + `cache_read_input_tokens` + `cache_creation_input_tokens` e `usage.output_tokens`. Erros do SDK (`anthropic.APIStatusError`, `anthropic.APIConnectionError`) viram `RespostaIA(erro=...)` com o nome da classe, nunca exceção.

- [ ] **Step 1: Testes que falham** (cliente falso que imita `beta.messages.stream(...)` como gerenciador de contexto e devolve uma mensagem com `content`, `stop_reason`, `model`, `usage`)

```python
def test_json_valido_vira_bruto(): ...            # bruto == dict do texto; erro None; modelo "claude-opus-5-5"
def test_pedido_leva_esforco_esquema_fallback_e_cache():
    kw = cliente.ultima_chamada
    assert kw["output_config"]["effort"] == "high"
    assert kw["fallbacks"] == "default" and kw["betas"] == ["server-side-fallback-2026-07-01"]
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "thinking" not in kw and "temperature" not in kw
def test_recusa_vira_erro():        # stop_reason "refusal" → bruto None, erro "recusa"
def test_saida_cortada_vira_erro(): # stop_reason "max_tokens" → erro "saída cortada"
def test_texto_que_nao_e_json_vira_erro()
def test_erro_de_conexao_nao_levanta()
def test_tokens_somam_cache()

# test_esquema_saida.py
PROIBIDAS = {"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength",
             "minItems", "maxItems", "pattern", "$ref", "$defs", "default"}
@pytest.mark.parametrize("esquema", [HistoriaClinica, SinaisIA, DiagnosticosIA, ComplementoConduta, CondutaIA, AvaliacaoIA])
def test_esquema_de_todos_os_motores_e_aceito(esquema):
    s = esquema_envelope(esquema)
    assert not PROIBIDAS & chaves_recursivas(s)
    assert todos_os_objetos_fechados(s)   # additionalProperties False e required == properties
```

(O teste parametrizado entra agora só com `MetaProposta`/um modelo de exemplo; cada task seguinte acrescenta o seu esquema à lista.)

- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** Ler `python/claude-api/README.md` da skill `claude-api` antes; não adivinhar nomes do SDK — se `beta.messages.stream` não aceitar `fallbacks`, rodar e corrigir pelo erro.
- [ ] **Step 4: Rodar e ver passar** + ruff + mypy.
- [ ] **Step 5: Commit** — `"Adaptador Anthropic atrás da interface ProvedorIA: saída estruturada, esforço, cache e fallback de recusa"`

---

### Task 3: Prompts versionados e motor da história

**Files:**
- Create: `backend/app/especialidades/prompts.py`, `backend/app/especialidades/dermatologia/prompts/historia.md`
- Create: `backend/app/motores/historia.py`
- Test: `backend/tests/test_prompts.py`, `backend/tests/test_motor_historia.py`

**Interfaces:**
- Produces:
  - `@dataclass(frozen=True) class Prompt: versao: str; texto: str`; `carregar_prompt(especialidade: str, motor: str) -> Prompt` (primeira linha `versao: X`; sem ela → `PacoteInvalido`).
  - `class HistoriaClinica(ModeloApi)`: `qp, hda, ap, hp, hf, exame_fisico, exames_texto: str` — mesmas chaves de `DadosEntrada`; `""` = sem fonte (nada inventado).
  - `VERSAO_ESQUEMA_HISTORIA = 1`
  - `motor_historia(provedor: ProvedorIA, entrada: EntradaConsulta, relogio: Relogio, registrar: Callable[[RegistroDecisao], None], termos_proibidos: Sequence[str] = ()) -> PropostaIA[HistoriaClinica]` — pedido `motor="historia"`, `esforco="medium"`, `dados={"consulta": entrada.model_dump(by_alias=True, mode="json")}`.

O prompt (`historia.md`, `versao: historia-derm-1`) pede, em português: HDA abrindo com `entrada.paciente` ("Paciente, 52 anos, …, refere…"); **negado ≠ não perguntado ≠ não examinado** (só "nega" o que o paciente negou; o não perguntado não aparece; campo de exame `null` = "não examinado", nunca "normal"); "perguntado e o paciente não soube" registrado como desconhecido pelo paciente; sinal respondido "sim" entra; HF só com doença familiar com predisposição (contato com a mesma doença vai na HDA); seção sem fonte = `""`; sem nome, sem diagnóstico na história. Em `meta.evidencias`, a fala/campo de origem de cada afirmação central.

- [ ] **Step 1: Testes que falham** — `test_prompt_sem_versao_e_invalido`, `test_prompt_da_historia_tem_versao`; com `ProvedorIAFalso`: `test_pedido_da_historia_e_desidentificado_e_versionado` (motor, versão do prompt, esforço, dados só com a entrada), `test_historia_valida_vai_ao_medico` (`HUMAN_REVIEW`), `test_historia_com_campo_faltando_e_rejeitada` (`REJECT`, resultado None). Acrescentar `HistoriaClinica` ao teste parametrizado da Task 2.
- [ ] **Step 2–4:** falhar → implementar → passar (+ ruff, mypy).
- [ ] **Step 5: Commit** — `"Motor da história clínica com prompt versionado da Dermatologia"`

---

### Task 4: Sinais de alerta — lista fixa por regra + IA sugere

**Files:**
- Create: `backend/app/motores/sinais.py`, `backend/app/especialidades/dermatologia/prompts/sinais.md`
- Test: `backend/tests/test_motor_sinais.py`

**Interfaces:**
- Produces:
  - `class SinalDetectado(ModeloApi)`: `id: str`, `trecho: str`; `class SinaisIA(ModeloApi)`: `detectados: list[SinalDetectado]`, `extras: list[str]`
  - `class SinalDisparado(ModeloApi)`: `id: str`, `texto: str`, `tipo: TipoSinal`, `acao: list[str]`, `prazo: Prazo`, `origem: Literal["respondido", "ia"]`, `trecho: str | None`
  - `class SinaisConsulta(ModeloApi)`: `disparados: list[SinalDisparado]`, `extras_ia: list[str]`, `avisos: list[str]`
  - `sinais_respondidos(entrada: EntradaConsulta, lista: list[SinalAlerta]) -> list[SinalDisparado]` — regra fixa: resposta `sim` dispara, sem IA.
  - `motor_sinais(provedor, entrada, lista, relogio, registrar, termos_proibidos=()) -> SinaisConsulta` — regra fixa **sempre**; IA (`motor="sinais"`, `esforco="low"`) procura na conversa e no exame sinais da lista que não foram respondidos "sim". Detectado da IA só entra se o `id` existir na lista e o `trecho` estiver literalmente na entrada (fala ou campo do exame); senão vai para `avisos`. IA em `REJECT` → só os respondidos, com aviso "IA dos sinais falhou; só a lista respondida foi checada". Sem repetição de id; ordem: urgência imediata, prioridade, muda tratamento.

- [ ] **Step 1: Testes que falham**

```python
def test_respondido_sim_dispara_sem_ia(): ...          # provedor que devolve erro → angioedema ainda disparado, origem "respondido"
def test_ia_acrescenta_sinal_com_trecho_literal(): ...  # "febre" numa fala → febre-erupcao-difusa, origem "ia"
def test_id_fora_da_lista_vira_aviso(): ...
def test_trecho_que_nao_esta_na_entrada_vira_aviso(): ...
def test_nao_repete_sinal_respondido_e_detectado(): ...
def test_ordem_por_tipo(): ...
```

- [ ] **Step 2–4.** Acrescentar `SinaisIA` ao teste parametrizado.
- [ ] **Step 5: Commit** — `"Sinais de alerta: lista fixa por regra e IA só acrescenta com trecho literal"`

---

### Task 5: Motor dos diagnósticos diferenciais

**Files:**
- Create: `backend/app/motores/diagnosticos.py`, `backend/app/especialidades/dermatologia/prompts/diagnosticos.md`
- Test: `backend/tests/test_motor_diagnosticos.py`

**Interfaces:**
- Consumes: `HistoriaClinica` (Task 3), `SinaisConsulta` (Task 4).
- Produces:
  - `SecaoHistoriaId = Literal["qp", "hda", "ap", "hp", "hf", "exame_fisico", "exames_texto"]`
  - `class EvidenciaDD(ModeloApi)`: `lado: Literal["favor", "contra"]`, `texto: str`, `secao: SecaoHistoriaId`, `trecho: str`
  - `class HipoteseIA(ModeloApi)`: `nome: str`, `cid: str = Field(pattern=PADRAO_CID)`, `certeza: Literal["suspeita", "hipotese", "clinico"]`, `pct: int = Field(ge=1, le=99)`, `evidencias: list[EvidenciaDD]`
  - `class NaoPerderIA(ModeloApi)`: `nome`, `cid` (mesmo padrão), `porque`, `como: str`
  - `class DiagnosticosIA(ModeloApi)`: `hipoteses: list[HipoteseIA] = Field(min_length=1, max_length=6)`, `nao_pode_perder: NaoPerderIA | None`, `rastrear: list[str]`
  - `class DadosSeguranca(ModeloApi)`: `alergias: list[Alergia]`, `em_uso: list[str]`, `sinais: list[SinalDisparado]`; `seguranca_de(entrada, sinais) -> DadosSeguranca`
  - `motor_diagnosticos(provedor, historia: HistoriaClinica, seguranca: DadosSeguranca, relogio, registrar, termos_proibidos=()) -> PropostaIA[DiagnosticosIA]` — `esforco="high"`; depois da validação, regra fixa: evidência cujo `trecho` não está literalmente em `historia.<secao>` é descartada com aviso; hipótese sem evidência `favor` restante sai (aviso); sem nenhuma hipótese restante → `REJECT` ("nenhuma hipótese com evidência na história"); ordena por `pct` decrescente.

`PADRAO_CID` sai de `casos_de_teste/formato.py` para `app/contratos/base.py` (os casos passam a importar de lá). O prompt (`versao: diagnosticos-derm-1`) pede certeza explícita (câncer sem histopatologia = `suspeita`), "não pode perder" com porque/como, "rastrear" = investigar e registrar a negativa sem diagnosticar, trecho **copiado** da história.

- [ ] **Step 1: Testes que falham** — `test_trecho_inventado_e_descartado`, `test_hipotese_sem_evidencia_a_favor_sai`, `test_nenhuma_hipotese_restante_rejeita`, `test_cid_invalido_rejeita`, `test_ordena_por_pct`, `test_pedido_leva_so_historia_e_seguranca` (nenhuma fala crua no pedido — Constituição: só o oficializado da etapa anterior).
- [ ] **Step 2–4.** Acrescentar `DiagnosticosIA` ao teste parametrizado.
- [ ] **Step 5: Commit** — `"Motor dos diagnósticos diferenciais com evidência literal da história"`

---

### Task 6: Tabela de condutas (fonte única) e regras fixas da conduta

**Files:**
- Create: `backend/app/especialidades/condutas.py`, `backend/app/especialidades/dermatologia/condutas/acne.yaml`
- Test: `backend/tests/test_condutas.py`

**Interfaces:**
- Produces:
  - Modelos (`_Modelo`, `extra="forbid"`): `OpcaoConduta(id, rotulo, texto, dias: int | None = None, receita: list[ItemReceita] = [])`, `LinhaConduta(id, rotulo: str | None, opcoes, prefixo: str | None = None, multipla: bool = False)`, `GrupoConduta(id: Literal["cuidados", "topico", "sistemico", "orientacoes"], rotulo, linhas, fixo: str | None = None)`, `RegraOrdem(sinal: str, linha: str, opcoes: list[str])`, `Contraindicacao(sinal: str, opcoes: list[str], motivo: str)`, `Protocolo(chave: str, versao: int, cids: list[str], revisao: _Revisao, grupos: list[GrupoConduta], regras: list[RegraOrdem], contraindicacoes: list[Contraindicacao])`
  - `carregar_protocolos(especialidade: str) -> dict[str, Protocolo]` (chave → protocolo; erro de formato, id de sinal inexistente na lista, id de opção inexistente em regra/contraindicação ou CID repetido entre protocolos → `PacoteInvalido`)
  - `protocolo_do_cid(protocolos: dict[str, Protocolo], cid: str) -> Protocolo | None`
  - `class OpcaoBloqueada(ModeloApi)`: `opcao: str`, `motivo: str`
  - `class PropostaTabela(ModeloApi)`: `chave: str`, `origem: str` (`"protocolo acne v1"`), `grupos: list[GrupoConduta]` (já sem as contraindicadas e com as das regras primeiro), `bloqueadas: list[OpcaoBloqueada]`, `motivos_ordem: dict[str, str]`
  - `aplicar_protocolo(p: Protocolo, sinais: list[SinalDisparado]) -> PropostaTabela`
  - `urgencia_por_sinais(sinais: list[SinalDisparado]) -> Literal["rotina", "prioritaria", "imediata"]` — algum `urgencia_imediata` → imediata; algum `prioridade` → prioritária; senão rotina.
  - `emergencia_por_sinais(sinais: list[SinalDisparado]) -> list[str]` — as `acao` dos sinais de urgência imediata, na ordem, sem repetir.

`acne.yaml` = porte fiel de `frontend/src/consulta/conduta-exemplo.ts` (grupos, opções, itens de receita com os mesmos valores; `sistemico` e `encaminhamento` com `multipla: true`; `cids: [L70.0]`). As regras do "Para relembrar" passam a ler os sinais: `gestacao-ou-plano → topico: [azelaico]`; `virilizacao → exames: [hormonal]` e `encaminhamento: [gineco]`. **Contraindicação proposta (precisa do autor — `revisao: {situacao: pendente}`):** com `gestacao-ou-plano`, bloquear `adapaleno-bpo`, `tretinoina-clinda`, `adapaleno`, `doxiciclina`, `limeciclina`, `espironolactona`, `isotretinoina`, `aco`, motivo "incompatível com gestação ou tentativa de gravidez". A tela do frontend continua lendo a cópia em TS até o 3C (aí passa a ler do servidor e a cópia é apagada).

- [ ] **Step 1: Testes que falham**

```python
def test_acne_carrega_e_bate_com_o_frontend():
    p = carregar_protocolos("dermatologia")["acne"]
    adap = opcao(p, "topico", "adapaleno-bpo")
    assert adap.receita[0].concentracao == "0,1% + 2,5%" and adap.receita[0].quantidade.unidade == "bisn. 30g"
def test_protocolo_pelo_cid(): assert protocolo_do_cid(ps, "L70.0").chave == "acne" and protocolo_do_cid(ps, "L40.0") is None
def test_gestacao_bloqueia_e_poe_azelaico_primeiro():
    t = aplicar_protocolo(acne, [sinal("gestacao-ou-plano")])
    assert "isotretinoina" not in ids(t, "sistemico") and ids(t, "topico")[0] == "azelaico"
    assert {b.opcao for b in t.bloqueadas} >= {"isotretinoina", "adapaleno", "doxiciclina"}
def test_urgencia_por_sinais(): ...      # [] → rotina; prioridade → prioritaria; imediata vence
def test_emergencia_so_de_urgencia_imediata(): ...  # angioedema → as 2 ações do yaml; prioridade → []
def test_regra_com_opcao_inexistente_e_pacote_invalido(tmp_path): ...
```

- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"Tabela de condutas em YAML (acne), contraindicações por sinal, urgência e ação de emergência por regra"`

---

### Task 7: Motor da conduta (tabela primeiro, IA só complementa ou cobre lacuna)

**Files:**
- Create: `backend/app/motores/conduta.py`, `backend/app/especialidades/dermatologia/prompts/conduta.md`
- Test: `backend/tests/test_motor_conduta.py`

**Interfaces:**
- Consumes: Task 5 (`DadosSeguranca`), Task 6 (todas as funções).
- Produces:
  - `class DiagnosticoConfirmado(ModeloApi)`: `nome: str`, `cid: str`, `certeza: Literal["suspeita", "hipotese", "clinico"]`
  - `class ComplementoConduta(ModeloApi)`: `orientacoes: list[str]`, `alertas: list[str]` — com tabela: a IA não receita nada.
  - `class OpcaoIA(ModeloApi)`: `rotulo: str`, `texto: str`, `receita: list[ItemReceita]`; `class GrupoIA(ModeloApi)`: `id: Literal["cuidados", "topico", "sistemico", "orientacoes"]`, `opcoes: list[OpcaoIA]`; `class CondutaIA(ModeloApi)`: `grupos: list[GrupoIA]`, `alertas: list[str]`
  - `class CondutaProposta(ModeloApi)`: `urgencia`, `emergencia: list[str]`, `tabela: PropostaTabela | None`, `ia: CondutaIA | None`, `complemento: ComplementoConduta | None`, `origem: str` (`"protocolo acne v1"` | `"sugestão da IA"`), `avisos: list[str]`, `acao: Acao`
  - `motor_conduta(provedor, dx: DiagnosticoConfirmado, seguranca: DadosSeguranca, protocolos: dict[str, Protocolo], relogio, registrar, termos_proibidos=()) -> CondutaProposta`
  - `texto_da_conduta(c: CondutaProposta) -> str` — texto corrido para a avaliadora: urgência, emergência, opções oferecidas por grupo, bloqueadas com o motivo ("Não indicado: isotretinoína — incompatível com…"), complemento/alertas.
  - `remedios_da_conduta(c: CondutaProposta) -> list[str]` — nomes DCB de todos os itens de receita oferecidos (tabela já filtrada, ou IA).

Ordem fixa: (1) `urgencia_por_sinais` e `emergencia_por_sinais` — **sem IA**; (2) protocolo pelo CID → `aplicar_protocolo`, e a IA (`motor="conduta-complemento"`, `esforco="medium"`) recebe diagnóstico, segurança e as opções da tabela e devolve `ComplementoConduta`; (3) sem protocolo → IA (`motor="conduta"`, `esforco="medium"`) devolve `CondutaIA`, `origem="sugestão da IA"`. IA em `REJECT` → a proposta mantém urgência, emergência e tabela, com aviso "A IA não conseguiu; escreva a conduta" e `acao="REJECT"` só quando também não houver tabela. Prompt (`versao: conduta-derm-1`): respeitar alergias, em uso e sinais `muda_tratamento`; não repetir a emergência; certeza `suspeita` → não tratar como confirmado (ex. biópsia/encaminhamento antes de tratar).

- [ ] **Step 1: Testes que falham** — `test_com_tabela_ia_so_complementa` (pedido `conduta-complemento`; `remedios_da_conduta` só da tabela), `test_sem_tabela_ia_propoe_marcada` (`origem == "sugestão da IA"`), `test_emergencia_entra_mesmo_com_ia_rejeitada` (angioedema + provedor com erro → `emergencia` com as 2 ações, `urgencia == "imediata"`), `test_sem_tabela_e_ia_rejeitada_e_reject`, `test_texto_cita_bloqueadas_com_motivo`, `test_pedido_nao_leva_historia` (Constituição: só DD oficializado + segurança).
- [ ] **Step 2–4.** Acrescentar `ComplementoConduta` e `CondutaIA` ao teste parametrizado.
- [ ] **Step 5: Commit** — `"Motor da conduta: regra fixa de urgência e emergência, tabela primeiro, IA marcada"`

---

### Task 8: IA avaliadora e a calibração dela

**Files:**
- Create: `backend/casos_de_teste/avaliadora.py`, `backend/casos_de_teste/calibracao_avaliadora.yaml`, `backend/app/especialidades/dermatologia/prompts/avaliadora.md`
- Test: `backend/tests/test_avaliadora.py`

**Interfaces:**
- Produces:
  - `TipoCriterio = Literal["fato", "negativa", "sem_resposta", "desconhecido", "obrigatorio", "proibido"]`
  - `class Criterio(ModeloApi)`: `n: int`, `tipo: TipoCriterio`, `texto: str`
  - `class Veredito(ModeloApi)`: `n: int`, `veredito: Literal["cumprido", "violado", "duvida"]`, `trecho: str | None`, `justificativa: str`
  - `class AvaliacaoIA(ModeloApi)`: `vereditos: list[Veredito]`
  - `avaliar(provedor, texto: str, criterios: list[Criterio], relogio, registrar) -> list[Veredito]` — um pedido por texto avaliado (`motor="avaliadora"`, `esforco="medium"`); regras depois da IA: `n` faltando ou repetido → `duvida` ("avaliadora não respondeu"); `cumprido` em `fato`/`negativa`/`sem_resposta`/`obrigatorio` exige `trecho` literal no texto, senão `duvida`; `violado` em `proibido`/`desconhecido` exige `trecho` literal, senão `duvida`. IA em `REJECT` → todos `duvida`.
  - `calibrar(provedor, relogio) -> tuple[int, int, list[str]]` — (acertos, total, discordâncias) sobre `calibracao_avaliadora.yaml`.

Significado (vai no prompt `versao: avaliadora-1`): `proibido` cumprido = o texto **não** faz o que é proibido — citar para contraindicar não viola ("isotretinoína contraindicada" cumpre "não prescrever isotretinoína"); `desconhecido` cumprido = o texto não afirma nem nega; `negativa` cumprida = consta como negado pelo paciente.

`calibracao_avaliadora.yaml` (`revisao: pendente` — o autor confere): 8 pares `{texto, criterio, tipo, esperado}` cobrindo: contraindicação citada (proibido → cumprido); anti-histamínico sem avaliar via aérea (obrigatório "avaliar via aérea" → violado); "nega febre" vs febre não perguntada (desconhecido → violado se o texto diz "nega febre"); paráfrase do fato (fato → cumprido); fato ausente (→ violado); "não soube informar" (sem_resposta → cumprido); "gravidade moderada" sem "a confirmar" (proibido → violado); HF com escabiose dos filhos (proibido de HF → violado).

- [ ] **Step 1: Testes que falham** (com `ProvedorIAFalso`): `test_cumprido_sem_trecho_vira_duvida`, `test_trecho_que_nao_esta_no_texto_vira_duvida`, `test_criterio_sem_veredito_vira_duvida`, `test_ia_rejeitada_tudo_duvida`, `test_calibracao_carrega_8_pares`. Acrescentar `AvaliacaoIA` ao teste parametrizado.
- [ ] **Step 2–4.**
- [ ] **Step 5: Commit** — `"IA avaliadora por critérios clínicos, com trecho obrigatório e casos de calibração"`

---

### Task 9: Medição dos motores nos casos (`python -m casos_de_teste medir`)

**Files:**
- Create: `backend/casos_de_teste/medir.py`
- Modify: `backend/casos_de_teste/__main__.py` (subcomandos `medir` e `calibrar`), `backend/.gitignore` (`casos_de_teste/resultados/`)
- Test: `backend/tests/test_medir.py`

**Interfaces:**
- Consumes: todas as anteriores.
- Produces:
  - `class ResultadoCriterio(ModeloApi)`: `etapa: Literal["historia", "diagnosticos", "sinais", "conduta"]`, `criterio: str`, `como: Literal["avaliadora", "regra"]`, `resultado: Literal["passou", "falhou", "duvida"]`, `trecho: str | None`, `nota: str`
  - `class ResultadoCaso(ModeloApi)`: `id: str`, `criterios: list[ResultadoCriterio]`, `rejeitados: list[str]` (motores em REJECT), `tokens_entrada: int`, `tokens_saida: int`, `custo_usd: float`, `segundos: float`, `erro: str | None`
  - `class RelatorioMedicao(ModeloApi)` (não confundir com `carregar.Relatorio`): `quando: datetime`, `modelo: str`, `versoes_prompt: dict[str, str]`, `casos: list[ResultadoCaso]`, `resumo: dict[str, float]`
  - `medir_caso(provedor, caso, lista, protocolos, relogio) -> ResultadoCaso`
  - `medir(provedor, casos, lista, protocolos, relogio) -> RelatorioMedicao`
  - `PRECO_USD_POR_MILHAO = {"claude-opus-5-5": (4.0, 20.0)}` (entrada, saída; modelo desconhecido → custo 0 com nota)

Fluxo por caso ("médico simulado", suposição minha): entrada → sinais → história (aceita como veio) → DD sobre a história da IA → conduta com o **diagnóstico esperado** confirmado (o médico corrige o DD; assim um erro do DD não contamina a medida da conduta). Só casos `revisao.situacao == "aprovado"`.

Critérios: **história** — `fatos`/`negativas`/`sem_resposta`/`desconhecidos` pela avaliadora sobre o texto das 7 seções; `vazias` por regra (seção `== ""`; `exames` do caso ↔ `exames_texto`). **Diagnósticos** — por regra: CID do `principal` ou de um `aceitos` entre as 3 primeiras; `certeza` dessa hipótese igual à esperada; `nao_pode_perder` (CID) entre as 3 ou em `nao_pode_perder`; `rastrear` pela avaliadora sobre `rastrear` + hipóteses. **Sinais** — por regra: cada `disparados` esperado presente (perdido = falha grave, contada à parte no resumo); extra fora do esperado vira nota, não falha. **Conduta** — por regra: `protocolo` (chave da tabela usada ou `None` com IA), `urgencia`, nenhum `remedios_proibidos` em `remedios_da_conduta` (comparar sem acento/caixa, por palavra); `obrigatorios`/`proibidos` pela avaliadora sobre `texto_da_conduta`.

Resumo: % de critérios aprovados por etapa, sinais perdidos (meta 0), principal entre os 3 (%), conduta vinda da tabela (%), saídas inválidas, dúvidas da avaliadora, custo total e por caso, tempo médio. Linha de comando: `python -m casos_de_teste medir [--caso derm-001-…]... [--falso]` imprime o resumo e grava `casos_de_teste/resultados/AAAA-MM-DD-HHMM.json`; `--falso` usa um provedor falso que devolve saídas fixas (para testar o fio sem gastar); sem `--falso` e sem `ANTHROPIC_API_KEY` → sai 1 com "falta a chave da Anthropic (ANTHROPIC_API_KEY)". `python -m casos_de_teste calibrar` roda a calibração da avaliadora.

- [ ] **Step 1: Testes que falham** (provedor falso com respostas por motor): `test_caso_perfeito_passa_tudo_por_regra`, `test_sinal_perdido_conta_no_resumo`, `test_remedio_proibido_na_receita_falha`, `test_motor_rejeitado_nao_para_a_medicao` (história em REJECT → caso registra `rejeitados=["historia"]`, os outros casos rodam), `test_conduta_usa_diagnostico_esperado`, `test_custo_pelo_preco_do_modelo`, `test_so_casos_aprovados`, `test_sem_chave_sai_1` (via `main([...])` com ambiente sem a variável).
- [ ] **Step 2–4.** Rodar `python -m casos_de_teste medir --falso` e ver o resumo impresso.
- [ ] **Step 5: Commit** — `"Medição dos motores nos casos de teste: avaliadora + regras, custo e tempo"`

---

### Task 10: Chave da Anthropic, primeira rodada real e registro

**Files:**
- Modify: `backend/README.md` (marco 3A: como medir, onde fica a chave), `docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md` (§12: divisão 3A/3B/3C)
- Create: `docs/decisoes/0004-motores-tabela-primeiro-e-medico-simulado.md`

- [ ] **Step 1: Guiar o autor a criar a chave** (só ele pode: conta e pagamento) — console da Anthropic → API Keys → criar chave "especialista-dev" → definir limite de gasto mensal (sugestão: US$ 30) → colar a chave para mim. Eu gravo em `backend/.env` (`ANTHROPIC_API_KEY=…`; `.env` já está no `.gitignore` — conferir com `git check-ignore backend/.env` antes).
- [ ] **Step 2: Uma consulta só, para medir o custo real** — `.venv/Scripts/python -m casos_de_teste medir --caso derm-001-acne-papulopustulosa`. Esperado: relatório gravado, nenhum `ErroPrivacidade`. Mostrar ao autor custo e tempo reais.
- [ ] **Step 3: Pedir o ok do autor para a rodada completa** com o custo estimado = custo do Step 2 × casos aprovados (+ calibração). Sem ok, parar aqui.
- [ ] **Step 4: Rodada completa + calibração** — `medir` e `calibrar`. Mostrar ao autor: o resumo, as falhas uma a uma (com o trecho) e as dúvidas da avaliadora para ele conferir (ADR 0002).
- [ ] **Step 5: ADR 0004 + README + commit + push** — ADR registra: tabela primeiro e IA só complementa/cobre lacuna; médico simulado na medição; esforço inicial por motor; o que fica para calibrar com o autor. `git commit -m "Marco 3A: motores com IA real medidos nos casos de teste"` e `git push -u origin servidor-motores`.

---

## O que ainda depende do autor (não bloqueia a construção)

- **Contraindicações por gestação na tabela da acne** (Task 6): lista proposta por mim, `pendente` até ele aprovar.
- **Protocolos das outras 14 chaves** dos casos (psoríase, rosácea, urticária, melanoma-suspeito…): sem eles a conduta desses casos sai como "sugestão da IA" e a métrica "conduta vinda da tabela" fica baixa (~3/20). Escrever cada protocolo é conteúdo clínico: ele dita/aprova, eu transcrevo — depois do 3A, guiado pelas falhas da medição.
- **Calibração da avaliadora** (Task 8): 8 pares para ele conferir.
- **Médico simulado** (Task 9): suposição minha de que a medição da conduta parte do diagnóstico esperado.
- **Limite de gasto da chave** e ok do custo da rodada completa (Task 10).
