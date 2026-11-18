-- especIAlista · Fase 3: a consulta no banco
-- Pacientes (id próprio), consultas, um bloco por etapa (anamnese, exame, história, DD, conduta), anexos,
-- propostas da IA e adendos. Regras: docs/modelo-de-dados.md, docs/constituicao.md e
-- docs/superpowers/specs/2026-11-18-servidor-dermatologia-design.md (§6, §7.6). Decisão: docs/decisoes/0003.
--
-- O que se oficializa é o BLOCO (Constituição): cada tabela de bloco tem uma linha por consulta, com o
-- conteúdo tipado em JSONB (formato e versão definidos pelos contratos Pydantic do backend).
-- Consulta finalizada não muda; correção só por adendo. Toda tabela: doctor_id + RLS.

create type public.estado_bloco as enum ('rascunho_ia', 'revisado_medico', 'oficializado');
create type public.tipo_atendimento as enum ('consulta', 'retorno');
create type public.modalidade_atendimento as enum ('presencial', 'online');

-- ---------- Funções de regra ----------
create function public.somente_insercao() returns trigger
language plpgsql as $$
begin
  raise exception '% é somente inserção', tg_table_name;
end $$;

create function public.id_imutavel() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id then
    raise exception 'o id de % nunca muda', tg_table_name;
  end if;
  return new;
end $$;

-- consulta finalizada: nada nela muda nem some
create function public.consulta_finalizada_imutavel() returns trigger
language plpgsql as $$
begin
  if old.finalized_at is not null then
    raise exception 'consulta finalizada não muda; use adendo';
  end if;
  return coalesce(new, old);
end $$;

-- blocos e anexos só mudam enquanto a consulta está aberta
create function public.exige_consulta_aberta() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.encounters e
    where e.id = coalesce(new.encounter_id, old.encounter_id) and e.finalized_at is not null
  ) then
    raise exception 'consulta finalizada não muda; use adendo';
  end if;
  return coalesce(new, old);
end $$;

-- adendo só existe depois do fim da consulta
create function public.exige_consulta_finalizada() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.encounters e where e.id = new.encounter_id and e.finalized_at is not null
  ) then
    raise exception 'adendo só em consulta finalizada';
  end if;
  return new;
end $$;

-- ---------- Pacientes ----------
create table public.patients (
  id              uuid primary key default gen_random_uuid(),  -- próprio do sistema, nunca muda
  doctor_id       uuid not null references public.doctors(id),
  full_name       text not null check (length(btrim(full_name)) > 0),
  birth_date      date not null,
  sex             char(1) not null check (sex in ('F', 'M')),
  marital_status  text,
  occupation      text,
  cpf             text check (cpf ~ '^[0-9]{11}$'),              -- cadastro, não chave
  phone           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, doctor_id)
);
create unique index patients_cpf_por_medico on public.patients (doctor_id, cpf) where cpf is not null;

-- ---------- Consultas e retornos ----------
create table public.encounters (
  id                     uuid primary key default gen_random_uuid(),
  doctor_id              uuid not null references public.doctors(id),
  patient_id             uuid not null,
  kind                   public.tipo_atendimento not null,
  modality               public.modalidade_atendimento not null,
  scheduled_at           timestamptz not null,
  finalized_at           timestamptz,
  record                 jsonb,      -- entrada do prontuário (DadosEntrada), gravada ao finalizar
  record_schema_version  integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, doctor_id),
  foreign key (patient_id, doctor_id) references public.patients (id, doctor_id),
  check ((finalized_at is null) = (record is null)),
  check ((record is null) = (record_schema_version is null))
);

-- ---------- Blocos da consulta (um por etapa) ----------
-- transcripts = anamnese · clinical_facts = exame físico e complementares · clinical_histories = história
-- diagnostic_hypotheses = DD · care_plans = conduta
do $$
declare
  t text;
