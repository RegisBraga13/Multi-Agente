# Servidor da Dermatologia — Marco 1: Casos de teste — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o formato dos casos de teste da Dermatologia, a lista fixa de sinais de alerta, um validador, uma folha de revisão legível para o autor e os 20 primeiros casos fictícios.

**Architecture:** Cada caso é um arquivo YAML (`backend/casos_de_teste/dermatologia/derm-NNN-*.yaml`) validado por modelos Pydantic com `extra="forbid"`. A lista fixa de sinais de alerta é o primeiro dado do pacote da especialidade (`backend/app/especialidades/dermatologia/sinais_alerta.yaml`). Um CLI (`python -m casos_de_teste validar | folha`) valida tudo e gera `revisao.html`, que o autor (médico, não programador) lê e aprova. O script que roda os motores sobre os casos e mede fica para o marco 3, quando os motores existirem; este marco só garante que as respostas esperadas sejam verificáveis por máquina.

**Tech Stack:** Python 3.13 (mínimo 3.12), Pydantic 2, PyYAML, pytest. Ambiente com `python -m venv` (não há `uv` na máquina).

**Spec:** [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../specs/2026-11-18-servidor-dermatologia-design.md) — §7.8 (casos de teste), §7.3 (sinais de alerta: lista fixa por especialidade), §7.5 (desidentificação), §8 marco 1.

## Global Constraints

- Termos do domínio em português (caso, paciente, conduta, sinais); termos técnicos do ecossistema em inglês.
- Casos 100% fictícios e **desidentificados**: sem nome, CPF, telefone, e-mail, endereço. Paciente = idade, sexo, estado civil, profissão.
- Toda leitura de arquivo com `encoding="utf-8"` explícito (Windows usa cp1252 por padrão).
- CID-10 no formato `^[A-Z]\d{2}(\.\d{1,2})?$`.
- Id do caso: `^derm-\d{3}-[a-z0-9-]+$`, igual ao nome do arquivo sem `.yaml`.
- Mensagens do validador em português, com o nome do arquivo.
- Branch: criar `servidor-casos-de-teste` a partir de `diagnosticos`. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Conteúdo clínico (casos e lista de sinais) nasce com `revisao.situacao: pendente`; só o autor aprova.

## Review Focus

1. **Acentos no Windows** — YAML com "ç", "ã", "é" tem de carregar igual em qualquer máquina → teste com texto acentuado em `test_carregar.py`.
2. **Campo com nome errado** (ex.: `diagnostico` em vez de `diagnosticos`) não pode ser ignorado em silêncio → `extra="forbid"`; teste em `test_formato.py`.
3. **Sinal de alerta inexistente** citado num caso (erro de digitação no id) → erro do validador; teste em `test_carregar.py`.
4. **Dado de identidade num caso** (CPF, telefone, e-mail colados numa fala) → erro do validador; teste em `test_carregar.py`.
5. **Texto com `<` ou `&`** (ex.: "lesão < 6 mm") quebrando a folha HTML → escapar; teste em `test_folha.py`.

---

## Estrutura de arquivos

```
backend/
  pyproject.toml                         dependências e config do pytest
  .gitignore                             .venv, __pycache__, casos_de_teste/revisao.html
  README.md                              como instalar, validar e gerar a folha (curto)
  app/__init__.py
  app/especialidades/__init__.py
  app/especialidades/pacote.py           SinalAlerta, carregar_sinais()
  app/especialidades/dermatologia/sinais_alerta.yaml
  casos_de_teste/__init__.py
  casos_de_teste/formato.py              modelos Pydantic do caso
  casos_de_teste/carregar.py             carregar_caso(), validar_pasta()
  casos_de_teste/folha.py                montar_folha() → HTML
  casos_de_teste/__main__.py             CLI: validar | folha [--abrir]
  casos_de_teste/dermatologia/derm-001-....yaml … derm-020-....yaml
  tests/conftest.py                      caso_minimo(), escrever_caso()
  tests/test_formato.py
  tests/test_pacote.py
  tests/test_carregar.py
  tests/test_folha.py
docs/decisoes/0001-casos-de-teste-em-yaml.md
```

