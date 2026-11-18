# Backend do especIAlista

Servidor da consulta (FastAPI + LangGraph + Postgres + Claude), começando pela Dermatologia.
Desenho: [docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md](../docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md).

**Hoje (marco 1):** só os casos de teste — consultas fictícias com a resposta esperada por etapa, que
medem os motores de IA quando eles existirem — e o primeiro dado do pacote da especialidade (sinais de alerta).

## Instalar

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # Windows; no Mac/Linux: .venv/bin/python
```

## Comandos

```bash
.venv/Scripts/python -m pytest                          # testes
.venv/Scripts/python -m casos_de_teste validar          # confere todos os casos
.venv/Scripts/python -m casos_de_teste folha --abrir    # gera e abre a folha de revisão do autor
```

## Onde fica cada coisa

- `casos_de_teste/dermatologia/derm-NNN-*.yaml` — um caso por arquivo (formato em `casos_de_teste/formato.py`).
- `app/especialidades/dermatologia/sinais_alerta.yaml` — lista fixa de sinais de alerta.
- `docs/decisoes/` (na raiz do repositório) — decisões registradas (ADR).
