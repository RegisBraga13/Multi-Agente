# Consulta (Módulo A) — design

Proposta do autor em 16/11/2026: "ideia inicial, podemos mudar no decorrer do desenvolvimento". Ajustes visuais vêm por print, na tela rodando.

## Intenção
A tela onde o médico faz a consulta, seguindo o fluxograma da landing (`frontend/index.html`, hero): 1 Anamnese · 2 Exame físico e
complementares · História clínica · 3 Diagnósticos diferenciais · 4 Conduta e tratamento · Anexos + assinatura. Em vez de uma página longa,
o fluxo vira **4 páginas**, cada uma do tamanho de uma tela. Fase 2, só visual, dados de exemplo, começando por Dermatologia.

## As páginas (decidido pelo autor)
| # | Página | Fases da Constituição | Mapa de telas |
|---|---|---|---|
| 1 | **Anamnese e exame** | 1 e 2 | CA-01 + CA-02 |
| 2 | **História clínica** | saída de 1 + 2 | CA-03 |
| 3 | **Diagnósticos diferenciais** | 3 | CA-04 |
| 4 | **Conduta e tratamento** | 4 | CA-05 |
| — | **Anexos** (ocultos, abertos quando o médico pede) | — | CA-06 |

Motivo do autor para juntar anamnese e exame: na consulta ele **vai e volta** entre conversa e exame; os dois precisam estar visíveis ao mesmo tempo.

## Abordagens da página 1 (escolhida: A)
- **A. Duas colunas (escolhida).** Anamnese à esquerda, exame à direita, com abas *Exame físico* · *Complementares*. A gravação segue
  visível enquanto o médico preenche o exame. Sugestões da IA dentro de cada bloco, tracejadas até confirmar (como na landing).
- B. Duas colunas sem abas (exame físico e complementares empilhados) — descartada: não cabe em ~690 px sem rolagem.
- C. Uma área por vez com troca rápida — descartada: esconde um lado, contra o "vai e volta".

O autor: "A. Caso não goste, mudo."

## Estrutura comum às 4 páginas
```
dermatologIA   Ana Ribeiro, 24 · Consulta · Presencial   [ALERGIA: dipirona]
① Anamnese e exame  ② História  ③ Diagnósticos  ④ Conduta          [Anexos]
┌──────────────────── conteúdo da página ─────────────────────┐
└──────────────────────────────────────────────────────────────┘
                              especIAlista (rodapé)
```
- **Topo** (uma linha): nome do módulo · paciente (nome, idade, tipo, modalidade) · alergia em bloco cheio `alerta-clinico` quando houver.
- **Navegador das etapas** (uma linha, não coluna lateral — para caber): as 4 páginas, a atual marcada, cada uma com a situação
  (rascunho / revisado / oficializado / desatualizado). Navegação livre entre elas.
- **Anexos**: botão discreto no topo, em todas as páginas. Abre um painel por cima (receita, orientações, atestado, pedido de exames,
  encaminhamento, laudo); fecha sem sair da página.
- Rodapé com especIAlista (regra do módulo). Cada página cabe em ~690 px de altura, medida em 1280×690, 1366×768, 1717×900,
  820×1180 e 1180×820 antes de mostrar. Celular pode rolar.

## Página 1 — Anamnese e exame
- **Coluna Anamnese:** gravar / pausar com indicador visível (só com consentimento registrado na ficha), relógio, transcrição com
  Médico/Paciente; respostas da ficha da pré-consulta entram como *Relatado*; "Faltou perguntar" e sinais de alerta (cada um exige
  "avaliado" ou "não se aplica"). Opção de escrever em vez de gravar.
- **Coluna Exame:** aba *Exame físico* (fotos numeradas + campos da especialidade: morfologia, localização, lesões, gravidade, cicatrizes
  em Dermatologia) e aba *Complementares* (laudos/PDFs com valores extraídos).
- **Dois botões Oficializar**, um por coluna (Constituição: duas fases, cada uma revisada e oficializada; a história só nasce com as duas).

