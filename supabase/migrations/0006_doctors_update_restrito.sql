-- especIAlista · Fase 1: o médico não pode alterar o próprio CRM
-- Antes: "grant update on public.doctors" valia para todas as colunas, então o médico
-- podia trocar crm_number/crm_uf (e e-mail, RQE) depois da conferência do CRM.
-- Agora: pela Data API o médico só edita nome e telefone. CRM, UF, RQE e e-mail
-- mudam apenas pelo backend (service_role), que continua com acesso total.
-- A política RLS doctors_self_update continua valendo (só a própria linha).

revoke update on public.doctors from authenticated;
grant update (full_name, phone) on public.doctors to authenticated;