---

### Task 1: Projeto Python e formato do caso

**Files:**
- Create: `backend/pyproject.toml`, `backend/.gitignore`, `backend/app/__init__.py`, `backend/casos_de_teste/__init__.py`, `backend/casos_de_teste/formato.py`, `backend/tests/conftest.py`, `backend/tests/test_formato.py`, `docs/decisoes/0001-casos-de-teste-em-yaml.md`
- Delete: `backend/.gitkeep`

**Interfaces:**
- Produces (em `casos_de_teste/formato.py`):
  - `SecaoHistoria = Literal["qp", "hda", "ap", "hp", "hf", "exame_fisico", "exames"]` (mesmas chaves de `DadosEntrada` em `frontend/src/prontuario/registro.ts`, com `exameFisico`→`exame_fisico`, `examesTexto`→`exames`).
  - Todos os modelos herdam de `class Modelo(BaseModel)` com `model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)`.
  - `Revisao(situacao: Literal["pendente","aprovado","corrigir"], nota: str = "", em: date | None = None)`
  - `Paciente(idade: int  # 0..120, sexo: Literal["F","M"], estado_civil: str | None = None, profissao: str | None = None, em_uso: list[str] = [], antecedentes: list[str] = [], alergias: list[Alergia] = [])`; `Alergia(substancia: str, reacao: str)`
  - `Fala(quem: Literal["Médico","Paciente"], texto: str  # min_length=1)`
  - `RespostaSinal(sinal: str, resposta: Literal["v","f"])`
  - `ExameFisico(morfologia, localizacao, extensao, gravidade, achados: str | None)` — `None` = não examinado (os 5 campos de `CAMPOS_DERMATO` no frontend).
  - `ItemComplementar(nome: str, valor: str | None)`; `ExameComplementar(exame: str, data: date, itens: list[ItemComplementar])`
  - `Entrada(paciente: Paciente, falas: list[Fala], sinais: list[RespostaSinal] = [], exame: ExameFisico, complementares: list[ExameComplementar] = [])`
  - `Diagnostico(nome: str, cid: str)` — `cid` validado pelo padrão CID-10.
  - `EsperadoHistoria(deve_conter: dict[SecaoHistoria, list[str]], vazias: list[SecaoHistoria] = [])`
  - `EsperadoDiagnosticos(principal: Diagnostico, nao_pode_perder: Diagnostico | None = None)`
  - `EsperadoSinais(disparados: list[str] = [])`
  - `EsperadoConduta(protocolo: str | None, deve_incluir: list[str] = [], proibidos: list[str] = [])`
  - `Esperado(historia, diagnosticos, sinais, conduta)` com os quatro acima.
  - `Caso(versao_formato: Literal[1], id: str, especialidade: Literal["dermatologia"], titulo: str, objetivo: str, revisao: Revisao, entrada: Entrada, esperado: Esperado)`
- Produces (em `tests/conftest.py`): `caso_minimo() -> dict` (dicionário válido para `Caso`, com 2 falas — uma do Médico, uma do Paciente — e `protocolo: "acne"`) e fixture `escrever_caso(tmp_path)` → função `(nome: str, dados: dict) -> Path` que grava YAML UTF-8 em `tmp_path/<nome>.yaml`.

- [ ] **Step 1: Ambiente** — `git checkout -b servidor-casos-de-teste`; criar `pyproject.toml` (projeto `especialista-backend`, `requires-python = ">=3.12"`, dependências `pydantic>=2.9`, `pyyaml>=6`; extra `dev = ["pytest>=8"]`; `[tool.pytest.ini_options] testpaths = ["tests"]`, `pythonpath = ["."]`); `.gitignore`; apagar `.gitkeep`. Rodar em `backend/`: `python -m venv .venv && .venv/Scripts/python -m pip install -e ".[dev]"`. Esperado: instala sem erro.

