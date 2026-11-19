-- Agenda: pedido de consulta feito pelo paciente na página do médico, e o formulário que ele envia.
-- O pedido ainda não é paciente nem consulta: só nome e WhatsApp. Data de nascimento e sexo chegam com o formulário.

-- endereço da página do médico (/medico/<page_slug>)
alter table public.doctors add column page_slug text unique check (page_slug ~ '^[a-z0-9-]+$');

create table public.booking_requests (
  id                uuid primary key default gen_random_uuid(),
  doctor_id         uuid not null references public.doctors(id),
  scheduled_at      timestamptz not null,
  modality          public.modalidade_atendimento not null,
  patient_name      text not null check (length(btrim(patient_name)) > 0),
  whatsapp          text not null check (whatsapp ~ '^55[0-9]{10,11}$'),
  payment           text not null check (length(btrim(payment)) > 0),   -- 'Particular' ou o nome do convênio
  transcription     text not null check (transcription in ('aceita', 'recusada')),
  form_choice       text not null check (form_choice in ('whatsapp', 'pagina', 'consulta')),
  form_token        text not null unique check (length(form_token) >= 32),  -- o link do formulário; não é adivinhável
  form_status       text not null default 'sem-ficha' check (form_status in ('sem-ficha', 'link-enviado', 'pronta')),
  form_answers      jsonb,
  form_received_at  timestamptz,
  status            text not null default 'novo' check (status in ('novo', 'confirmado', 'cancelado')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, doctor_id),
  check ((form_status = 'pronta') = (form_answers is not null)),
  check ((form_answers is null) = (form_received_at is null))
);

-- o mesmo médico não atende dois pedidos no mesmo horário (cancelado libera o horário)
create unique index booking_requests_horario_unico on public.booking_requests (doctor_id, scheduled_at)
  where status <> 'cancelado';

create table public.booking_form_photos (
  id            uuid primary key default gen_random_uuid(),
  doctor_id     uuid not null references public.doctors(id),
  request_id    uuid not null,
  question_id   text not null check (question_id ~ '^[a-z0-9_]+$'),
  content_type  text not null check (content_type ~ '^image/[a-z0-9.+-]+$'),
  data          bytea not null check (octet_length(data) <= 10485760),
  created_at    timestamptz not null default now(),
  foreign key (request_id, doctor_id) references public.booking_requests (id, doctor_id) on delete cascade,
  unique (request_id, question_id)
);

create trigger booking_requests_updated_at before update on public.booking_requests
  for each row execute function public.touch_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['booking_requests', 'booking_form_photos']
  loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I
                    for each row execute function public.audit_write()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_proprio_ler on public.%1$I for select using (doctor_id = auth.uid())', t);
    execute format('create policy %1$s_proprio_inserir on public.%1$I for insert with check (doctor_id = auth.uid())', t);
    execute format('create policy %1$s_proprio_alterar on public.%1$I for update
                    using (doctor_id = auth.uid()) with check (doctor_id = auth.uid())', t);
    execute format('create policy %1$s_proprio_apagar on public.%1$I for delete using (doctor_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
