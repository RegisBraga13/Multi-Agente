-- especIAlista · Fase 1: privilégios de tabela para a Data API
-- Projetos Supabase novos não concedem acesso automático ao schema public.
-- Os GRANTs abaixo espelham exatamente as políticas RLS da 0001; a RLS continua
-- sendo quem filtra as linhas. audit_log fica sem grant (só triggers escrevem).

-- catálogo: leitura pública
grant select on public.specialties to anon, authenticated;
grant select on public.plans       to anon, authenticated;

-- médico: próprio perfil
grant select, insert, update on public.doctors to authenticated;

-- verificação: médico abre pedido e lê status
grant select, insert on public.credential_verifications to authenticated;

-- assinatura: médico só lê
grant select on public.subscriptions  to authenticated;
grant select on public.doctor_modules to authenticated;

-- backend (service_role ignora RLS, mas precisa do privilégio de tabela)
grant select, insert, update, delete on
  public.specialties, public.plans, public.doctors,
  public.credential_verifications, public.subscriptions
  to service_role;
grant select on public.doctor_modules to service_role;
grant select, insert on public.audit_log to service_role;
