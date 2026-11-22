# Perguntas contextuais depois da história — Plano do servidor (parte A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** depois que a história clínica está montada, o servidor propõe perguntas de segurança escritas no contexto do paciente; o médico responde Sim ou Não; o Diagnóstico Diferencial lê a história mais as respostas (sem reescrever a história) e o prontuário recebe as respostas dentro da HDA.

**Architecture:** um motor novo (`perguntas`) lê a entrada desidentificada, a história e os "guias por queixa" da especialidade e devolve perguntas, cada uma com as frases de prontuário para Sim e para Não. As perguntas respondidas ficam dentro do bloco da história (campo novo com valor padrão, sem etapa nova e sem tabela nova). Pergunta ligada a um sinal do catálogo fixo dispara as regras desse sinal quando a resposta é Sim. A tela (parte B) é outro plano.

**Tech Stack:** FastAPI, Pydantic, pytest (provedor de IA falso nos testes), prompts versionados em `backend/app/especialidades/<especialidade>/`.

**Spec:** decisões do autor de 21/11/2026 (conversa), mais [2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md) §7.3 (sinais de alerta) e o plano anterior [2026-11-21-servidor-marco-3c-anamnese-exame.md](2026-11-21-servidor-marco-3c-anamnese-exame.md).

## Global Constraints

- **Sem mínimo e sem máximo de perguntas** por regra clínica: a IA escreve só o que serve ao caso. O limite do esquema (15) é só uma trava técnica contra resposta fora de controle.
- As 14 perguntas do catálogo (`sinais_alerta.yaml`) **deixam de ser obrigatórias**: viram catálogo de apoio (a IA pode usar o texto, o médico pode abri-las depois).
- **A história não é reescrita** quando o médico responde.
- Sinal de **urgência** na própria história continua avisando na hora (já existe: `motor_sinais` detecta nas falas e no exame).
- Resposta não dada **não vira "nega"**: pergunta sem resposta não entra no prontuário nem no DD.
- A origem ("sugestão da IA") aparece só na tela; nunca no prontuário.
- O nome do paciente nunca vai para a IA; a entrada é a desidentificada de sempre.
- Conteúdo clínico dos guias entra como `situacao: pendente` até o autor aprovar; ele é quem decide o texto clínico.
- Linguagem do prontuário: frases como as da História ("Refere…", "Nega…"), sem origem e sem ponto duplicado.

## Review Focus

- A IA devolve `sinal_id` que não existe no catálogo: a pergunta vira livre (sem regra de sinal) e o aviso fica registrado; nunca dispara regra de um sinal inexistente.
- A IA devolve pergunta com nome ou telefone do paciente: o pedido é bloqueado antes (privacidade), nada é enviado.
- A IA falha ou devolve vazio: o servidor devolve lista vazia com aviso, e a consulta segue sem perguntas.
- A história ainda não existe: gerar perguntas é recusado com mensagem clara.
- Pergunta ligada a sinal de urgência respondida Sim: a conduta recebe a resposta de emergência fixa, igual a antes.
- Pergunta respondida Não ou sem resposta: não dispara sinal e não muda a conduta.
- Frases do prontuário vazias ou repetidas: não geram linha vazia nem frase duplicada na HDA.

---

## File Structure

- `backend/app/especialidades/guias.py` (criar): carregar os guias por queixa de uma especialidade.
- `backend/app/especialidades/dermatologia/guias/*.md` (criar): 6 guias iniciais, pendentes de aprovação.
- `backend/app/motores/perguntas.py` (criar): o motor de perguntas e seu esquema.
- `backend/app/especialidades/dermatologia/prompts/perguntas.md` (criar): prompt versionado.
- `backend/app/contratos/consulta_blocos.py` (modificar): `PerguntaContextual` e `HistoriaBloco.perguntas`.
- `backend/app/consulta/perguntas.py` (criar): regras puras (`seguranca_com_respostas`, `frases_da_hda`).
- `backend/app/api/consultas.py` (modificar): rota `POST /consultas/{id}/perguntas/gerar`.
- `backend/app/motores/diagnosticos.py`, `backend/app/consulta/geracao.py` (modificar): o DD lê as respostas.
- `backend/app/prontuario/montar.py` (modificar): a HDA recebe as respostas.

---

