# Fase 1 — escopo travado

Entrega (seção 9 do .md): landing page, identidade visual, cadastro e contratação por especialidade.
Nada de Fase 2+ entra aqui. Ideias de outras fases vão para "Depois", no fim deste arquivo.

## Checklist
- [x] Repositório e estrutura (frontend React/TS/Tailwind, backend FastAPI, supabase/)
- [x] Modelo de dados: desenho geral + migração só da Fase 1
- [x] Tipografia: Source Serif 4 (marca e módulos) — `docs/identidade/proposta-v2.html`
- [x] Sistema de marca: especIAlista com letras coloridas e "IA" preto; módulos = nome da especialidade com "IA" na cor dela (geriatrIA, reumatologIA…)
- [x] Landing trazida de `code\app-medico\public\landing.html` (funcionalidades + papel reciclado) → `frontend/public/landing.html`, com Source Serif 4 + Inter e marca nova
- [x] Regra de cor: landing = cores do logo (uma por seção, na ordem das letras); o que mostra o módulo por dentro (demonstrações, LP-02, módulo do médico) = cor da especialidade
- [x] Paleta Índigo (seletor temporário removido)
- [x] Tema escuro na paleta Índigo, com as cores do logo clareadas para não sumirem
- Landing gerada por `docs/identidade/adapta_landing.py` a partir da landing do app-medico
- [ ] LP-01 Home
- [ ] LP-02 Página da especialidade (template)
- [ ] LP-03 Planos
- [ ] LP-08 Legais (termos, privacidade, transparência de IA)
- [ ] LP-06 Login + MFA (Supabase Auth)
- [ ] LP-07 Recuperar acesso
- [ ] LP-05 Verificação de CRM/RQE e ativação
- [ ] Decidir gateway de pagamento
- [ ] LP-04 Contratação
- [ ] Publicação (domínio, hospedagem)

## Ordem
Identidade → páginas públicas (LP-01, 02, 03, 08) → acesso (LP-06, 07) → verificação (LP-05) → gateway → contratação (LP-04) → publicação.
As páginas públicas não dependem do banco nem do gateway, então ficam prontas primeiro.

## Depois (fora da Fase 1)
- (vazio)
