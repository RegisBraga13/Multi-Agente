-- especIAlista · Fase 3: correções da revisão do banco da consulta (0007)
-- 1. Vínculos imutáveis: um bloco/anexo não muda de consulta nem de médico; a consulta não muda de paciente.
--    (Antes, mover um bloco de uma consulta finalizada para uma aberta esvaziava o prontuário sem adendo.)
-- 2. Consulta aberta/finalizada conferida com trava (for share): escrever um bloco enquanto outra transação
--    finaliza a consulta espera a finalização e então é recusado (sem corrida).
-- 3. Auditoria das tabelas clínicas registra só QUAIS colunas mudaram, nunca os valores (sem dado pessoal
--    numa tabela que não pode ser apagada).

-- ---------- 1. Vínculos imutáveis ----------
create function public.vinculos_imutaveis() returns trigger
language plpgsql as $$
declare
  antes  jsonb := to_jsonb(old);
  depois jsonb := to_jsonb(new);
begin
  if depois -> 'doctor_id' is distinct from antes -> 'doctor_id'
     or depois -> 'encounter_id' is distinct from antes -> 'encounter_id'
     or depois -> 'patient_id' is distinct from antes -> 'patient_id' then
    raise exception 'vínculos de % nunca mudam (médico, consulta, paciente)', tg_table_name;
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents']
  loop
    execute format('create trigger %1$s_vinculos before update on public.%1$I
                    for each row execute function public.vinculos_imutaveis()', t);
  end loop;
end $$;

-- ---------- 2. Conferência com trava ----------
create or replace function public.exige_consulta_aberta() returns trigger
language plpgsql as $$
declare
  consultas uuid[] := array_remove(array[
    case when tg_op <> 'INSERT' then old.encounter_id end,
    case when tg_op <> 'DELETE' then new.encounter_id end
  ], null);
begin
  -- espera quem estiver finalizando a consulta; depois lê o estado confirmado
  perform 1 from public.encounters e where e.id = any(consultas) for share;
  if exists (select 1 from public.encounters e where e.id = any(consultas) and e.finalized_at is not null) then
    raise exception 'consulta finalizada não muda; use adendo';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.exige_consulta_finalizada() returns trigger
language plpgsql as $$
begin
  perform 1 from public.encounters e where e.id = new.encounter_id for share;
  if not exists (
    select 1 from public.encounters e where e.id = new.encounter_id and e.finalized_at is not null
  ) then
    raise exception 'adendo só em consulta finalizada';
  end if;
  return new;
end $$;

-- ---------- 3. Auditoria sem valores ----------
create function public.audit_write_colunas() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  colunas jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_build_object('colunas', coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)) into colunas
    from jsonb_each(to_jsonb(new)) n
    where to_jsonb(old) -> n.key is distinct from n.value;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'), colunas);
  return coalesce(new, old);
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['patients', 'encounters', 'transcripts', 'clinical_facts', 'clinical_histories',
                           'diagnostic_hypotheses', 'care_plans', 'documents', 'addenda']
  loop
    execute format('drop trigger %1$s_audit on public.%1$I', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I
                    for each row execute function public.audit_write_colunas()', t);
  end loop;
end $$;
