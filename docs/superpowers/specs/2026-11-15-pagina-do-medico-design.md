# Página do médico (entrada do paciente) — design

Data: 15/11/2026 · Telas do mapa: PC-01 (página pública do médico) e PC-09 (solicitar horário), com o formulário PC-04/PC-05 na versão "preencher aqui".
Fase do roteiro: 2. Começada agora por decisão do autor (15/11/2026), antes de fechar os itens pendentes da Fase 1 (login, legais, pagamento, publicação).

## Por que

Cada médico divulga o próprio link nas redes sociais e avisa os pacientes pelo canal que já usa. O paciente chega por esse link, quase sempre pelo celular, e é ali que ele marca a consulta. A página é a porta de entrada do paciente no especIAlista.

## O que o autor definiu

1. O paciente entra e vê a agenda com dias e horários livres. Escolhe um.
2. Escolhe a modalidade: **online** ou **presencial**.
3. Diz se **concorda ou não com a transcrição de voz** na consulta.
4. Ao escolher o horário, abre-se o formulário, em duas partes: **dados pessoais** e **pré-consulta** (opcional, alguns dados clínicos).
5. Três formas de preencher, nesta ordem de preferência, e a página **tenta convencer** o paciente a preencher antes da consulta:
   1. **WhatsApp** (preferida: mais rápido, e ele tem tempo para pensar);
   2. **na própria página**;
   3. **durante a consulta**, presencial ou online (último recurso, quando ele recusa as outras duas).
6. Depois, o consultório faz a rotina: lembretes, confirmação, desmarcar e remarcar.
7. A página tem também a parte "como funciona a consulta", voltada ao paciente, **na mesma página** da agenda.
8. Visual igual ao da landing, com a **cor da especialidade** predominando. Começamos por **Dermatologia**.

## Objetivos desta entrega

- Página completa e clicável, com dados de exemplo, para o autor ajustar o visual vendo a página (como foi feito na landing).
- Funciona bem no celular (onde o paciente está) e continua correta no tablet e no PC.
- Os tipos dos dados de exemplo já têm o formato que o banco vai ter, para a ligação ao Supabase ser a próxima entrega sem refazer a tela.

## Fora desta entrega

- Gravar qualquer coisa no banco (vem na próxima entrega).
- Enviar mensagem pelo WhatsApp (ferramenta ainda não escolhida). A tela mostra o que vai acontecer; nada é enviado.
- Lembretes, confirmação, desmarcar e remarcar (item 6): dependem do WhatsApp e do banco.
- A tela do médico que aprova os pedidos (MD-06) e a configuração da agenda pelo médico.
- Sala da consulta online (PC-08).

## O que não pode acontecer (anti-objetivos)

- O paciente desistir no meio por excesso de passos ou de texto: marcar o horário tem que ser rápido; o convencimento a preencher antes é insistente, mas não bloqueia.
- Recusar a transcrição impedir o agendamento. Recusar é uma resposta válida.
- Consentimento sem informação: o paciente só responde sobre a transcrição depois de ler, ali mesmo, o que ela é.
- Pedir dados que não serão usados (LGPD: só o necessário).
- A página parecer do especIAlista e não do médico.

## Caminhos considerados

1. **Primeiro o visual, com dados de exemplo — escolhido.** Página completa e clicável, nada gravado; banco na entrega seguinte. Foi assim que a landing deu certo, e ajuste de visual depois do banco pronto custa mais.
2. Visual e banco juntos: chega antes a algo funcionando, mas cada ajuste de visual pode obrigar a refazer tabelas.
3. Página estática como a landing: descartado, porque cada médico tem a própria página e a própria agenda, e isso pede o app React que já existe.

## Como a página funciona

Endereço: `/medico/<slug>` (exemplo: `/medico/ana-souza`), no app React (`app.html`), como o `/contratar`. Rota acrescentada a `ROTAS_DO_APP` em `vite.config.ts`.

