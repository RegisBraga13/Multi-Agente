# Retorno — parte 1: marcar o retorno (design curto)

Data: 22/11/2026. Origem: brainstorming 5W1H com o autor. Partes seguintes (2 abrir o retorno, 3 Evolução no servidor, 4 prontuário do retorno) ficam para depois, uma por vez.

## Intenção

O médico combina o retorno com o paciente ainda no consultório. A data marcada entra no prontuário da consulta de origem e aparece na agenda como cartão "Retorno". Na chegada, o médico abre esse cartão e escolhe Retorno (parte 2).

## Decidido pelo autor

- Na página 5 (Receita e anexos), **ao lado de "anexos"**, fica a escolha **Retorno: Sim / Não**.
- **Não:** vai direto ao prontuário, que termina com "Sem retorno".
- **Sim:** a agenda abre; o médico marca dia e horário (online ou presencial); vai ao prontuário, que termina com o dia do retorno.
- **Nada é gravado até Finalizar.** Antes disso é rascunho e pode mudar (Sim↔Não, trocar horário). O cartão só entra na agenda ao finalizar.
- A agenda terá **dias e horários reservados para retorno** (fora da página do paciente), para não haver conflito. Como o médico os define: **a combinar depois**.
- **Conduta ≠ Retorno:** a linha da Conduta "Retorno em X semanas" passa a ser **"Avaliação em X semanas"** (recomendação; se o paciente quiser, marca outra consulta). Pode aparecer também na conduta de um retorno. "Retorno" é só o que foi marcado no botão.

## Não objetivos (parte 1)

Abrir o retorno a partir do cartão, Evolução, História da evolução, prontuário do retorno, definir os dias de retorno.

## Abordagem

Rascunho só na tela (estado da consulta, como as outras páginas); **vai no corpo do Finalizar** como `retornoMarcado` (data, hora, modalidade) ou nulo. O servidor, **na mesma operação de finalizar**, confere que o horário está livre, cria o cartão "Retorno" na agenda ligado ao paciente e à consulta de origem, e grava o dia no prontuário. Horário ocupado → recusa com mensagem; o médico escolhe outro sem perder o prontuário.

Alternativa descartada: reservar o horário ao marcar. Contraria "nada garante registro até finalizar" e deixaria horário preso em consulta abandonada.

## Suposições minhas (corrigir se errado)

1. Na parte 1, a agenda do botão mostra os horários livres comuns; os dias reservados de retorno entram quando o autor os definir.
2. O cartão "Retorno" é um novo tipo de item da agenda (não é pedido do paciente): sem formulário, com nome do paciente já conhecido.
3. O prontuário ganha um campo próprio para o retorno marcado; o campo `retorno` de hoje (texto da conduta) vira "avaliação". Muda o contrato dos dois lados (servidor e tela) e a versão do schema do prontuário.
4. Mesmo horário nunca fica duplicado: a conferência e a criação do cartão são uma só operação.

## Testes

Sim grava cartão + dia no prontuário; Não grava "Sem retorno" e nenhum cartão; trocar Sim→Não antes de finalizar não deixa nada na agenda; horário ocupado recusa o Finalizar sem perder dados; horário no passado recusado; finalizar duas vezes não duplica o cartão (idempotência); rótulo "Avaliação" na Conduta e no prontuário.
