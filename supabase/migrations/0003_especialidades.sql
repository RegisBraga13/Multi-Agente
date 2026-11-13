-- especIAlista · Fase 1: completa as 10 especialidades da identidade visual
-- Entram fora de venda (on_sale = false) até o lançamento de cada módulo.

insert into public.specialties (slug, name) values
  ('reumatologia', 'Reumatologia'),
  ('geriatria',    'Geriatria'),
  ('psiquiatria',  'Psiquiatria'),
  ('pediatria',    'Pediatria'),
  ('ginecologia',  'Ginecologia')
on conflict (slug) do nothing;
