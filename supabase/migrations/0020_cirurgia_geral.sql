-- Cirurgia Geral (autor, 26/11/2026): formulário e exame físico próprios.
-- A linha 'cirurgia' (0004, ainda sem módulo) passa a ser a Cirurgia Geral; as ligações são pelo id, nada se perde.
update public.specialties set slug = 'cirurgia-geral', name = 'Cirurgia Geral' where slug = 'cirurgia';
insert into public.specialties (slug, name) values ('cirurgia-geral', 'Cirurgia Geral')
on conflict (slug) do nothing;
