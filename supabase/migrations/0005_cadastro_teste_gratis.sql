-- especIAlista · Fase 1 · LP-04: cadastro do teste grátis gravado de verdade
-- Fluxo: o front chama auth.signUp com os dados em user_metadata; este gatilho cria,
-- na mesma transação do usuário, o médico + pedido de verificação do CRM + teste grátis.
-- Tudo ou nada: se qualquer parte falhar, o usuário também não é criado.
-- Funciona com ou sem confirmação de e-mail (não depende de sessão no navegador).
--
-- Suposição declarada (ainda não decidida pelo autor): teste de 7 dias, sem cartão
-- (referência Solara). A duração fica numa constante abaixo e muda com uma nova migração.

-- Plano técnico do teste: gratuito, vale para todas as especialidades (specialty_id nulo).
insert into public.plans (code, name, specialty_id, price_cents, interval)
values ('teste-gratis', 'Teste grátis', null, 0, 'mensal')
on conflict (code) do nothing;

-- Pergunta pública: este CRM/UF já tem conta? (só devolve sim/não)
create function public.crm_disponivel(p_crm text, p_uf text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.doctors
    where crm_number = p_crm and crm_uf = upper(p_uf)
  );
$$;
revoke all on function public.crm_disponivel(text, text) from public;
grant execute on function public.crm_disponivel(text, text) to anon, authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_crm       text  := meta ->> 'crm';
  v_uf        text  := upper(meta ->> 'uf');
  v_nome      text  := btrim(coalesce(meta ->> 'nome', ''));
  v_spec      uuid;
  v_plan      uuid;
  c_teste_dias constant integer := 7;
begin
  -- Entrada sem dados de CRM (ex.: Google): o complemento vem depois; nada a criar aqui.
  if v_crm is null then
    return new;
  end if;

  if v_crm !~ '^[0-9]{1,8}$' or v_uf !~ '^[A-Z]{2}$' or length(v_nome) < 3 then
    raise exception 'cadastro_invalido';
  end if;

  select id into v_spec from public.specialties where slug = meta ->> 'especialidade';
  if v_spec is null then
    raise exception 'especialidade_invalida';
  end if;

  select id into v_plan from public.plans where code = 'teste-gratis';

  insert into public.doctors (id, full_name, email, crm_number, crm_uf)
  values (new.id, v_nome, new.email, v_crm, v_uf);

  insert into public.credential_verifications (doctor_id, specialty_id, crm_number, crm_uf)
  values (new.id, v_spec, v_crm, v_uf);

  insert into public.subscriptions (doctor_id, specialty_id, plan_id, status, started_at, trial_ends_at)
  values (new.id, v_spec, v_plan, 'em_teste', now(), now() + make_interval(days => c_teste_dias));

  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
