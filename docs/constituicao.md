# Constituição do especIAlista — fluxo clínico

Regra fundadora declarada pelo autor do projeto em 14/11/2026. Sem estas regras o projeto não existe. Nenhuma fase, tela, modelo ou prompt pode contrariá-las; quando houver conflito, esta página prevalece e a dúvida é levada ao autor.

## O fluxo da consulta

Quatro fases, nesta ordem, uma fase alimentando somente a seguinte:

1. **Anamnese** transcrita.
2. **Exame físico e exames complementares**, colhidos e analisados com auxílio de IA (multimodal). A partir das fases 1 e 2, a IA gera a **História Clínica estruturada**. A fonte da história clínica são exclusivamente as informações das fases 1 e 2.
3. **Diagnósticos diferenciais (DD)**, listados por IA (modelos, RAGs, pesquisa em sites especializados), feitos somente após a análise da História Clínica e apenas com os dados dela.
4. **Conduta e tratamento**, baseados única e exclusivamente nos DD gerados na fase anterior, auxiliados por IA, fontes externas, RAGs e busca determinística por chave-valor / indexação relacional (lookup) em protocolos.

## A regra transversal

**Todas as fases são, obrigatória e inexoravelmente, revisadas e editadas pelo médico** (manter, excluir, modificar, acrescentar). Só depois dessa revisão o resultado da fase é **oficializado**, e só o resultado oficializado alimenta a fase seguinte.

A IA propõe; o médico decide.

## Abrangência

Estas regras gerais valem para **todas as especialidades e todas as doenças**, sem exceção. Cada especialidade pode ter **alguns fluxos particulares** próprios, que complementam as regras gerais e mudam algumas peculiaridades do fluxo para aquela especialidade. Esses fluxos particulares **só serão discutidos durante a construção daquela especialidade em particular**. Exemplos usados em conversa (ex.: HAS em cardiologia) são ilustrativos, não casos especiais.

## Consequências técnicas

Valem para a implementação do módulo clínico (Fase 2+ do roadmap). Registradas aqui para que o modelo de dados e os contratos de IA já nasçam compatíveis.

- A saída de cada fase é um **objeto tipado e versionado**, nunca texto livre solto. Estados: `rascunho_ia` → `revisado_medico` → `oficializado`. Só `oficializado` é entrada da fase seguinte.
- A IA da fase N recebe **apenas** o oficializado da fase N-1 (gating). Acordado em 13/11/2026: navegação livre entre as etapas da consulta, mas a IA de DD e de conduta fica bloqueada enquanto o predecessor não estiver oficializado.
- Fase 4, ordem das fontes: (a) lookup determinístico em tabela de protocolos (chave = diagnóstico codificado + qualificadores → conduta + fonte/versão da diretriz); (b) RAG em diretrizes quando não há chave exata ou para complementar; (c) fontes externas. Cada sugestão carrega a **origem** visível ao médico ("protocolo X v.Y" vs. "sugestão da IA").
- Toda edição do médico é **auditável** (quem, quando, o que mudou). É a base para calibrar a IA depois.

## Em aberto

Em qualquer especialidade, a conduta depende de dados que estão na História Clínica (fase 2), não no DD: idade, peso, função renal/hepática, alergias, gestação, medicações em uso, gravidade. Como a fase 4 "só vê o DD", a recomendação técnica é: o DD oficializado carrega seus **qualificadores** (estágio, gravidade, forma clínica) e a fase 4 pode ler da História Clínica oficializada **somente** um conjunto fixo de dados de segurança (alergias, função renal/hepática, peso, gestação/lactação, medicações em uso) para dose e contraindicação. Alternativa: a fase 4 lê a História Clínica inteira. **Decisão pendente do autor.**
