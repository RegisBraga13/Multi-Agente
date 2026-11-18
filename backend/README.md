# Backend do especIAlista

Servidor da consulta (FastAPI + Postgres + Claude), começando pela Dermatologia.
Desenho: [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md) ·
decisões: [docs/decisoes/](../docs/decisoes/).

**Hoje (marco 3A):** motores de texto com Claude de verdade — história, sinais de alerta, diagnósticos e
conduta (tabela primeiro) — medidos nos casos de teste por uma IA avaliadora + regras ([ADR 0004](../docs/decisoes/0004-motores-tabela-primeiro-e-medico-simulado.md)).
Ainda sem rotas da consulta nem tela ligada (marcos 3B e 3C). Base do marco 2: contratos tipados, política,
privacidade antes da IA, banco da consulta (0007/0008, sob RLS) e cadastro de paciente com id próprio.

## A consulta no servidor (marco 3B)

Etapas `anamnese → exame → historia → diagnosticos → conduta`, cada uma um bloco que o médico revisa e
oficializa; a IA de cada etapa só roda com a anterior oficializada (`POST /consultas/{id}/{etapa}/gerar`,
escrita ao vivo por SSE); documentos em `/consultas/{id}/documentos/{tipo}`; prontuário proposto em
`GET /consultas/{id}/prontuario`, gravado em `POST /consultas/{id}/finalizar`; adendos e histórico do paciente
em `/consultas/{id}/adendos` e `GET /pacientes/{id}/prontuario` ([ADR 0005](../docs/decisoes/0005-consulta-no-servidor.md)).

IA do servidor: `IA_PROVEDOR=demonstracao` (padrão, sem chave e sem custo) ou `IA_PROVEDOR=anthropic`
(usa `ANTHROPIC_API_KEY` do `backend/.env`):

```bash
IA_PROVEDOR=anthropic docker compose up -d --build   # IA real (custa dinheiro a cada geração)
```

## Medir os motores (custa dinheiro)

A chave da Anthropic fica em `backend/.env` (`ANTHROPIC_API_KEY=…`; o arquivo nunca vai para o git).

```bash
cd backend
export ANTHROPIC_API_KEY=$(grep -o 'ANTHROPIC_API_KEY=.*' .env | cut -d= -f2- | tr -d '\r\n ')
.venv/Scripts/python -m casos_de_teste medir --caso derm-001-acne-papulopustulosa   # um caso (~US$ 0,22)
.venv/Scripts/python -m casos_de_teste medir       # todos os aprovados (~US$ 4,50, ~25 min)
.venv/Scripts/python -m casos_de_teste calibrar    # a avaliadora nos pares de calibração
.venv/Scripts/python -m casos_de_teste medir --falso   # só o fio, sem chave e sem gastar
```

Relatórios em `casos_de_teste/resultados/` (fora do git). Toda mudança de prompt, modelo ou esforço roda
contra os casos antes de entrar. Prompts versionados em `app/especialidades/dermatologia/prompts/`; tabela
de condutas em `app/especialidades/dermatologia/condutas/`.

## Subir tudo com Docker (Postgres + servidor)

```bash
cd backend
docker compose up -d --build      # http://localhost:8000/saude · documentação em /docs
docker compose down -v            # apaga o banco local (só dados fictícios)
```

Variáveis do servidor: `DATABASE_URL` e `MEDICO_LOCAL_ID` (primeiro uso: só o autor, local). Sem elas o
servidor não sobe.

**Só neste computador.** O servidor ainda não tem login (todo pedido é do médico local), por isso as portas
ficam presas em `127.0.0.1`. Localmente o servidor conecta como `postgres` e assume o papel `authenticated` a
cada transação; em produção a conexão deve usar um usuário que só seja membro de `authenticated`
(portões do §11 do desenho). `docker compose up` pode rodar de novo: migrations já aplicadas são puladas.

## Desenvolver

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"      # Windows; no Mac/Linux: .venv/bin/python
.venv/Scripts/python -m pytest                        # tudo (os testes "banco" precisam do Docker rodando)
.venv/Scripts/python -m pytest -m "not banco"         # só os rápidos
.venv/Scripts/python -m ruff check . && .venv/Scripts/python -m mypy app casos_de_teste banco_local
.venv/Scripts/python -m casos_de_teste folha --abrir  # folha de revisão dos casos de teste
.venv/Scripts/python -m app.openapi                   # grava openapi.json
```

## Onde fica cada coisa

- `app/contratos/` — formatos (Pydantic, fonte única; JSON em camelCase): prontuário, motores, paciente.
- `app/consulta/politica.py` — toda proposta da IA vai ao médico; saída inválida é rejeitada.
- `app/motores/chamada.py` — chamada de motor: privacidade → provedor → validação → política → registro.
- `app/provedores/` — interfaces nossas (IA, relógio) e o provedor de IA falso.
- `app/privacidade.py` — detecção de identidade e "Paciente, 34 anos, feminino".
- `app/pacientes/`, `app/api/` — repositório (Postgres sob RLS / memória) e rotas.
- `app/especialidades/dermatologia/` — pacote da especialidade (sinais de alerta).
- `casos_de_teste/` — consultas fictícias aprovadas pelo autor.
- `../supabase/migrations/` — banco (as mesmas migrations rodam local e no Supabase).
- `banco_local/` — calço do `auth` do Supabase + semente fictícia, só para desenvolvimento e testes.
