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

## Atualização da história pela IA (decidido pelo autor, 16/11/2026) — NÃO ESQUECER na ligação com a IA real
Regras da tela (já na simulação):
- "Salvar" não trava nada; só libera a fase seguinte. Tudo salvo continua editável. Imutável só no fim (Finalizar → prontuário; depois, adendo).
- Fase já alcançada não some: se a anterior for editada, ela fica "Desatualizada" até salvar de novo.
- Anamnese/exame salvos de novo → a IA **não reescreve a história inteira**. Por seção:
  - origem não mudou → fica como está (com as edições do médico);
  - origem mudou e o médico não tinha editado → a IA reescreve a seção (etiqueta "Atualizado");
  - origem mudou e o médico tinha editado → o texto dele fica; a IA mostra **sugestão ao lado** (Aceitar / Manter o meu). Salvar só depois de decidir.

Contrato do pedido à IA (Sonnet 5.5), quando sair da simulação:
- **Entrada:** história salva atual (por seção, com marca de quais o médico editou) + **só o que mudou** na anamnese/exame (antes → depois) + lista fixa das seções. Nunca o prompt inteiro de novo; nada fora da anamnese e do exame salvos (Constituição).
- **Saída tipada, validada em runtime antes de usar:** `{ secoes: [{ secao: <uma das 6>, acao: 'manter' | 'reescrever' | 'sugerir', texto?: string, motivo: string, origem: string /* trecho da anamnese/exame que justificou */ }] }`. Seção que o médico editou só aceita `manter` ou `sugerir` (nunca `reescrever`) — regra determinística no app, não confiança na IA.
- **Política:** saída inválida → descartada, médico avisado, história atual intacta (REJECT). Toda mudança passa pelo médico (HUMAN_REVIEW); nada é AUTO_EXECUTE.
- **Registro (auditoria):** id da decisão, modelo e versão, versão do contrato, seções alteradas/sugeridas, aceito/mantido pelo médico, data/hora. Sem prompt completo nem dados pessoais no log.
- **A calibrar com uso real:** se a IA erra a seção afetada (falso positivo/negativo) e quanto o médico aceita das sugestões.

## Página 3 — Diagnósticos diferenciais (proposta aprovada pelo autor, 16/11/2026)
- **Quando aparece:** só depois de "Salvar história"; abre sozinha e a IA escreve as hipóteses no ritmo da história (3 letras / 33 ms).
  Ao voltar a uma página já escrita, ela aparece pronta (não escreve de novo).
- **Hipóteses:** até 3 da IA, com CID-10 e %, da mais à menos provável (como na landing). Toque na linha = confirmar; × = descartar.
  "+ Adicionar outro diagnóstico": nome + CID opcional (nunca preenchido pela IA); entra confirmado, com a etiqueta "Seu".
- **Embasamento:** cada hipótese com pontos a favor (+) e contra (−); cada ponto cita a seção da história e, ao tocar, o trecho exato.
- **Não pode perder:** cartão escuro, só quando existe um (Carlos: melanoma; Antônio: carcinoma espinocelular; Luíza: lúpus; João Pedro:
  artrite psoriásica). Nada inventado onde não há (acne, melasma...). Não é vermelho (vermelho só alergia).
- **Salvar diagnósticos** (call meu): exige ao menos um diagnóstico confirmado, o "não pode perder" marcado como avaliado e nenhuma
  sugestão pendente. O motivo só aparece depois de tentar salvar. Salvar libera a Conduta.
- **História mudou e foi salva de novo** — por hipótese (chave = id estável, não a posição, porque a ordem muda com o %):
  - igual → fica como está, com a decisão do médico;
  - mudou e o médico não tinha decidido → a IA reescreve ("Atualizado");
  - mudou e o médico tinha decidido → a decisão fica; sugestão ao lado ("46% → 38%": Manter / Rever);
  - a IA não sugere mais → some se ninguém decidiu; se o médico decidiu, fica com sugestão (Manter / Retirar);
  - diagnóstico do próprio médico → a IA nunca toca.
- **Simulação (calls meus):** hipóteses de exemplo por paciente em `diagnosticos-exemplo.ts` (13 de Dermatologia). Cada pista só vale se o termo
  estiver na história salva (o trecho citado é literal); sem nenhuma pista a favor a hipótese não é sugerida; o % cai quando somem pistas a favor
  e sobe quando somem pistas contra. Outras especialidades: sem hipóteses (só "Adicionar").

Contrato do pedido à IA (Sonnet 5.5), quando sair da simulação — NÃO ESQUECER:
- **Entrada:** só a história clínica salva (por seção) + na atualização, as hipóteses atuais com a decisão do médico. Nada fora da história (Constituição).
- **Saída tipada, validada em runtime antes de usar:** `{ hipoteses: [{ id, nome, cid10, pct: 0–100, evidencias: [{ lado: 'favor'|'contra', texto, secao: <uma das 6>, trecho }] }], naoPerder: { nome, cid10, porque, como } | null }`.
  Regras determinísticas no app, não confiança na IA: todo `trecho` tem de existir literalmente na seção citada; hipótese sem evidência a favor é
  descartada; CID-10 conferido contra a tabela oficial; decisão do médico e diagnóstico do médico nunca mudam pela IA.
- **Política:** saída inválida → descartada, médico avisado, hipóteses atuais intactas (REJECT). Toda hipótese é sugestão (HUMAN_REVIEW); nada é AUTO_EXECUTE.
- **Registro (auditoria):** id da decisão, modelo e versão, versão do contrato, hipóteses sugeridas/atualizadas, confirmadas/descartadas pelo médico, data/hora. Sem prompt nem dados pessoais.
- **A calibrar com uso real:** o % é sinal operacional para ordenar, não probabilidade de acerto; medir quanto o médico confirma a 1ª hipótese,
  quantas vezes acrescenta a sua, e se o "não pode perder" aparece quando devia (falso negativo é o erro caro).
