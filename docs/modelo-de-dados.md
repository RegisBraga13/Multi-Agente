# Modelo de dados — desenho geral

Banco: Supabase (PostgreSQL). Só as tabelas da fase atual são criadas; o resto fica aqui como desenho, para não ser contrariado.

## Regras que valem para todas as fases
1. **Médico = dono dos dados.** Toda tabela clínica ou operacional tem `doctor_id` (= `auth.users.id` do médico). Isolamento por RLS: cada médico só vê as próprias linhas.
2. **Equipe sem dado clínico.** Papel `equipe` (Fase 2) acessa agenda, solicitações, cadastro e status da pré-consulta. Tabelas clínicas não têm política para esse papel.
3. **Auditoria só cresce.** `audit_log` aceita apenas INSERT; UPDATE e DELETE bloqueados no banco.
4. **Prontuário imutável depois de finalizado** (Fase 3). Correção = adendo com motivo; o original nunca muda.
5. **Proveniência em todo dado clínico** (Fase 3): `relatado` · `observado` · `inferido_ia` · `confirmado`, com origem (trecho, arquivo, página) e quem confirmou.
6. **Saída de IA é proposta.** Fica em tabela própria e só vira registro clínico com aceite do médico.

## Entidades por fase
| Fase | Entidades |
|---|---|
| 1 | `specialties`, `plans`, `doctors`, `credential_verifications`, `subscriptions`, `audit_log`, view `doctor_modules` |
| 2 | `team_members`, `patients`, `consents`, `appointments`, `appointment_requests`, `preconsult_forms` (por especialidade), `preconsult_responses` |
| 3 | `encounters` (consulta/retorno), `transcripts`, `attachments`, `clinical_facts` (com proveniência), `clinical_histories`, `ai_proposals`, `addenda` |
| 4 | `diagnostic_hypotheses`, `care_plans`, `care_plan_items`, `documents`, `document_templates`, `evidence_sources` + `evidence_chunks` (pgvector) |
| 5 | `followup_summaries` (derivado; aponta para as fontes) |
| 6 | configurações por especialidade e integrações |

## Fase 1 em detalhe
Migração: `supabase/migrations/0001_fase1.sql`.

- `specialties` — catálogo (slug, nome, se já está à venda). Leitura pública.
- `plans` — planos com preço em centavos e periodicidade; `specialty_id` nulo = vale para todas. Leitura pública dos ativos.
- `doctors` — perfil do médico, 1:1 com `auth.users`. CRM + UF obrigatórios; RQE opcional no cadastro.
- `credential_verifications` — conferência de CRM/RQE (pendente / aprovada / recusada). Feita pela plataforma, não pelo médico.
- `subscriptions` — contratação de um módulo de especialidade. Campos de gateway genéricos (`gateway`, `gateway_ref`) até o gateway ser escolhido.
- `subscriptions.status` inclui `em_teste`, com `trial_ends_at` (teste grátis).
- `doctor_modules` (view) — módulo liberado = (assinatura ativa **ou** teste no prazo) **e** CRM informado e nunca recusado. Acesso é direto; a conferência do CRM (LP-05) vem depois e, se recusada, corta o acesso.
- `audit_log` — quem fez o quê e quando; preenchido por triggers.
