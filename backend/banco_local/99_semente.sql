-- Médico local fictício (só desenvolvimento/testes). O gatilho da 0005 cria o médico, o pedido de CRM e o teste.
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000001',
  'medico.local@exemplo.invalid',
  '{"crm": "123456", "uf": "SP", "nome": "Médico Local (fictício)", "especialidade": "dermatologia"}'
)
on conflict (id) do nothing;

-- endereço da página do médico local (a página de exemplo /medico/ana-souza)
update public.doctors set page_slug = 'ana-souza'
where id = '00000000-0000-4000-8000-000000000001' and page_slug is null;

-- Segundo médico fictício, de Reumatologia, só para testar o módulo no mesmo computador (autor, 24/11/2026).
-- A tela do módulo reumatologIA fala com ele pelo cabeçalho x-medico-pagina (ver app/identidade.py).
insert into auth.users (id, email, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000101',
  'medico.reumato@exemplo.invalid',
  '{"crm": "654321", "uf": "SP", "nome": "Dr. Paulo Mendes (fictício)", "especialidade": "reumatologia"}'
)
on conflict (id) do nothing;

update public.doctors set page_slug = 'paulo-mendes'
where id = '00000000-0000-4000-8000-000000000101' and page_slug is null;

-- Médicos fictícios de Cardiologia e Gastroenterologia, só para testar os módulos (26/11/2026). Mesmo esquema do Dr. Paulo.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000102', 'medico.cardio@exemplo.invalid',
   '{"crm": "765432", "uf": "SP", "nome": "Dra. Helena Prado (fictícia)", "especialidade": "cardiologia"}'),
  ('00000000-0000-4000-8000-000000000103', 'medico.gastro@exemplo.invalid',
   '{"crm": "876543", "uf": "SP", "nome": "Dr. Marcos Lima (fictício)", "especialidade": "gastroenterologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'helena-prado'
where id = '00000000-0000-4000-8000-000000000102' and page_slug is null;
update public.doctors set page_slug = 'marcos-lima'
where id = '00000000-0000-4000-8000-000000000103' and page_slug is null;

-- Médicos fictícios de Neurologia e Endocrinologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000104', 'medico.neuro@exemplo.invalid',
   '{"crm": "987654", "uf": "SP", "nome": "Dra. Lúcia Ramos (fictícia)", "especialidade": "neurologia"}'),
  ('00000000-0000-4000-8000-000000000105', 'medico.endo@exemplo.invalid',
   '{"crm": "198765", "uf": "SP", "nome": "Dr. Tiago Nunes (fictício)", "especialidade": "endocrinologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'lucia-ramos'
where id = '00000000-0000-4000-8000-000000000104' and page_slug is null;
update public.doctors set page_slug = 'tiago-nunes'
where id = '00000000-0000-4000-8000-000000000105' and page_slug is null;

-- Médicos fictícios de Hematologia e Infectologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000106', 'medico.hemato@exemplo.invalid',
   '{"crm": "219876", "uf": "SP", "nome": "Dra. Clara Souto (fictícia)", "especialidade": "hematologia"}'),
  ('00000000-0000-4000-8000-000000000107', 'medico.infecto@exemplo.invalid',
   '{"crm": "229876", "uf": "SP", "nome": "Dr. Renato Alves (fictício)", "especialidade": "infectologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'clara-souto'
where id = '00000000-0000-4000-8000-000000000106' and page_slug is null;
update public.doctors set page_slug = 'renato-alves'
where id = '00000000-0000-4000-8000-000000000107' and page_slug is null;

-- Médicos fictícios de Oncologia e Nefrologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000108', 'medico.onco@exemplo.invalid',
   '{"crm": "239876", "uf": "SP", "nome": "Dra. Marina Teles (fictícia)", "especialidade": "oncologia"}'),
  ('00000000-0000-4000-8000-000000000109', 'medico.nefro@exemplo.invalid',
   '{"crm": "249876", "uf": "SP", "nome": "Dr. Felipe Rocha (fictício)", "especialidade": "nefrologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'marina-teles'
where id = '00000000-0000-4000-8000-000000000108' and page_slug is null;
update public.doctors set page_slug = 'felipe-rocha'
where id = '00000000-0000-4000-8000-000000000109' and page_slug is null;

-- Médicos fictícios de Ginecologia e Urologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000110', 'medico.gineco@exemplo.invalid',
   '{"crm": "259876", "uf": "SP", "nome": "Dra. Beatriz Lins (fictícia)", "especialidade": "ginecologia"}'),
  ('00000000-0000-4000-8000-000000000111', 'medico.uro@exemplo.invalid',
   '{"crm": "269876", "uf": "SP", "nome": "Dr. André Matos (fictício)", "especialidade": "urologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'beatriz-lins'
where id = '00000000-0000-4000-8000-000000000110' and page_slug is null;
update public.doctors set page_slug = 'andre-matos'
where id = '00000000-0000-4000-8000-000000000111' and page_slug is null;

-- Médicos fictícios de Geriatria, Pediatria, Psiquiatria e Otorrinolaringologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000112', 'medico.geriatra@exemplo.invalid',
   '{"crm": "279876", "uf": "SP", "nome": "Dr. Sérgio Paiva (fictício)", "especialidade": "geriatria"}'),
  ('00000000-0000-4000-8000-000000000113', 'medico.pediatra@exemplo.invalid',
   '{"crm": "289876", "uf": "SP", "nome": "Dra. Lívia Campos (fictícia)", "especialidade": "pediatria"}'),
  ('00000000-0000-4000-8000-000000000114', 'medico.psiquiatra@exemplo.invalid',
   '{"crm": "299876", "uf": "SP", "nome": "Dra. Joana Freitas (fictícia)", "especialidade": "psiquiatria"}'),
  ('00000000-0000-4000-8000-000000000115', 'medico.otorrino@exemplo.invalid',
   '{"crm": "218765", "uf": "SP", "nome": "Dr. Caio Moura (fictício)", "especialidade": "otorrinolaringologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'sergio-paiva'
where id = '00000000-0000-4000-8000-000000000112' and page_slug is null;
update public.doctors set page_slug = 'livia-campos'
where id = '00000000-0000-4000-8000-000000000113' and page_slug is null;
update public.doctors set page_slug = 'joana-freitas'
where id = '00000000-0000-4000-8000-000000000114' and page_slug is null;
update public.doctors set page_slug = 'caio-moura'
where id = '00000000-0000-4000-8000-000000000115' and page_slug is null;

-- Médicos fictícios de Pneumologia e Hepatologia, só para testar os módulos (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000116', 'medico.pneumo@exemplo.invalid',
   '{"crm": "228765", "uf": "SP", "nome": "Dr. Rafael Dias (fictício)", "especialidade": "pneumologia"}'),
  ('00000000-0000-4000-8000-000000000117', 'medico.hepato@exemplo.invalid',
   '{"crm": "238765", "uf": "SP", "nome": "Dra. Teresa Vale (fictícia)", "especialidade": "hepatologia"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'rafael-dias'
where id = '00000000-0000-4000-8000-000000000116' and page_slug is null;
update public.doctors set page_slug = 'teresa-vale'
where id = '00000000-0000-4000-8000-000000000117' and page_slug is null;

-- Médico fictício de Cirurgia Geral, só para testar o módulo (26/11/2026).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000118', 'medico.cirurgia@exemplo.invalid',
   '{"crm": "248765", "uf": "SP", "nome": "Dr. Paulo Nunes (fictício)", "especialidade": "cirurgia-geral"}')
on conflict (id) do nothing;

update public.doctors set page_slug = 'paulo-nunes'
where id = '00000000-0000-4000-8000-000000000118' and page_slug is null;
