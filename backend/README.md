# Backend do especIAlista

Servidor da consulta (FastAPI + Postgres + Claude), começando pela Dermatologia.
Desenho: [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md) ·
decisões: [docs/decisoes/](../docs/decisoes/).

**Hoje (marco 2):** esqueleto sem IA real — contratos tipados, política de decisão, provedor de IA falso,
privacidade antes da IA, banco da consulta (migration 0007, sob RLS) e cadastro de paciente com id próprio.
Os casos de teste (marco 1) são a régua dos motores do marco 3.

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
