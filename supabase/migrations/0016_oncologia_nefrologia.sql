-- Oncologia e Nefrologia (autor, 26/11/2026): formulário e exame físico próprios.
insert into public.specialties (slug, name) values
  ('oncologia', 'Oncologia'),
  ('nefrologia', 'Nefrologia')
on conflict (slug) do nothing;