Médico de exemplo: **Dra. Ana Souza, dermatologista, CRM 12345-CE** (o mesmo nome da receita da landing), com endereço do consultório e atendimento online. O RQE é **opcional**: aparece só se o médico tiver; não ter RQE não impede o médico de usar a página da especialidade (decisão do autor, 15/11/2026).

De cima para baixo (celular):

```
Foto · Dra. Ana Souza · Dermatologista
CRM 12345-CE · [RQE, se houver] · endereço · atende online
[ Agendar consulta ]                 ← leva à agenda

AGENDA
Presencial | Online                  ← escolha da modalidade
dias (faixa rolável, próximas 2 semanas)
horários livres do dia escolhido

COMO FUNCIONA (3 passos)
SOBRE A TRANSCRIÇÃO (o que é gravado, quem lê, quando o áudio é apagado)
DÚVIDAS (curtas)
rodapé: "Agendamento com especIAlista" (pequeno)
```

Ao tocar num horário, abre o painel do agendamento (no celular ocupa a tela; no tablet e PC, ao lado da agenda), em passos curtos:

1. **Resumo:** dia, hora, modalidade (pode trocar).
2. **Contato:** nome e WhatsApp.
3. **Transcrição:** texto curto do que é + "Concordo" / "Não concordo". As duas opções seguem adiante.
4. **Formulário:** as três opções, WhatsApp destacado como recomendado, "na página" em segundo, "na consulta" menor, em último. Ao escolher "na consulta", aparece um pedido curto para reconsiderar (com a razão: a consulta rende mais), e o paciente pode manter a escolha.
5. **Pedido enviado:** "o consultório confirma o horário pelo WhatsApp". Se escolheu "na página", segue direto para o formulário.

**Formulário na página** (duas partes, salvar e continuar não entra nesta entrega):
- Dados pessoais: nome completo, data de nascimento, sexo, WhatsApp, e-mail (opcional), cidade/UF.
- Pré-consulta (opcional, dermatologia): o que trouxe à consulta, há quanto tempo, medicamentos e cremes em uso, alergias a medicamentos, foto da lesão (opcional).

## Decisões tomadas pelo construtor (o autor pode corrigir)

- **Nome e WhatsApp são sempre obrigatórios para marcar**, mesmo quem escolhe preencher na consulta: sem eles o consultório não consegue lembrar, confirmar nem remarcar (item 6).
- **Pedido aguarda confirmação do consultório**, como está no mapa aprovado (PC-09 + MD-06, decisão 3). O horário escolhido fica como pedido até o consultório confirmar.
- Modalidade escolhida **acima** da agenda, porque presencial e online podem ter horários diferentes.
- Sem CPF nesta versão (não é usado ainda; LGPD). Entra quando o prontuário precisar.
- Sem a moldura do especIAlista (topo com "Ver planos"): a página é do médico. A marca aparece só no rodapé, pequena.
- Cor: `--esp` = cor da dermatologia (`#A85A2E`, de `especialidades.ts`) para tudo que é destaque; papel, tipografia e cantos retos iguais aos da landing (tokens de `src/index.css`).
- Datas e horários de exemplo gerados a partir de hoje, para a agenda nunca aparecer vencida.

## Pendências fora do código

- **Publicidade médica:** por decisão do autor (15/11/2026), as resoluções do CFM sobre publicidade não orientam esta página: mudam demais, parte delas foi judicializada, e o produto não vai proibir o médico sem RQE de usar a página da especialidade.
- Texto definitivo sobre a transcrição e sobre o tratamento de dados (junto com os termos e a política de privacidade, LP-08).
- Regras da rotina do consultório (quantos lembretes, antecedência, prazo para remarcar): propostas quando chegarmos ao item 6.

## O que fica com o construtor

- Organização dos componentes e nomes dos arquivos dentro de `frontend/src/`.
- Textos de interface, curtos, no tom da landing, para o autor revisar na página.
- Testes: as regras do agendamento (campos obrigatórios, WhatsApp válido, data de nascimento válida, escolha do formulário) em funções puras com testes, como em `src/cadastro/`.
- Conferência visual em celular (360 e 390 px), tablet (em pé e deitado) e PC, com capturas.
