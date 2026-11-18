# 0004 — Motores com IA real: tabela primeiro, regras fixas em volta da IA, medição com médico simulado

**Data:** 18/11/2026 · **Situação:** aceita (marco 3A) · Plano: `docs/superpowers/plans/2026-11-18-servidor-marco-3a-motores.md`

**Contexto.** O marco 3 do desenho junta três subsistemas (motores, API/banco, telas). O 3A liga os motores
de texto ao Claude e mede cada um nos 20 casos aprovados, antes de qualquer tela depender deles.

**Decisão.**
1. **Um motor = uma função** que monta o pedido desidentificado, chama `chamar_motor` (privacidade →
   provedor → validação estrita → regra fixa do motor → política → registro) e aplica as regras do pacote.
   Provedor Anthropic atrás de `ProvedorIA`: `claude-opus-5-5`, saída estruturada, esforço por motor
   (história medium, sinais low, diagnósticos high, conduta medium, avaliadora medium), cache das instruções
   e fallback de recusa no servidor.
2. **Regras fixas em volta da IA:** sinal respondido "sim" dispara sem IA; urgência e ação de emergência
   saem dos sinais; evidência (da hipótese e do meta) só passa com trecho literal da entrada; pedido
   bloqueado por privacidade não derruba nenhuma regra fixa. Sinal respondido "não" e achado pela IA não
   dispara — vai para `conflitos`, em destaque.
3. **Conduta: tabela primeiro.** Protocolo pelo CID (YAML do pacote, fonte única; acne portada do frontend,
   com contraindicações por sinal). Com tabela, a IA só complementa (orientações e alertas, sem receitar);
   sem tabela, a IA propõe marcada "sugestão da IA".
4. **Medição com médico simulado:** a história da IA é aceita como veio; a conduta parte do diagnóstico
   ESPERADO (o médico corrige o DD), para um erro do DD não contaminar a conduta. Critérios clínicos pela IA
   avaliadora (trecho obrigatório; sem trecho = dúvida), o estruturado por regra. Caso que quebra conta o
   que faltou como falha.

**Primeira rodada real (18/11/2026, 20 casos, US$ 4,36, 73 s/caso):** história 100% dos critérios; sinais
perdidos 0; saídas inválidas 0; principal entre os 3: 85% (+3 dúvidas de subcategoria de CID); diagnósticos
81,6%; conduta 79,3% — a maior parte das falhas é falta de protocolo (só a acne tem tabela: 15%).
Avaliadora 8/8 na calibração.

**Para calibrar com o autor.** Protocolos das outras 14 chaves; contraindicações da acne (pendentes); acne
comedoniana leve recebe antibióticos da tabela (falta regra); certeza (onicomicose, urticária, SJS);
subcategoria de CID aceita ou não; os 8 pares de calibração; descer de modelo/esforço onde os números
mostrarem qualidade igual.
