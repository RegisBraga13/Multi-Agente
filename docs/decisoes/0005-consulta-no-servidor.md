# 0005 — A consulta no servidor: blocos por etapa, IA com escrita ao vivo, prontuário montado pelo servidor

**Data:** 18/11/2026 · **Situação:** aceita (marco 3B, aprovado pelo autor) · Plano: `docs/superpowers/plans/2026-11-18-servidor-marco-3b-consulta.md`

**Contexto.** O 3A ligou os motores à IA real. O 3B leva a consulta inteira ao servidor, para que a
Constituição seja garantida no servidor e o prontuário fique no Postgres, sem mudar nada do que o médico vê.

**Decisão.**
1. **Nenhuma mudança no fluxo nem no estilo das telas** (regra do autor). O servidor só troca a origem dos dados.
2. **Escrita ao vivo como no desenho (§7.7):** `POST /consultas/{id}/{etapa}/gerar` responde em SSE — eventos
   `parcial` (o resultado até ali, só para mostrar) e `pronto` (a proposta validada). A tela continua animando
   no ritmo dela. Nada parcial é gravado nem passa adiante.
3. **Um bloco por etapa** (`anamnese → exame → historia → diagnosticos → conduta`), nas tabelas da 0007; editar
   ou reoficializar uma etapa marca as seguintes como desatualizadas; a IA da etapa N só roda com a N-1
   oficializada e em dia (409). Gerar sobre bloco já revisado pelo médico não sobrescreve (sugestão ao lado).
4. **O servidor monta o prontuário** (`DadosEntrada`) a partir dos blocos oficializados (porte de
   `dadosDaConsulta`); finalizar exige as 5 etapas em dia e os documentos enviados; depois, só adendo.
5. **Documentos** (receita, atestado, laudo): o texto continua montado pela tela, no formato aprovado; o
   servidor guarda o texto final e o estado (autor, 18/11).
6. **Sem fila** no primeiro uso (um médico, local); entra atrás de uma interface quando houver mais uso (autor, 18/11).
7. **Toda chamada da IA em `ai_proposals`**, com a proposta validada; IA real só com `IA_PROVEDOR=anthropic`
   (padrão: demonstração, sem chave e sem custo).

**Consequências.** O 3C troca a simulação das telas pelas rotas, página por página. Nome do paciente no pedido
à IA (autor, 18/11): parte do nome só bloqueia com inicial maiúscula, como nome escrito ("Clara relata…"); em
minúscula é palavra comum e passa ("pele clara"); partículas (de, da, dos…) nunca contam; números (CPF,
telefone) sempre bloqueiam. Datas que o médico lê saem em dia/mês/ano (autor, 18/11).
