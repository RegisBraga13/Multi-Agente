# 0003 — Banco da consulta: um bloco por etapa, servidor sob RLS, Postgres local para desenvolver

**Data:** 18/11/2026 · **Situação:** aceita · Migração: `supabase/migrations/0007_fase3_consulta.sql`

**Contexto.** A Constituição oficializa cada etapa da consulta como uma unidade revisada pelo médico.
O modelo de dados nomeia as tabelas da Fase 3/4 (`transcripts`, `clinical_facts`, `clinical_histories`,
`diagnostic_hypotheses`, `care_plans`…).

**Decisão.**
1. **Um bloco por consulta em cada tabela de etapa**, com o conteúdo tipado em JSONB (`content` +
   `schema_version`) e o estado `rascunho_ia → revisado_medico → oficializado`. Desvio consciente do
   desenho "uma linha por fato/hipótese": o que se oficializa é o bloco; a lista fica dentro dele.
2. **O servidor acessa o banco sob RLS**: em cada transação assume o papel `authenticated` com o `sub` do
   médico, então o isolamento por médico vale também para o backend (não só para o navegador).
3. **Consulta finalizada é imutável** (gatilhos); correção só por `addenda`; `ai_proposals` e `addenda` só
   crescem. Chaves estrangeiras compostas impedem ligar dados de médicos diferentes.
4. **Desenvolvimento e testes em Postgres local (Docker)** com um calço mínimo do esquema `auth` do Supabase
   (`backend/banco_local/`); as mesmas migrations rodam no Supabase. `attachments` fica para o marco 5.

**Consequências.** Banco exportável e sem recurso exclusivo além de RLS/papéis (Postgres padrão). Se um dia
for preciso consultar fatos individualmente, cria-se uma visão ou tabela derivada a partir do `content`.
