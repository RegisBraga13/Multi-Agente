-- O formulário do paciente permite sexo "intersexo": o cadastro também.
alter table public.patients drop constraint patients_sex_check;
alter table public.patients add constraint patients_sex_check check (sex in ('F', 'M', 'I'));