- [ ] **Step 2: Testes que falham** em `tests/test_formato.py`:

```python
def test_caso_minimo_e_valido():
    assert Caso.model_validate(caso_minimo()).id == "derm-001-teste"

def test_campo_desconhecido_e_recusado():
    dados = caso_minimo(); dados["esperado"]["diagnostico"] = {}
    with pytest.raises(ValidationError): Caso.model_validate(dados)

@pytest.mark.parametrize("cid", ["L70", "L70.0", "C43.59"])
def test_cid_valido(cid): Diagnostico(nome="x", cid=cid)

@pytest.mark.parametrize("cid", ["l70", "L7", "L70.", "L700", "L70.123"])
def test_cid_invalido(cid):
    with pytest.raises(ValidationError): Diagnostico(nome="x", cid=cid)

@pytest.mark.parametrize("id_", ["derm-1-acne", "DERM-001-acne", "derm-001-Acne", "derm-001-"])
def test_id_invalido(id_):
    dados = caso_minimo(); dados["id"] = id_
    with pytest.raises(ValidationError): Caso.model_validate(dados)

def test_falas_precisam_de_ao_menos_uma_do_paciente():
    dados = caso_minimo(); dados["entrada"]["falas"] = [{"quem": "Médico", "texto": "Bom dia."}]
    with pytest.raises(ValidationError): Caso.model_validate(dados)

def test_secao_nao_pode_ser_esperada_e_vazia_ao_mesmo_tempo():
    dados = caso_minimo()
    dados["esperado"]["historia"] = {"deve_conter": {"hf": ["mãe"]}, "vazias": ["hf"]}
    with pytest.raises(ValidationError): Caso.model_validate(dados)

def test_idade_fora_da_faixa():
    dados = caso_minimo(); dados["entrada"]["paciente"]["idade"] = 121
    with pytest.raises(ValidationError): Caso.model_validate(dados)
```

- [ ] **Step 3: Rodar** `.venv/Scripts/python -m pytest tests/test_formato.py -v` → FAIL (`ModuleNotFoundError: casos_de_teste.formato`).

- [ ] **Step 4: Implementar `casos_de_teste/formato.py`** com os modelos do bloco Interfaces. Regras de validação: `field_validator` para CID e id; `model_validator` em `Entrada` (ao menos uma fala do Paciente) e em `EsperadoHistoria` (interseção de `deve_conter` e `vazias` vazia; cada lista de `deve_conter` com ≥ 1 termo).

- [ ] **Step 5: Rodar** os testes → PASS.

- [ ] **Step 6: ADR** `docs/decisoes/0001-casos-de-teste-em-yaml.md` (≤ 20 linhas): contexto (§7.8), decisão (um YAML por caso, Pydantic com `extra="forbid"`, folha HTML para o autor revisar), alternativas recusadas (JSON: ilegível para revisão; banco: casos precisam viajar no git com os prompts), consequência (mudança de prompt/modelo roda contra estes arquivos no marco 3).

- [ ] **Step 7: Commit** — `git add backend docs/decisoes && git commit -m "Casos de teste: projeto Python e formato do caso"`

---

### Task 2: Lista fixa de sinais de alerta da Dermatologia

**Files:**
- Create: `backend/app/especialidades/__init__.py`, `backend/app/especialidades/pacote.py`, `backend/app/especialidades/dermatologia/sinais_alerta.yaml`, `backend/tests/test_pacote.py`

**Interfaces:**
- Produces: `SinalAlerta(id: str  # ^[a-z0-9-]+$, texto: str, porque: str)`; `class PacoteInvalido(Exception)`; `carregar_sinais(especialidade: str, raiz: Path = PASTA_ESPECIALIDADES) -> list[SinalAlerta]` — lê `<raiz>/<especialidade>/sinais_alerta.yaml` (formato: `revisao:` + `sinais:` lista), levanta `PacoteInvalido` se o arquivo não existe, se a estrutura é inválida ou se há id repetido.

