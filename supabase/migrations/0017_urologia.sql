-- Urologia (autor, 26/11/2026): formulário e exame físico próprios.
insert into public.specialties (slug, name) values
  ('urologia', 'Urologia')
on conflict (slug) do nothing;
