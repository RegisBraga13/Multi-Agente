-- Pneumologia e Hepatologia (autor, 26/11/2026): formulário e exame físico próprios.
insert into public.specialties (slug, name) values
  ('pneumologia', 'Pneumologia'),
  ('hepatologia', 'Hepatologia')
on conflict (slug) do nothing;