- [ ] **Step 1: Testes que falham** em `tests/test_pacote.py`:

```python
def test_dermatologia_tem_os_sinais_obrigatorios():
    ids = {s.id for s in carregar_sinais("dermatologia")}
    assert {"lesao-pigmentada-abcde", "ferida-nao-cicatriza", "bolhas-mucosas", "angioedema", "zoster-oftalmico"} <= ids

def test_id_repetido_e_recusado(tmp_path):  # grava dois sinais com o mesmo id em tmp_path/x/sinais_alerta.yaml
    with pytest.raises(PacoteInvalido, match="repetido"): carregar_sinais("x", raiz=tmp_path)

def test_especialidade_sem_lista(tmp_path):
    with pytest.raises(PacoteInvalido, match="não encontrad"): carregar_sinais("psiquiatria", raiz=tmp_path)
```

- [ ] **Step 2: Rodar** `.venv/Scripts/python -m pytest tests/test_pacote.py -v` → FAIL.

- [ ] **Step 3: Implementar `pacote.py`** e escrever `sinais_alerta.yaml` com `revisao: {situacao: pendente}` e exatamente estes 13 sinais (id — texto curto de tela, no estilo "Ferida não cicatriza há >4 sem"; `porque` = uma frase clínica):

| id | texto |
|---|---|
| lesao-pigmentada-abcde | Pinta mudou cor, forma ou tamanho (ABCDE) |
| ferida-nao-cicatriza | Ferida não cicatriza há >4 sem |
| lesao-sangra-facil | Lesão que sangra ao toque leve |
| acne-grave-nodulos-cicatrizes | Nódulos dolorosos ou cicatrizes (acne grave) |
| virilizacao | Início súbito com sinais de virilização |
| bolhas-mucosas | Bolhas, pele descolando ou lesões em boca/olhos |
| febre-erupcao-difusa | Febre com manchas pelo corpo todo |
| angioedema | Inchaço de lábios/língua ou falta de ar |
| zoster-oftalmico | Vesículas na ponta do nariz ou perto do olho |
| celulite-progressiva | Vermelhidão quente que se espalha, com febre |
| imunossupressao | Imunossupressão (transplante, quimio, HIV, corticoide) |
| gestacao-ou-plano | Gestante, amamentando ou planeja engravidar |
| pe-diabetico | Lesão no pé em diabético |

- [ ] **Step 4: Rodar** os testes → PASS.

- [ ] **Step 5: Commit** — `git commit -m "Pacote da Dermatologia: lista fixa de sinais de alerta"`

---

### Task 3: Carregar e validar a pasta de casos

**Files:**
- Create: `backend/casos_de_teste/carregar.py`, `backend/tests/test_carregar.py`

**Interfaces:**
- Consumes: `Caso` (Task 1), `SinalAlerta`, `carregar_sinais` (Task 2).
- Produces:
  - `PASTA_CASOS = Path(__file__).parent / "dermatologia"`
  - `class CasoInvalido(Exception)` com atributos `caminho: Path` e `mensagens: list[str]`.
  - `carregar_caso(caminho: Path) -> Caso` — lê UTF-8, `yaml.safe_load`, `Caso.model_validate`; erro de YAML ou de Pydantic vira `CasoInvalido` com mensagens "campo.subcampo: motivo".
  - `@dataclass Relatorio(casos: list[Caso], erros: list[str])` com propriedade `ok: bool` (= `not erros`).
  - `validar_pasta(pasta: Path, sinais: list[SinalAlerta]) -> Relatorio` — carrega todos os `*.yaml` em ordem de nome; cada erro como `"<arquivo>: <mensagem>"`; não para no primeiro arquivo ruim.