begin
  foreach t in array array['transcripts', 'clinical_facts', 'clinical_histories', 'diagnostic_hypotheses', 'care_plans']
  loop
    execute format($f$
      create table public.%1$I (
        id               uuid primary key default gen_random_uuid(),
        doctor_id        uuid not null references public.doctors(id),
        encounter_id     uuid not null unique,
        status           public.estado_bloco not null,
        content          jsonb not null,
        schema_version   integer not null,
        stale            boolean not null default false,   -- a etapa anterior mudou depois desta
        officialized_at  timestamptz,
        created_at       timestamptz not null default now(),
        updated_at       timestamptz not null default now(),
        foreign key (encounter_id, doctor_id) references public.encounters (id, doctor_id),
        check ((status = 'oficializado') = (officialized_at is not null))
      )$f$, t);
  end loop;
end $$;

-- ---------- Anexos (receita, pedidos, atestado, laudo…) ----------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id),
  encounter_id  uuid not null,
  kind          text not null check (kind in ('receita', 'exames', 'encaminhamento', 'orientacoes', 'atestado', 'laudo')),
  status        text not null default 'rascunho' check (status in ('rascunho', 'revisado', 'assinado', 'enviado')),
  content       jsonb not null,
  signed_at     timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (encounter_id, doctor_id) references public.encounters (id, doctor_id)
);

-- ---------- Propostas da IA (registro de cada decisão; só cresce) ----------
create table public.ai_proposals (
  decision_id     uuid primary key,
  doctor_id       uuid not null references public.doctors(id),
  encounter_id    uuid not null,
  motor           text not null,
  model           text not null,
  model_version   text not null,
  schema_version  integer not null,
  prompt_version  text not null,
  confidence      numeric(4, 3) check (confidence between 0 and 1),
  action          text not null check (action in ('HUMAN_REVIEW', 'REJECT')),  -- nunca AUTO_EXECUTE
  tokens_in       integer not null check (tokens_in >= 0),
  tokens_out      integer not null check (tokens_out >= 0),
  content         jsonb,     -- a proposta validada (null quando REJECT); sem prompt
  created_at      timestamptz not null default now(),
  foreign key (encounter_id, doctor_id) references public.encounters (id, doctor_id)
);

-- ---------- Adendos (depois do fim; só cresce) ----------
create table public.addenda (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id),
  encounter_id  uuid not null,
  text          text not null check (length(btrim(text)) > 0),
  reason        text not null check (length(btrim(reason)) > 0),
  created_at    timestamptz not null default now(),
  foreign key (encounter_id, doctor_id) references public.encounters (id, doctor_id)
);

-- ---------- Gatilhos ----------
create trigger patients_id_imutavel before update on public.patients
  for each row execute function public.id_imutavel();
create trigger encounters_finalizada before update or delete on public.encounters
  for each row execute function public.consulta_finalizada_imutavel();
create trigger ai_proposals_somente_insercao before update or delete on public.ai_proposals
  for each row execute function public.somente_insercao();
create trigger addenda_somente_insercao before update or delete on public.addenda
  for each row execute function public.somente_insercao();
create trigger addenda_consulta_finalizada before insert on public.addenda
  for each row execute function public.exige_consulta_finalizada();

do $$
declare
  t text;
begin
  foreach t in array array['transcripts', 'clinical_facts', 'clinical_histories', 'diagnostic_hypotheses', 'care_plans', 'documents']
  loop
    execute format('create trigger %1$s_consulta_aberta before insert or update or delete on public.%1$I
                    for each row execute function public.exige_consulta_aberta()', t);
  end loop;
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents']
  loop
    execute format('create trigger %1$s_touch before update on public.%1$I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents', 'addenda']
  loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I
                    for each row execute function public.audit_write()', t);
  end loop;
end $$;

-- ---------- RLS: cada médico só vê e escreve as próprias linhas ----------
do $$
declare
  t text;
begin
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents', 'ai_proposals', 'addenda']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_proprio_ler on public.%1$I for select using (doctor_id = auth.uid())', t);
    execute format('create policy %1$s_proprio_inserir on public.%1$I for insert with check (doctor_id = auth.uid())', t);
    execute format('grant select, insert on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
  -- só cresce: ai_proposals e addenda não têm update
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents']
  loop
    execute format('create policy %1$s_proprio_alterar on public.%1$I for update
                    using (doctor_id = auth.uid()) with check (doctor_id = auth.uid())', t);
    execute format('grant update on public.%I to authenticated', t);
  end loop;
end $$;
