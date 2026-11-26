# Pedido guardado: Auditoria integral (Medical Software Quality Framework)

**Quando usar:** antes de abrir o app para pacientes reais (antes do deploy), quando estiverem prontos:
o fluxo completo da consulta e do retorno, o login real do médico e as regras de assinatura do CFM.
Decisão de 24/11/2026: agora não é o momento (prioridade nº 1 é o app funcionando e bonito).

**Como usar:** colar o texto abaixo numa sessão nova. O relatório sai em `docs/audits/AUDITORIA_GERAL.md`.

---

# AUDITORIA INTEGRAL — MEDICAL SOFTWARE QUALITY FRAMEWORK

Atue como um engenheiro de software sênior, arquiteto de sistemas, especialista em segurança, inteligência artificial e qualidade de software médico.

Realize uma auditoria integral deste repositório, considerando que se trata de um aplicativo de consulta médica multiespecialidades auxiliada por IA, desenvolvido por Vibe Coding.

## 1. Dimensões obrigatórias de avaliação

**Qualidade clínica:** precisão, raciocínio clínico, diagnóstico diferencial, segurança terapêutica, contraindicações, interações, evidências científicas, integridade do prontuário e autonomia médica.

**Inteligência artificial:** fidelidade às instruções, alucinações, calibração, robustez, transcrição, análise multimodal, extração estruturada, qualidade do RAG, fundamentação, rastreabilidade e eficiência dos prompts.

**Engenharia de software:** arquitetura, modularidade, coesão, acoplamento, SOLID, redundâncias, código morto, complexidade, tipagem, dependências, persistência, gerenciamento de estado, integridade dos dados, tratamento de erros, testabilidade, desempenho, escalabilidade e dívida técnica.

**Segurança e privacidade:** autenticação, autorização, RLS quando aplicável, isolamento entre pacientes, criptografia, segredos, segurança das APIs, prompt injection, auditoria, LGPD, backup e recuperação.

**Experiência e fluxo clínico:** usabilidade, consistência visual, responsividade, acessibilidade, carga cognitiva, redundância de preenchimento, editabilidade, prevenção de erros e continuidade do atendimento.

**Operação e governança:** disponibilidade, resiliência, observabilidade, latência, custos, CI/CD, versionamento, rollback, documentação e monitoramento.

## 2. Escopo funcional

Avalie todas as etapas implementadas da consulta: agendamento, pré-consulta, identificação, transcrição, anamnese, antecedentes, exame físico, análise de imagens, exames complementares, hipóteses diagnósticas, conduta, prescrição, orientações, documentação, finalização e seguimento.

Verifique especialmente a consistência entre especialidades e a centralização das funcionalidades compartilhadas no Core.

## 3. Riscos específicos do Vibe Coding

Investigue:

- Código morto, órfão, duplicado ou redundante.
- Implementações paralelas e inconsistências arquiteturais.
- Hardcoding, mocks e funcionalidades sem implementação real.
- Correções superficiais e abstrações desnecessárias.
- Regressões funcionais e efeitos colaterais.
- Segurança implementada apenas no frontend.
- Testes insuficientes ou falsamente positivos.
- Divergências entre código, documentação e comportamento real.

## 4. Metodologia

- Mapeie inicialmente a arquitetura, stack, dependências e fluxos de dados.
- Analise frontend, backend, banco de dados, APIs, prompts, RAG e integrações.
- Rastreie os fluxos completos, da interface à persistência.
- Execute testes, lint, typecheck, build e verificações de segurança disponíveis em ambiente seguro.
- Diferencie problemas confirmados, riscos potenciais, itens não verificados e funcionalidades planejadas ainda não implementadas.
- Não presuma que uma funcionalidade está correta apenas porque existe código para ela.
- Não invente resultados, evidências ou testes.
- Utilize dados sintéticos nas avaliações clínicas, preservando a confidencialidade dos pacientes.

## 5. Relatório obrigatório

Para cada problema identificado, apresente:

- Identificador.
- Dimensão.
- Gravidade: P0 crítica, P1 alta, P2 média ou P3 baixa.
- Arquivo e linha.
- Evidência verificável.
- Causa raiz.
- Impacto clínico ou técnico.
- Correção recomendada.
- Teste necessário para validar a correção.

Atribua uma nota de 0 a 5 para cada dimensão avaliada, justificando-a com evidências. Itens não verificados não devem receber nota arbitrária.

Apresente um plano de correção priorizado por risco, impacto, esforço e dependências.

Falhas críticas de segurança, integridade de prontuários ou segurança clínica devem bloquear a recomendação de implantação, independentemente da pontuação global.

## 6. Controle permanente de qualidade

Após a auditoria, proponha:

- Regras permanentes para o CLAUDE.md.
- Skills especializadas em auditoria.
- Testes automatizados e critérios de aceitação.
- Quality gates para futuras implementações.
- Testes de regressão clínica, funcional e de IA.

Utilize como referências ISO/IEC 25010, OWASP ASVS, OWASP Top 10 para LLMs, NIST AI RMF, LGPD e, quando aplicáveis, ISO 14971, IEC 62304 e IEC 62366-1.

## 7. Restrições

Nesta primeira execução, realize exclusivamente a auditoria. Não modifique o código-fonte, banco de dados, dependências ou infraestrutura. Não execute operações destrutivas, commits, pushes ou deploys.

Salve o relatório em `docs/audits/AUDITORIA_GERAL.md`.

Aguarde minha aprovação antes de implementar qualquer correção.

Seja rigoroso, objetivo, fundamentado em evidências e orientado à causa raiz. Evite recomendações genéricas e refatorações sem benefício demonstrável.

Inicie agora.