Regras de `validar_pasta` além do formato: id = nome do arquivo; id único; todo `entrada.sinais[].sinal` e `esperado.sinais.disparados[]` existe na lista; nenhum texto do caso (falas, exame, nomes de exames, `objetivo`, `titulo`) casa com CPF `\d{3}\.?\d{3}\.?\d{3}-?\d{2}`, telefone `\(?\d{2}\)?\s?9?\d{4}-?\d{4}` ou e-mail `\S+@\S+\.\S+`; pasta sem nenhum caso = erro "nenhum caso encontrado".

- [ ] **Step 1: Testes que falham** em `tests/test_carregar.py` (usar `caso_minimo()` e `escrever_caso`; `SINAIS = [SinalAlerta(id="angioedema", texto="…", porque="…")]`):

```python
def test_pasta_valida(escrever_caso, tmp_path):
    escrever_caso("derm-001-teste", caso_minimo())
    r = validar_pasta(tmp_path, SINAIS)
    assert r.ok and len(r.casos) == 1

def test_texto_acentuado_carrega(escrever_caso, tmp_path):
    d = caso_minimo(); d["entrada"]["falas"][1]["texto"] = "Coça à noite, não melhora com açúcar."
    escrever_caso("derm-001-teste", d)
    assert validar_pasta(tmp_path, SINAIS).casos[0].entrada.falas[1].texto.startswith("Coça à")

def test_id_diferente_do_arquivo(escrever_caso, tmp_path):
    escrever_caso("derm-002-outro", caso_minimo())
    assert any("derm-002-outro" in e and "nome do arquivo" in e for e in validar_pasta(tmp_path, SINAIS).erros)

def test_id_repetido(escrever_caso, tmp_path):  # dois arquivos de nomes diferentes; força o mesmo id no segundo
    ...
    assert any("repetido" in e for e in validar_pasta(tmp_path, SINAIS).erros)

def test_sinal_inexistente(escrever_caso, tmp_path):
    d = caso_minimo(); d["esperado"]["sinais"]["disparados"] = ["angiodema"]
    escrever_caso("derm-001-teste", d)
    assert any("angiodema" in e for e in validar_pasta(tmp_path, SINAIS).erros)

@pytest.mark.parametrize("texto", ["Meu CPF é 123.456.789-09.", "Liga no (11) 98765-4321.", "Manda para ana@email.com."])
def test_dado_de_identidade_e_recusado(escrever_caso, tmp_path, texto):
    d = caso_minimo(); d["entrada"]["falas"][1]["texto"] = texto
    escrever_caso("derm-001-teste", d)
    assert any("identidade" in e for e in validar_pasta(tmp_path, SINAIS).erros)

def test_um_arquivo_ruim_nao_esconde_os_outros(escrever_caso, tmp_path):
    escrever_caso("derm-001-teste", caso_minimo())
    (tmp_path / "derm-002-quebrado.yaml").write_text("id: [", encoding="utf-8")
    r = validar_pasta(tmp_path, SINAIS)
    assert len(r.casos) == 1 and any("derm-002-quebrado" in e for e in r.erros)

def test_pasta_vazia(tmp_path):
    assert validar_pasta(tmp_path, SINAIS).erros == ["nenhum caso encontrado"]
```

- [ ] **Step 2: Rodar** `.venv/Scripts/python -m pytest tests/test_carregar.py -v` → FAIL.
- [ ] **Step 3: Implementar `carregar.py`** conforme Interfaces e regras.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Casos de teste: carregar e validar a pasta"`

---

### Task 4: Folha de revisão e CLI

**Files:**
- Create: `backend/casos_de_teste/folha.py`, `backend/casos_de_teste/__main__.py`, `backend/tests/test_folha.py`, `backend/README.md`

