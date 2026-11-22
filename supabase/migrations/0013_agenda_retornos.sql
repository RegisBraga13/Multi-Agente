-- Retorno marcado na página 5 da consulta: entra na agenda como cartão "Retorno" só ao finalizar a consulta de origem.
-- Item da agenda próprio (não é pedido do paciente): sem formulário; o nome vem do paciente.

create table public.return_bookings (
  id                  uuid primary key default gen_random_uuid(),
  doctor_id           uuid not null references public.doctors(id),
  patient_id          uuid not null,
  origin_encounter_id uuid not null unique,                    -- a consulta que originou o retorno
  scheduled_at        timestamptz not null,
  modality            public.modalidade_atendimento not null,
  created_at          timestamptz not null default now(),
  foreign key (patient_id, doctor_id) references public.patients (id, doctor_id),
  foreign key (origin_encounter_id, doctor_id) references public.encounters (id, doctor_id) on delete cascade
);

-- o mesmo médico não atende dois retornos no mesmo horário (a conferência com os pedidos é feita pelo servidor)
create unique index return_bookings_horario_unico on public.return_bookings (doctor_id, scheduled_at);

create trigger return_bookings_audit after insert or update or delete on public.return_bookings
  for each row execute function public.audit_write();

alter table public.return_bookings enable row level security;
create policy return_bookings_proprio_ler on public.return_bookings for select using (doctor_id = auth.uid());
create policy return_bookings_proprio_inserir on public.return_bookings for insert with check (doctor_id = auth.uid());
create policy return_bookings_proprio_alterar on public.return_bookings for update
  using (doctor_id = auth.uid()) with check (doctor_id = auth.uid());
create policy return_bookings_proprio_apagar on public.return_bookings for delete using (doctor_id = auth.uid());
grant select, insert, update, delete on public.return_bookings to authenticated;
grant select, insert, update, delete on public.return_bookings to service_role;