### Task 1: Guias por queixa

**Files:**
- Create: `backend/app/especialidades/guias.py`, `backend/app/especialidades/dermatologia/guias/` (6 arquivos)
- Test: `backend/tests/test_guias.py`

**Interfaces:**
- Produces: `Guia(id: str, titulo: str, situacao: Literal["pendente","aprovado"], texto: str)` (dataclass congelada); `carregar_guias(especialidade: str, raiz: Path = PASTA_ESPECIALIDADES) -> list[Guia]` (ordem alfabética do nome do arquivo; `PacoteInvalido` se faltar `titulo:` ou `situacao:` nas duas primeiras linhas, ou se o texto for vazio; pasta inexistente → lista vazia).

- [ ] **Step 1: Write the failing tests** em `test_guias.py`: `test_carrega_os_guias_da_dermatologia` (6 guias, todos com `situacao == "pendente"`, `id` = nome do arquivo sem `.md`); `test_guia_sem_titulo_e_invalido` (arquivo temporário sem `titulo:` → `PacoteInvalido` citando o arquivo); `test_especialidade_sem_pasta_de_guias_devolve_lista_vazia` (raiz temporária).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_guias.py -q` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `guias.py` no padrão de `prompts.py` (leitura de duas linhas de cabeçalho `titulo: …` e `situacao: …`, resto é o texto). Escrever 6 guias curtos (no máximo 12 linhas cada) em português, no formato "numa queixa de X, perguntar sobre: …": `lesao-suspeita-de-cancer-de-pele`, `acne`, `psoriase-e-dermatites`, `urticaria-e-reacao-a-medicamento`, `infeccoes-da-pele`, `queda-de-cabelo-e-unhas`. Todos `situacao: pendente`: são rascunho para o autor revisar, não conteúdo aprovado.
- [ ] **Step 4: Run** a suíte inteira `.venv/Scripts/python -m pytest -q` — Expected: passa.
- [ ] **Step 5: Commit** `git add backend && git commit -m "Servidor: guias por queixa da Dermatologia (rascunho para o autor revisar)"`

### Task 2: Contrato das perguntas contextuais

**Files:**
- Modify: `backend/app/contratos/consulta_blocos.py`
- Test: `backend/tests/test_consulta_blocos.py`

**Interfaces:**
- Produces: `PerguntaContextual(id: str, texto: str, se_sim: str, se_nao: str, sinal_id: str | None = None, resposta: Literal["sim","nao"] | None = None)`; `HistoriaBloco.perguntas: list[PerguntaContextual] = []`.

- [ ] **Step 1: Write the failing tests:** `test_historia_antiga_continua_valida` (payload sem `perguntas` valida, `perguntas == []`); `test_pergunta_contextual_ida_e_volta` (pergunta com `sinal_id="angioedema"` e `resposta="sim"` sobrevive a `model_dump(by_alias=True)` e `model_validate`); `test_pergunta_sem_frase_de_sim_ou_nao_e_invalida` (`se_sim=""` levanta `ValidationError`; usar `Field(min_length=1)`).
- [ ] **Step 2: Run** esses testes — Expected: FAIL.
- [ ] **Step 3: Implement** o tipo e o campo (mesmo padrão dos campos novos da anamnese).
- [ ] **Step 4: Run** a suíte inteira — Expected: passa.
- [ ] **Step 5: Commit** `"Servidor: a história guarda as perguntas contextuais e suas respostas"`

### Task 3: Motor de perguntas

**Files:**
- Create: `backend/app/motores/perguntas.py`, `backend/app/especialidades/dermatologia/prompts/perguntas.md` (primeira linha `versao: perguntas-derm-1`)
- Test: `backend/tests/test_motor_perguntas.py` (seguir o padrão de `test_motor_sinais.py` e o envelope `{resultado, meta}` dos outros motores)

**Interfaces:**
- Consumes: `EntradaConsulta`, `HistoriaClinica`, `SinalAlerta`, `Guia` (Tasks 1–2), `chamar_motor`, `carregar_prompt`.
- Produces: `PerguntaIA(texto: str, se_sim: str, se_nao: str, sinal_id: str | None)`; `PerguntasIA(perguntas: list[PerguntaIA])` com no máximo 15; `motor_perguntas(provedor, entrada: EntradaConsulta, historia: HistoriaClinica, catalogo: list[SinalAlerta], guias: list[Guia], relogio, registrar, termos_proibidos=(), especialidade=ESPECIALIDADE_PADRAO) -> PerguntasProposta`, onde `PerguntasProposta(perguntas: list[PerguntaContextual], avisos: list[str], ia_falhou: bool)`. Os `id` das perguntas são `p1`, `p2`… na ordem recebida.

- [ ] **Step 1: Write the failing tests:** `test_pergunta_com_sinal_do_catalogo_mantem_o_id`; `test_sinal_id_inexistente_vira_pergunta_livre_com_aviso` (o `sinal_id` volta `None` e o aviso cita o id); `test_ia_falhou_devolve_lista_vazia_com_aviso`; `test_resposta_vazia_devolve_lista_vazia_sem_falha`; `test_pedido_leva_a_historia_e_os_guias_e_nao_leva_nome` (inspecionar `provedor.pedidos[0].dados`: tem chaves `historia`, `guias`, `catalogo`; nenhum texto com o nome do paciente); `test_nome_do_paciente_na_historia_bloqueia_o_pedido` (`ErroPrivacidade`, nenhum pedido enviado); `test_mais_de_15_perguntas_e_resposta_invalida` (cai no caminho de falha).
- [ ] **Step 2: Run** `.venv/Scripts/python -m pytest tests/test_motor_perguntas.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement** o motor: `esforco="medium"`; `dados` = `{consulta, historia, catalogo (id, texto, porque), guias (titulo, texto)}`; `regra` do `chamar_motor` não é necessária — a normalização do `sinal_id` e os avisos ficam no pós-processamento do motor. Prompt (português, sem diagnosticar, sem conduta): escrever só as perguntas que servem a este caso, sem mínimo nem máximo; usar o catálogo e os guias como apoio, nunca como obrigação; cada pergunta com a frase de prontuário para Sim e para Não no estilo da história ("Refere sangramento ao toque leve." / "Nega sangramento ao toque."); `sinal_id` só quando a pergunta for exatamente um sinal do catálogo; nunca repetir o que a história já responde.
- [ ] **Step 4: Run** a suíte inteira — Expected: passa; `ruff` e `mypy app` limpos.
- [ ] **Step 5: Commit** `"Servidor: motor de perguntas contextuais com guias por queixa"`