**Interfaces:**
- Consumes: `Caso`, `SinalAlerta`, `validar_pasta`, `PASTA_CASOS`, `carregar_sinais`.
- Produces:
  - `montar_folha(casos: list[Caso], sinais: list[SinalAlerta]) -> str` — HTML completo, autocontido (CSS inline, sem script, sem recurso externo), `lang="pt-BR"`, UTF-8. Todo texto vindo do caso passa por `html.escape`.
  - CLI `python -m casos_de_teste validar` → imprime `"20 casos válidos — 0 aprovados, 20 pendentes, 0 a corrigir"` e sai 0; com erros, imprime um por linha e sai 1.
  - CLI `python -m casos_de_teste folha [--abrir]` → valida; com erro, sai 1 sem gerar; senão grava `casos_de_teste/revisao.html` e, com `--abrir`, abre no navegador (`webbrowser.open`).

Conteúdo da folha, nesta ordem, em linguagem de médico (sem nomes de campos técnicos):
1. Topo: "Casos de teste — Dermatologia", contagem por situação.
2. "Sinais de alerta (lista fixa)": tabela texto + porquê.
3. Um bloco por caso: título; situação (Pendente / Aprovado / Corrigir + nota); "O que este caso testa: …"; "Paciente, 34 anos, feminino, solteira, professora" (omitir o que for nulo) + em uso, antecedentes, alergias; conversa (Médico/Paciente); sinais perguntados com Sim/Não; exame físico (campo nulo = "não examinado"); exames complementares; **Resposta esperada**: "Entre os 3 diagnósticos: Acne vulgar (L70.0)"; "Não pode perder: …" (ou nada); "Sinais de alerta que a IA tem de pegar: …" (texto da lista, não o id; "nenhum"); "Conduta pela tabela: acne" ou "Sem protocolo na tabela (IA sugere, marcado)"; "Tem de aparecer: …"; "Não pode aparecer: …"; "A história tem de conter: HDA — "6 meses", "menstruação""; "Devem ficar vazias (nada inventado): HF". Nomes das seções: qp→QP, hda→HDA, ap→AP, hp→HP, hf→HF, exame_fisico→Exame físico, exames→Exames.

- [ ] **Step 1: Testes que falham** em `tests/test_folha.py`:

```python
def test_texto_do_caso_e_escapado():
    d = caso_minimo(); d["entrada"]["exame"]["extensao"] = "lesão < 6 mm & única"
    html = montar_folha([Caso.model_validate(d)], SINAIS)
    assert "lesão &lt; 6 mm &amp; única" in html and "< 6 mm" not in html

def test_sinal_aparece_pelo_texto_e_nao_pelo_id():
    d = caso_minimo(); d["esperado"]["sinais"]["disparados"] = ["angioedema"]
    html = montar_folha([Caso.model_validate(d)], SINAIS)
    assert "Inchaço de lábios/língua ou falta de ar" in html

def test_exame_nao_feito_aparece_como_nao_examinado():
    d = caso_minimo(); d["entrada"]["exame"]["achados"] = None
    assert "não examinado" in montar_folha([Caso.model_validate(d)], SINAIS)

def test_folha_sem_recurso_externo():
    html = montar_folha([Caso.model_validate(caso_minimo())], SINAIS)
    assert "<script" not in html and "http" not in html

def test_cli_validar_falha_com_codigo_1(tmp_path, monkeypatch, capsys):  # monkeypatch PASTA_CASOS para tmp_path vazio
    assert main(["validar"]) == 1 and "nenhum caso" in capsys.readouterr().out
```
(`SINAIS` com o sinal `angioedema` de texto "Inchaço de lábios/língua ou falta de ar".) Para o teste do CLI, `__main__.py` expõe `main(argv: list[str] | None = None) -> int`, e lê `carregar.PASTA_CASOS` no momento da chamada (para o monkeypatch valer).

