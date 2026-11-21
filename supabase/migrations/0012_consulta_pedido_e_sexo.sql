-- O formulário do paciente permite sexo "intersexo": o cadastro também.
alter table public.patients drop constraint patients_sex_check;
alter table public.patients add constraint patients_sex_check check (sex in ('F', 'M', 'I'));

-- A consulta sabe de qual pedido da agenda nasceu (as fotos do formulário continuam no pedido).
-- Um pedido gera no máximo uma consulta: abrir duas vezes devolve a mesma.
alter table public.encounters add column booking_request_id uuid unique references public.booking_requests(id);
