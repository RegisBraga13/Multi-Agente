# Página inicial do módulo (dermatologIA) — design

Aprovado pelo autor em 16/11/2026. "As mudanças ocorrem durante o desenvolvimento": ajustes visuais vêm por print, na tela rodando.

## Intenção
Primeira tela do módulo da especialidade, o que o médico vê ao entrar: a **agenda do dia**, pacientes em ordem de horário, cada um com o
tipo do atendimento. Começa por Dermatologia. Ponto de partida para o fluxo da consulta (próximas entregas).
No mapa de telas: MD-01 (agenda, visão do dia) com a entrada do MD-05 (hub). Fase 2, só visual, dados de exemplo.

## Objetivos
- Endereço `/modulo/<slug>` (primeiro: `/modulo/dermatologia`); a mesma tela serve a qualquer especialidade (pacote como dado).
- Cabeçalho numa linha: nome do módulo (dermatologIA, "IA" na cor da especialidade) · médico · data por extenso, com ‹ Hoje › para trocar o dia.
- Lista do dia, em ordem de horário, **uma linha por paciente**: horário · nome, idade · etiqueta do tipo · modalidade · situação do formulário · link Prontuário.
  - Tipo: **Consulta** (etiqueta cheia na cor da especialidade) ou **Retorno** (contornada). Escolha do autor: opção A (etiqueta, não três botões).
  - "Prontuário" é link discreto, só para quem já tem histórico.
  - Modalidade (Presencial/Online) e formulário (✓ preenchido / ○ pendente): acréscimos meus, aceitos pelo autor.
- Situação no dia (minha proposta, aceita): atendido = esmaecido com "Atendido"; o próximo paciente destacado.
- Clique na linha: aviso curto de que o atendimento é a próxima etapa (o fluxo da consulta não entra nesta entrega).
- Cabe em ~690 px de altura (regra "uma tela, sem vazar"); medido em 1280×690, 1366×768, 1717×900, 820×1180, 1180×820 antes de mostrar. Celular pode rolar.

## Não-objetivos
Login, Supabase, fluxo da consulta, prontuário real, agenda semana/mês, solicitações (MD-06), cadastro de paciente.

## Anti-objetivos
Página com rolagem interna ou espaço vazio; linha que quebra em duas no PC; cara de template.

## Restrições
- Constituição: nada aqui gera conteúdo clínico; a tela só lista e encaminha.
- Identidade: Source Serif 4 + Inter, papel reciclado, cor da especialidade dentro do módulo.
- Pacote por especialidade como dado (`especialidades.ts`), nunca cópia por especialidade.
- Tipos no formato da futura tabela `appointments` (ligação ao Supabase sem refazer a tela).

## Abordagens
1. **Tela nova no app React do especIAlista (escolhida)** — mesmo padrão da página do médico; reaproveita marca, cores, papel.
2. Portar a página inicial do `code\especialidades` — descartada: Next.js + servidor próprio; aproveitamos só as ideias (continuar consulta em andamento, última consulta, nova × retorno).
3. Página estática como a landing — descartada: o módulo é app, vai ter estado e banco.

## Decidido pelo autor
Só a página inicial; agenda do dia em ordem de horário; tipo como etiqueta (A).

## Calls meus (o autor pode mudar)
Endereço `/modulo/<slug>`; ‹ Hoje › para outros dias; "próximo" = primeiro paciente ainda não atendido, em ordem de horário (só no dia de hoje); ~9 pacientes de exemplo; sem cabeçalho de site (Topo/Rodapé da landing) — é app, não vitrine.

## Para o construtor
Valores visuais (tamanhos, espaços) decididos na tela pronta, por print.

## Revisão 2 (16/11/2026) — modelos do autor
O autor trouxe modelos (prints) e pediu "faça o que sugere":
- Início = saudação ("Bom dia, Dra. …") com data e nº de pacientes; três cartões **01 · Nova — Consulta**, **02 · Evolução — Retorno**,
  **03 · Histórico — Prontuário**; abaixo, cartão **Hoje** (lista) + cartão escuro **Fichas de pré-consulta** ao lado.
- Linha do paciente: horário · nome em negrito + "Consulta · Presencial · Unimed" · etiqueta da ficha (*Ficha pronta*, *Link enviado*, *Sem ficha*); "Próximo".
- Clicar no paciente abre a **ficha recebida** ao lado (alergia em destaque, queixa, em uso, antecedentes, transcrição), no lugar do cartão de fichas.
- Para caber em 690 px: Hoje começa no próximo paciente e mostra só os que cabem; atendidos viram contagem; "Ver agenda" abre o dia inteiro (#agenda, com ‹ Hoje ›).
- Fora agora (ideias para depois, não estão no .md): pagamento antecipado, horário liberado quando o particular não paga, oferta do horário em fila pelo WhatsApp.
- Calls meus: fonte mantida (Source Serif 4 + Inter, identidade combinada); cores dos cartões = petróleo · tom claro da especialidade · cor da especialidade;
  link Prontuário sai da linha e vai para o painel da ficha; cartões e "Iniciar" seguem com aviso de próxima etapa.