- [ ] **Step 2: Rodar** `.venv/Scripts/python -m pytest tests/test_folha.py -v` → FAIL.
- [ ] **Step 3: Implementar `folha.py` e `__main__.py`.** Visual simples e legível: Inter/serifa do sistema, fundo papel claro, um cartão por caso, situação em selo colorido (pendente âmbar, aprovado verde, corrigir vermelho). É documento de leitura; as regras de "uma tela" do app não se aplicam.
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: README** `backend/README.md` (≤ 30 linhas): o que é o backend hoje, instalar (`python -m venv .venv`, `pip install -e ".[dev]"`), `pytest`, `python -m casos_de_teste validar`, `python -m casos_de_teste folha --abrir`, e onde ficam casos e sinais.
- [ ] **Step 6: Commit** — `git commit -m "Casos de teste: folha de revisão e linha de comando"`

---

### Task 5: Os 20 primeiros casos

**Files:**
- Create: `backend/casos_de_teste/dermatologia/derm-001-….yaml` … `derm-020-….yaml`

**Interfaces:**
- Consumes: formato (Task 1), ids da lista de sinais (Task 2), CLI (Task 4).

Fonte dos casos 001–013: os pacientes fictícios do frontend — ficha em `frontend/src/modulo/exemplo.ts` (sexo, nascimento → idade em 13/11/2026, em uso, antecedentes, alergias), falas/relato/exame/perguntas em `frontend/src/consulta/exemplo.ts` (`RASCUNHOS`, `COMO_RESPONDER`, `COMPLEMENTARES`), hipóteses em `diagnosticos-exemplo.ts`. **Sem o nome** do paciente. A conversa segue o roteiro de `conteudoDaConsulta` (queixa, relato, remédios, antecedentes, alergias, fala do exame), com as perguntas de "faltou" respondidas. Casos 014–020 são novos, escritos com a mesma estrutura (5–9 falas). `estado_civil`/`profissao` só onde a ficha tem (João: casado, comerciante); nos novos, à escolha, ou nulo.

Regras para `esperado.historia`: 2–4 termos literais da entrada por seção que tem fonte; seção sem nenhuma fonte na entrada vai em `vazias`. `deve_incluir`/`proibidos`: termos curtos procurados no texto da conduta (sem acento não importa — o comparador do marco 3 normaliza).

| Caso | Paciente | Principal (CID) | Não pode perder | Sinais disparados | Protocolo | Deve incluir | Proibidos |
|---|---|---|---|---|---|---|---|
| derm-001-acne-papulopustulosa | 34 F | Acne vulgar L70.0 | — | — | acne | — | — |
| derm-002-psoriase-vulgar | 52 M | Psoríase vulgar L40.0 | Artrite psoriásica L40.5 | — | psoriase | — | dipirona |
| derm-003-acne-comedoniana | 18 F | Acne vulgar L70.0 | — | — | acne | — | — |
| derm-004-melanoma-suspeito | 64 M | Melanoma do tronco C43.5 | Melanoma C43.5 | lesao-pigmentada-abcde | melanoma-suspeito | dermatoscopia, biópsia | — |
| derm-005-melasma | 38 F | Melasma L81.1 | — | — | melasma | fotoproteção | amoxicilina |
| derm-006-alopecia-androgenetica | 29 M | Alopecia androgenética L64.9 | — | — | alopecia-androgenetica | — | — |
| derm-007-rosacea | 46 F | Rosácea L71.9 | — | — | rosacea | — | — |
| derm-008-carcinoma-basocelular | 73 M | Carcinoma basocelular C44.3 | Carcinoma basocelular C44.3 | ferida-nao-cicatriza, lesao-sangra-facil | carcinoma-basocelular | biópsia | sulfametoxazol |
| derm-009-dermatite-contato-irritativa | 25 F | Dermatite de contato irritativa L24.9 | — | — | dermatite-contato | luvas | — |
| derm-010-onicomicose | 41 M | Onicomicose B35.1 | — | — | onicomicose | — | — |
| derm-011-dermatite-contato-alergica | 57 F | Dermatite de contato alérgica L23.9 | — | — | dermatite-contato | — | dipirona |
| derm-012-verrugas-vulgares | 14 M | Verruga vulgar B07 | — | — | verrugas | — | — |
| derm-013-dermatite-seborreica | 36 F | Dermatite seborreica do couro cabeludo L21.0 | — | — | dermatite-seborreica | — | — |
| derm-014-acne-grave-planeja-gravidez | 27 F | Acne conglobata L70.1 | — | acne-grave-nodulos-cicatrizes, gestacao-ou-plano | acne | — | isotretinoína |
| derm-015-urticaria-angioedema | 31 M | Urticária alérgica L50.0 | Angioedema T78.3 | angioedema | urticaria | anti-histamínico | — |
| derm-016-herpes-zoster-oftalmico | 68 F | Herpes-zóster oftálmico B02.3 | Herpes-zóster oftálmico B02.3 | zoster-oftalmico | herpes-zoster | oftalmologia | — |
| derm-017-sindrome-stevens-johnson | 45 M (iniciou alopurinol há 2 sem; febre, bolhas, lesões na boca) | Síndrome de Stevens-Johnson L51.1 | Síndrome de Stevens-Johnson L51.1 | bolhas-mucosas, febre-erupcao-difusa | — (nulo) | suspender, emergência | — |
| derm-018-tinha-do-corpo | 22 M (usou pomada de corticoide, piorou) | Tinha do corpo B35.4 | — | — | micose-superficial | — | clobetasol, betametasona |
| derm-019-escabiose | 30 F (prurido noturno; filhos com o mesmo) | Escabiose B86 | — | — | escabiose | contactantes | — |
| derm-020-anamnese-incompleta | 50 M (só a queixa "manchas claras no peito"; exame só morfologia e localização) | Pitiríase versicolor B36.0 | — | — | micose-superficial | — | — |

