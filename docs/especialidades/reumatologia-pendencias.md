# Reumatologia — o que falta no fluxo da consulta (análise de 24/11/2026)

O fluxo (telas, ordem, salvar, prontuário) é o mesmo de todas as especialidades. O que muda é o **conteúdo do
pacote** de cada especialidade. Hoje só a Dermatologia tem pacote completo.

| Etapa | Situação na Reumatologia | Dúvida |
|---|---|---|
| Página do médico / agendar | comum; o único médico de exemplo é de Dermatologia | A |
| Formulário do paciente | pronto e aprovado (24/11) | B |
| Agenda | comum | — |
| Anamnese | comum; modo Formulário do médico vaza em 2 partes; **sem lista de sinais de alerta** (o servidor só abre consulta de especialidade que tem a lista) | C, D |
| Exame físico | roteiro definido (reumatologia-exame-fisico.md); ainda não construído; leitura de laudos pela IA ainda não existe de verdade (nem na Derma: só exemplos) | E |
| História clínica | o texto do formulário "em linguagem de prontuário" foi escrito para a Derma; a IA usa o texto-guia (prompt) da Derma | F, G |
| Diagnósticos | texto-guia da Derma (ex.: "suspeita" = câncer de pele) | G |
| Conduta | tabela só de acne (Derma); Reumatologia sem tabela | H |
| Receita e anexos | comum; escalas da especialidade? | I |
| Prontuário | comum; o exame entra como texto (passo 2 do exame) | — |
| Retorno | a Evolução tem campos da Derma (aspecto das lesões, extensão %, comparação de fotos) | J |

## Dúvidas (perguntar uma por vez)
- A. Médico fictício de Reumatologia para os testes (24/11): "Dr. Paulo Mendes", página própria, cor da Reumato, contatos iguais aos da Dra. Ana Souza.
- B. Só na Reumato (24/11): a pergunta do trabalho vira "Seu trabalho exige esforço físico ou movimentos repetitivos?" (Sim / Não); Derma não muda.
- C. Modo Formulário do médico (24/11): Onde dói e Rigidez e dor em duas telas cada, só na tela do médico. O autor revisa depois no iPad e pode mudar.
- D. ~~Sinais de alerta~~ — feito: 11 sinais aprovados em 24/11 (backend/app/especialidades/reumatologia/sinais_alerta.yaml).
- E. Leitura de laudos/fotos pela IA (24/11): depois dos testes, como etapa própria autorizada pelo autor (IA paga); testes usam laudos de exemplo.
- F. Frases do formulário na história (24/11): exemplo aprovado (HDA com local, lados, edema prévio, rigidez, piora, dor N/10, outros sintomas; hábitos = trabalho com esforço; antecedentes; família).
- G. Textos-guia da IA: 6 arquivos em backend/app/especialidades/reumatologia/prompts/ (cópia da Derma, só exemplos e regras da pele trocados), 24/11 — aprovado.
- H. Grupos da conduta na Reumato (aprovado 24/11): 1. Cuidados e reabilitação · 2. Tópico e infiltração · 3. Tratamento sistêmico · 4. Exames e orientações (Derma não muda).
- H2. Conduta: começar sem tabela — a IA monta as opções nos 4 grupos e o médico escolhe; tabelas das doenças comuns depois dos testes, com o conteúdo do autor (24/11).
- I. Escalas (DAS28, CDAI, HAQ): depois dos testes (24/11); anexos começam iguais aos de todas.
- J. Retorno (24/11): o mesmo exame de 5 partes, com o que foi marcado na consulta anterior em cinza ao lado de cada parte; no fim "Comparado à consulta anterior: Melhor · Igual · Pior"; fotos de antes e de hoje lado a lado.