### Task 4: Rota para gerar as perguntas

**Files:**
- Modify: `backend/app/api/consultas.py`, `backend/app/consulta/geracao.py` (função `gerar_perguntas(ctx, medico_id, consulta_id) -> PerguntasProposta`)
- Test: `backend/tests/test_api_consultas.py`, `backend/tests/test_geracao_consulta.py`

**Interfaces:**
- Consumes: Task 3. A história precisa existir como bloco (qualquer estado); o catálogo vem de `ctx.pacote(especialidade).sinais`; os guias de `carregar_guias(especialidade)`.
- Produces: `POST /consultas/{id}/perguntas/gerar` → 200 `{"perguntas": [PerguntaContextual…], "avisos": [str]}`; não grava no bloco (a tela coloca as perguntas na história e salva com o `PUT /historia` que já existe); registra a decisão em `ai_proposals` como os outros motores. História inexistente → 409 "Monte a história antes das perguntas". Nome do paciente no texto → 422 (mesmo tratamento dos outros motores).

- [ ] **Step 1: Write the failing tests:** (API) `test_gerar_perguntas_devolve_a_proposta_sem_gravar` (depois da chamada, `GET /consultas/{id}` mostra a história com `perguntas == []`); `test_gerar_perguntas_sem_historia_e_409`; `test_gerar_perguntas_registra_a_decisao`; (geração) `test_perguntas_usam_a_especialidade_da_consulta` (o pacote e os guias pedidos são os da `consulta.especialidade`).
- [ ] **Step 2: Run** os testes novos — Expected: FAIL.
- [ ] **Step 3: Implement** a função e a rota, no padrão de `gerar_etapa` (sem SSE: resposta JSON simples).
- [ ] **Step 4: Run** a suíte inteira e os testes de banco `.venv/Scripts/python -m pytest tests/banco -q` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: rota que propõe as perguntas contextuais da consulta"`

### Task 5: O Diagnóstico Diferencial lê as respostas