Objetivo de cada caso (campo `objetivo`, uma frase): 001–013 "quadro típico" + o que tiver de particular (002 alergia a dipirona e artrite a não perder; 004 e 008 câncer de pele a não perder; 010 pergunta de diabetes respondida "não"; 012 menor de idade); 014 "tratamento ideal proibido por plano de gravidez"; 015–017 "sinal de alerta grave que não pode ser perdido"; 017 "sem protocolo ambulatorial: a IA sugere e marca"; 018 "erro clássico (corticoide em micose) não pode ser repetido"; 020 "dados incompletos: nada pode ser inventado" (com `vazias: [ap, hp, hf, exames]`).

- [ ] **Step 1: Escrever 001–013** a partir do frontend. Rodar `.venv/Scripts/python -m casos_de_teste validar` → "13 casos válidos — 0 aprovados, 13 pendentes, 0 a corrigir".
- [ ] **Step 2: Escrever 014–020.** Rodar `validar` → "20 casos válidos — 0 aprovados, 20 pendentes, 0 a corrigir".
- [ ] **Step 3: Conferir** que cada sinal disparado em 004, 008, 014–017 tem fonte na conversa ou no exame (o caso tem de dar à IA como pegar o sinal), e que 020 não tem fala sobre remédios, antecedentes nem família.
- [ ] **Step 4: Rodar tudo** — `.venv/Scripts/python -m pytest -v` → todos PASS.
- [ ] **Step 5: Commit e push** — `git commit -m "Casos de teste: 20 primeiros casos da Dermatologia (pendentes de revisão)"`; `git push -u origin servidor-casos-de-teste`.
- [ ] **Step 6: Entregar ao autor** — `.venv/Scripts/python -m casos_de_teste folha --abrir`. Pedir que revise a lista de sinais e os 20 casos; cada correção que ele ditar vira edição no YAML (`revisao.situacao: corrigir` + `nota` enquanto não resolvida; `aprovado` + `em` quando ele aprovar). Marco 1 termina com todos os casos e a lista de sinais `aprovado`.

---

## O que ainda precisa ser calibrado com dados reais

Nada neste marco tem threshold: os casos são a régua. As metas de medida (diagnóstico esperado entre os 3, nenhum sinal perdido, conduta da tabela, saídas inválidas, custo e tempo) são definidas e medidas no marco 3, sobre estes arquivos.
