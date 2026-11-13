-- especIAlista · Fase 1: novas especialidades (fora de venda até o lançamento)

insert into public.specialties (slug, name) values
  ('cirurgia',      'Cirurgia'),
  ('hematologia',   'Hematologia'),
  ('infectologia',  'Infectologia')
on conflict (slug) do nothing;
