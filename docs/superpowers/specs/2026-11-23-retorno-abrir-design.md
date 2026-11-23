# Retorno, parte 1: abrir o cartão "Retorno" (design curto)

Aprovado pelo autor em 23/11/2026 (conversa). Parte 2 (gravar Evolução e o resto no servidor) e parte 3 (prontuário + Finalizar) vêm depois, uma de cada vez.

## Decisões do autor
- **Um retorno por consulta**, chamado só "Retorno" (título do prontuário: "Consulta N — Retorno"; nunca "Retorno 2").
- **Próxima vez do paciente no consultório = nova consulta** (Consulta N+1), mesmo com prontuário.
- Só o cartão "Retorno" da agenda abre retorno.
- Retorno finalizado: o cartão não abre outro retorno; mostra o prontuário.

## O que a parte 1 faz
- Pedido novo (`abrir_do_pedido`) vira **sempre** `tipo="consulta"` (corrige o defeito: o servidor gravava "retorno" e a tela abria "consulta").
- Novo `POST /consultas/do-retorno/{retorno_id}` `{especialidade}`: cria a consulta `tipo="retorno"` do paciente do cartão, uma única vez (idempotente); devolve a mesma se já aberta. Ligação: `encounters.return_booking_id` (único). Outro médico / cartão inexistente = 404.
- Novo `GET /agenda/retornos/{id}` (cartão por id).
- Tela: o cartão ganha "Abrir consulta"; abre `/modulo/<esp>/consulta/retorno-<id>/anamnese-exame` na Evolução, sem o botão Retorno na página 5. O prontuário anterior (fotos, exames, diagnósticos) vem do servidor.
- Retorno já finalizado: a tela mostra "Esta consulta já foi finalizada. O prontuário está salvo." (o mesmo aviso da consulta).

## Fora desta parte (suposição declarada)
A Evolução e as demais etapas do retorno continuam **sem gravar no servidor** (simulação local, como hoje): é a parte 2. O servidor só garante que o retorno existe, uma vez, ligado ao cartão.

## Abordagens consideradas
A) Coluna `return_booking_id` em `encounters` (escolhida: simétrica ao `booking_request_id`, única, simples de testar). B) Guardar o id do retorno dentro do pedido de origem: descartada, o retorno nem sempre vem de um pedido. C) Criar a consulta de retorno já ao finalizar a de origem: descartada, o autor quer que nada seja criado antes de o médico abrir o cartão.