## Página 2 — História clínica
QP, HMA, antecedentes, medicamentos, alergias, hábitos, exame físico, e o **bloco de segurança** (idade, peso, função renal/hepática,
alergias, gestação/lactação, medicamentos em uso, gravidade). Rascunho da IA montado só com 1 e 2 oficializadas; cada trecho mostra a
origem; edição livre; **Oficializar história**.

## Página 3 — Diagnósticos diferenciais
Hipóteses da IA com CID e percentual (como na landing), evidências a favor/contra ligadas à história, "não pode perder", investigação
sugerida; o médico marca confirmada / provável / descartada e **adiciona a sua**. **Oficializar diagnósticos.**

## Página 4 — Conduta e tratamento
Medicamentos (dose, via, duração), exames, orientações, encaminhamentos, retorno sugerido; alerta de alergia/interação; aceite item a item;
cada sugestão com a origem (protocolo → RAG → externa). Ao fim, **Finalizar consulta**: abre os Anexos já preenchidos a partir da conduta
+ conferência (sinais de alerta tratados, etapas oficializadas) + assinatura → salvo no prontuário, sem alteração depois (só adendo).
Esta é a CA-07 do mapa, no lugar indicado pela landing ("Assinar com VIDaaS e salvar no prontuário").

## Regras (Constituição e mapa — não mudam)
- Estados de cada etapa: `rascunho_ia` → `revisado_medico` → `oficializado`. A IA da etapa N só usa o oficializado da N−1.
- Navegação e edição livres; o que a IA gera numa página fica bloqueado até a anterior estar oficializada (aviso dizendo qual falta).
- Mudou uma etapa já oficializada → as seguintes ficam **desatualizadas** até nova revisão.
- Proveniência em todo dado: Relatado · Observado · Inferido pela IA · Confirmado. Extração de exames: `PRESENT` / `INFERRED` / `MISSING`
  (MISSING = vazio; INFERRED com trecho de origem e aviso).
- Nenhuma saída da IA vira registro sem o médico (no vocabulário do JEV: toda decisão clínica é `HUMAN_REVIEW`; nada é `AUTO_EXECUTE`).

## Objetivos desta entrega
- Endereço `/modulo/<slug>/consulta/<atendimento>/<etapa>` (calls meus), entrada pelo cartão **Consulta** e pelo **Iniciar** da página
  inicial do módulo (hoje mostram aviso de "próxima etapa").
- Desenhar o fluxo todo; **construir página por página, começando pela 1** (com topo, navegador e botão Anexos).
- Tipos já no formato das tabelas da Fase 3/4 (`encounters`, `transcripts`, `attachments`, `clinical_facts`, `clinical_histories`,
  `ai_proposals`, `diagnostic_hypotheses`, `care_plans`, `documents`), para ligar ao Supabase sem refazer a tela.
- Mapa de telas atualizado: 7 etapas → 4 páginas + Anexos + Finalizar.

## Não-objetivos
Gravação e transcrição reais, IA real, upload real, assinatura digital real, banco, login, retorno, prontuário.

## Anti-objetivos
Rolagem dentro de cartões; página que vaza da tela; IA "decidindo" (sugestão que vira registro sem clique do médico); cara de template.

## Restrições
Identidade e paleta oficial (só tokens de `index.css`, cor da especialidade por `--esp`, alergia em `alerta-clinico`); pacote da
especialidade como dado (campos do exame físico vêm de `especialidades`/pacote, não da tela); textos curtos.

## Calls meus (o autor pode mudar)
- Navegador em linha no topo, não coluna; sem terceira coluna de IA (sugestões dentro dos blocos).
- Anexos como painel por cima, acessível em qualquer página; Finalizar consulta no fim da página 4.
- Paciente de exemplo da agenda (dados fictícios), com rascunhos de exemplo em cada página.
- Simular a oficialização (botão muda estado, libera a próxima) para o fluxo poder ser percorrido.
- Branch próprio a partir de `pagina-inicial-modulo` (ainda não juntado na master).

## Para o construtor
Valores visuais decididos na tela pronta, por print. Conteúdo exato das páginas 2–4 detalhado quando cada uma for construída.