**Files:**
- Create: `backend/app/consulta/perguntas.py`
- Modify: `backend/app/motores/diagnosticos.py` (parâmetro novo), `backend/app/consulta/geracao.py` (etapa `diagnosticos` e `conduta`)
- Test: `backend/tests/test_perguntas_regras.py`, `backend/tests/test_geracao_consulta.py`, `backend/tests/test_motor_diagnosticos.py`

**Interfaces:**
- Produces: `seguranca_com_respostas(seguranca: DadosSeguranca, perguntas: list[PerguntaContextual], catalogo: list[SinalAlerta]) -> DadosSeguranca` (acrescenta como `SinalDisparado` com `origem="respondido"` cada pergunta com `resposta == "sim"` e `sinal_id` no catálogo, sem duplicar um sinal já disparado); `motor_diagnosticos(..., perguntas: Sequence[PerguntaContextual] = ())` leva em `dados` a chave `respostasDeAlerta` com `[{texto, resposta}]` só das respondidas; a geração de diagnósticos e a de conduta usam a segurança já acrescida.

- [ ] **Step 1: Write the failing tests:** `test_sim_em_sinal_do_catalogo_dispara_as_regras_dele`; `test_sim_em_pergunta_livre_nao_dispara_sinal`; `test_nao_e_sem_resposta_nao_disparam`; `test_sinal_ja_disparado_nao_duplica`; `test_urgencia_respondida_sim_vai_para_a_conduta_com_a_resposta_fixa` (usar `angioedema`; a conduta devolve a emergência fixa); `test_dd_recebe_so_as_respondidas` (inspecionar `provedor.pedidos[0].dados["respostasDeAlerta"]`: a sem resposta não aparece); `test_historia_nao_e_reescrita_ao_gerar_diagnosticos` (o bloco da história é idêntico antes e depois).
- [ ] **Step 2: Run** esses testes — Expected: FAIL.
- [ ] **Step 3: Implement** as duas funções e ligá-las na geração: o DD e a conduta recebem `seguranca_com_respostas(h.seguranca, h.perguntas, catalogo)`.
- [ ] **Step 4: Run** a suíte inteira — Expected: passa.
- [ ] **Step 5: Commit** `"Servidor: o DD e a conduta leem as respostas das perguntas contextuais"`

### Task 6: As respostas entram na HDA do prontuário

**Files:**
- Modify: `backend/app/prontuario/montar.py`, `backend/app/consulta/perguntas.py` (função `frases_da_hda`)
- Test: `backend/tests/test_prontuario_montar.py`, `backend/tests/test_perguntas_regras.py`

**Interfaces:**
- Produces: `frases_da_hda(perguntas: list[PerguntaContextual]) -> str` (junta, na ordem, `se_sim` das respondidas Sim e `se_nao` das respondidas Não; ignora sem resposta e frase vazia; não repete frase igual; garante ponto final em cada frase). `dados_da_consulta` acrescenta esse texto ao fim da HDA, separado por um espaço, quando não for vazio.

- [ ] **Step 1: Write the failing tests:** `test_hda_recebe_as_frases_das_respondidas` (Sim → `se_sim`, Não → `se_nao`); `test_sem_resposta_nao_entra` ; `test_frases_repetidas_entram_uma_vez`; `test_sem_perguntas_a_hda_fica_como_estava` (igualdade exata com a HDA da história); `test_hda_vazia_com_respostas_nao_comeca_com_espaco`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `frases_da_hda` e a junção em `dados_da_consulta`.
- [ ] **Step 4: Run** a suíte inteira e `ruff`/`mypy` — Expected: passam.
- [ ] **Step 5: Commit** `"Servidor: as respostas das perguntas contextuais entram na HDA do prontuário"`

---

## Fora deste plano (parte B, outro plano)

- **Tela:** a página da História no servidor, a seção de perguntas no fim dela (Sim e Não, "Ver mais perguntas" com o catálogo) e tirar a lista de sinais da página 1. Depende da história estar no servidor.
- **Guias aprovados:** o autor revisa os 6 guias; enquanto estiverem pendentes, o servidor os usa mesmo assim (a IA só os lê como apoio).
- **RAG completo** (protocolos e artigos com fonte citada): junto com o item 9 (conduta com mais de uma fonte).
