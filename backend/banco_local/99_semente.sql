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
