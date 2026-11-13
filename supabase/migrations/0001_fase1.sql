-- especIAlista · Fase 1: catálogo, médico, verificação, assinatura, auditoria
-- Regras gerais em docs/modelo-de-dados.md

create extension if not exists pgcrypto;

-- ---------- Catálogo ----------
create table public.specialties (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  on_sale     boolean not null default false,
  created_at  timestamptz not null default now()
);

create type public.billing_interval as enum ('mensal', 'anual');

create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  specialty_id  uuid references public.specialties(id),  -- nulo = todas
  price_cents   integer not null check (price_cents >= 0),
  interval      public.billing_interval not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- Médico ----------
create table public.doctors (
  id          uuid primary key references auth.users(id) on delete restrict,
  full_name   text not null,
  email       text not null,
  phone       text,
  crm_number  text not null check (crm_number ~ '^[0-9]{1,8}$'),
  crm_uf      char(2) not null check (crm_uf ~ '^[A-Z]{2}$'),
  rqe         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (crm_number, crm_uf)
);

create type public.verification_status as enum ('pendente', 'aprovada', 'recusada');

create table public.credential_verifications (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id),
  specialty_id  uuid not null references public.specialties(id),
  crm_number    text not null,
  crm_uf        char(2) not null,
  rqe           text,
  status        public.verification_status not null default 'pendente',
  reviewed_by   uuid references auth.users(id),
  reviewed_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  check ((status = 'pendente') = (reviewed_at is null))
);

-- ---------- Contratação ----------
create type public.subscription_status as enum
  ('em_teste', 'aguardando_pagamento', 'ativa', 'inadimplente', 'cancelada');

create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id),
  specialty_id  uuid not null references public.specialties(id),
  plan_id       uuid not null references public.plans(id),
  status        public.subscription_status not null default 'aguardando_pagamento',
  gateway       text,          -- a definir na LP-04
  gateway_ref   text,
  started_at    timestamptz,
  trial_ends_at timestamptz,   -- fim do teste grátis
  canceled_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'em_teste' or trial_ends_at is not null)
);

-- um módulo vigente por especialidade por médico
create unique index subscriptions_one_live_per_specialty
  on public.subscriptions (doctor_id, specialty_id)
  where status in ('em_teste', 'aguardando_pagamento', 'ativa', 'inadimplente');

-- Módulo liberado (acesso direto, também no teste):
--   assinatura ativa, ou teste dentro do prazo;
--   CRM informado (pedido de verificação aberto) e nunca recusado.
-- A conferência do CRM acontece depois; se for recusada, o acesso cai.
create view public.doctor_modules with (security_invoker = true) as
select s.doctor_id, s.specialty_id, s.plan_id, s.status, s.started_at, s.trial_ends_at
from public.subscriptions s
where (s.status = 'ativa' or (s.status = 'em_teste' and s.trial_ends_at > now()))
  and exists (
    select 1 from public.credential_verifications v
    where v.doctor_id = s.doctor_id and v.status in ('pendente', 'aprovada')
  )
  and not exists (
    select 1 from public.credential_verifications v
    where v.doctor_id = s.doctor_id and v.status = 'recusada'
  );

-- ---------- Auditoria (só INSERT) ----------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,
  action       text not null,      -- insert | update | delete
  entity       text not null,
  entity_id    text,
  changes      jsonb               -- só campos alterados; nada de segredos
);

create function public.audit_block_change() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log é somente inserção';
end $$;

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.audit_block_change();

create function public.audit_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value) into diff
    from jsonb_each(to_jsonb(new)) n
    where to_jsonb(old) -> n.key is distinct from n.value;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    diff
  );
  return coalesce(new, old);
end $$;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger doctors_touch before update on public.doctors
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create trigger doctors_audit after insert or update or delete on public.doctors
  for each row execute function public.audit_write();
create trigger credential_verifications_audit after insert or update or delete on public.credential_verifications
  for each row execute function public.audit_write();
create trigger subscriptions_audit after insert or update or delete on public.subscriptions
  for each row execute function public.audit_write();
create trigger plans_audit after insert or update or delete on public.plans
  for each row execute function public.audit_write();

-- ---------- RLS ----------
alter table public.specialties              enable row level security;
alter table public.plans                    enable row level security;
alter table public.doctors                  enable row level security;
alter table public.credential_verifications enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.audit_log                enable row level security;

-- catálogo: leitura pública
create policy specialties_public_read on public.specialties
  for select using (true);
create policy plans_public_read on public.plans
  for select using (active);

-- médico: só o próprio perfil
create policy doctors_self_read on public.doctors
  for select using (id = auth.uid());
create policy doctors_self_insert on public.doctors
  for insert with check (id = auth.uid());
create policy doctors_self_update on public.doctors
  for update using (id = auth.uid()) with check (id = auth.uid());

-- verificação: médico abre pedido e lê o status; só a plataforma (service_role) aprova
create policy verifications_self_read on public.credential_verifications
  for select using (doctor_id = auth.uid());
create policy verifications_self_request on public.credential_verifications
  for insert with check (doctor_id = auth.uid() and status = 'pendente' and reviewed_by is null);

-- assinatura: médico lê as próprias; criação e mudança de status pelo backend (service_role)
create policy subscriptions_self_read on public.subscriptions
  for select using (doctor_id = auth.uid());

-- audit_log: sem políticas = sem acesso para usuários; escrita só pelos triggers

-- ---------- Dados iniciais ----------
insert into public.specialties (slug, name) values
  ('cardiologia', 'Cardiologia'),
  ('dermatologia', 'Dermatologia'),
  ('neurologia', 'Neurologia'),
  ('ortopedia', 'Ortopedia'),
  ('endocrinologia', 'Endocrinologia');
