-- Otorrinolaringologia (autor, 26/11/2026): formulário e exame físico próprios.
insert into public.specialties (slug, name) values
  ('otorrinolaringologia', 'Otorrinolaringologia')
on conflict (slug) do nothing;
