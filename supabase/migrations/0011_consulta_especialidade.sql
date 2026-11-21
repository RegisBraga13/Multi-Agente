-- A consulta sabe de qual especialidade é: o servidor carrega prompts, sinais e condutas dessa pasta.
alter table public.encounters add column specialty_slug text not null default 'dermatologia'
  check (specialty_slug ~ '^[a-z]+$');
