# Fase 1 — escopo travado

> Regra fundadora do produto: [constituicao.md](constituicao.md). Nada aqui pode contrariá-la.

Entrega (seção 9 do .md): landing page, identidade visual, cadastro e contratação por especialidade.
Nada de Fase 2+ entra aqui. Ideias de outras fases vão para "Depois", no fim deste arquivo.

## Checklist
- [x] Repositório e estrutura (frontend React/TS/Tailwind, backend FastAPI, supabase/)
- [x] Modelo de dados: desenho geral + migração só da Fase 1
- [x] Tipografia: Source Serif 4 (marca e módulos) — `docs/identidade/proposta-v2.html`
- [x] Sistema de marca: especIAlista com letras coloridas e "IA" preto; módulos = nome da especialidade com "IA" na cor dela (geriatrIA, reumatologIA…)
- [x] Landing trazida de `code\app-medico\public\landing.html` (funcionalidades + papel reciclado) → `frontend/public/landing.html`, com Source Serif 4 + Inter e marca nova
- [x] Regra de cor: landing = cores do logo (uma por seção, na ordem das letras); o que mostra o módulo por dentro (demonstrações, LP-02, módulo do médico) = cor da especialidade
- [x] Modo claro (padrão) na paleta Petróleo
- [x] Modo noturno (opcional, botão ◐) na paleta Índigo, com as cores do logo clareadas para não sumirem
- Landing: editada direto em `frontend/index.html`. `docs/identidade/adapta_landing.py` fica só como registro de como ela foi adaptada do app-medico (não rodar de novo: sobrescreveria as edições)
- [ ] LP-01 Home
- [x] ~~LP-02 Página da especialidade~~ — removida: não há página demonstrativa. Fluxo: landing → escolhe especialidade → testa ou compra → acesso direto ao módulo. A faixa da landing leva a `/contratar?esp=...`
- [x] Estrutura: landing estática = `frontend/index.html` (raiz); telas React = `frontend/app.html` (rotas listadas em `vite.config.ts`, a hospedagem precisa da mesma reescrita)
- [ ] LP-03 Planos
- [ ] LP-08 Legais (termos, privacidade, transparência de IA)
- [ ] LP-06 Login + MFA (Supabase Auth)
- [ ] LP-07 Recuperar acesso
- [ ] LP-05 Verificação de CRM/RQE e ativação
- [x] Regra: CRM (número + UF) obrigatório sempre, inclusive no teste grátis. Cadastro curto: nome, e-mail, CRM + UF, especialidade (já vem da landing), senha, aceite dos termos; RQE opcional. Acesso direto ao módulo; conferência do CRM depois, e o acesso cai se for recusada (view `doctor_modules`)
- [ ] Decidir preços (antes da LP-04). Landing hoje com marcadores: teste grátis "[N] dias", Profissional "R$ [m]/mês", Clínicas "Em breve". Referência do usuário (Solara): teste 7 dias sem cartão · Profissional R$ 249/mês por usuário · Clínica sob consulta, a partir de 5 médicos. Falta decidir: duração do teste, valor mensal e anual (desconto de 2 meses?), Clínica "em breve" ou "sob consulta"
- [ ] Decidir gateway de pagamento
- [~] LP-04 Contratação — tela `/contratar?esp=...` pronta (cadastro curto com CRM obrigatório, validação com testes, botões da landing apontam para ela). Falta: ligar ao Supabase (hoje simulado, nada é gravado), confirmação de e-mail, MFA, e o pagamento do plano Profissional
  - Tem também: "← Voltar", "Continuar com Google" (depois pede só CRM + UF, especialidade e aceite) e selo "Tratamento de dados conforme a LGPD · banco de dados no Brasil"
  - **Obrigatório por causa do selo:** criar o projeto Supabase na região de São Paulo (sa-east-1). O Google precisa ser ativado no Supabase (Auth → Providers)
- [ ] Publicação (domínio, hospedagem)

## Ordem
Identidade → páginas públicas (LP-01, 02, 03, 08) → acesso (LP-06, 07) → verificação (LP-05) → gateway → contratação (LP-04) → publicação.
As páginas públicas não dependem do banco nem do gateway, então ficam prontas primeiro.

## Depois (fora da Fase 1)
- Referências do app Solara (visto em 13/11/2026), para as Fases 2–3:
  - Painel inicial: saudação, data, cartões (hoje, semana, tempo economizado, duração média), "Iniciar consulta", consultas recentes com filtro primeira consulta/evolução
  - Nova consulta: gravar primeiro e atribuir o paciente depois; paciente existente (busca por nome/CPF) ou novo; tipo de documento (primeira consulta = HPMA/RS/antecedentes/HD/conduta · evolução = SOAP); resumo lateral; aviso "áudio apagado após a transcrição"
  - Modelos: anamnese, evolução e receita, com padrão do médico e variáveis (@paciente.nome, @medico.crm, @data.hoje)
  - Ajustes: nome, e-mail, CRM + UF, especialidade
