# Regras do autor — especIAlista

Lista única das regras que o autor (médico) decidiu. **Ler a parte da tela antes de mexer nela.** O que não estiver aqui vira pergunta ao autor, nunca suposição.
Fonte: Constituição (`docs/constituicao.md`), desenhos em `docs/superpowers/specs/` e as conversas até 19/11/2026.

---

## 1. Como trabalhar com o autor

1. **Uma pergunta por vez**, em linguagem de consultório, com exemplo de paciente, que se responda com sim/não. Sem nomes técnicos.
2. **Não adivinhar.** Fazer só o que ele pediu; o resto, perguntar antes. Decisão já aprovada não muda sem autorização.
3. **Esperar ele terminar de explicar** (às vezes manda a ideia em várias mensagens). Repetir o entendimento antes de mexer.
4. **Uma página por vez:** a próxima só depois de ele ver a atual funcionando e aprovar.
5. **Mostrar, não descrever:** mudança visível = print, com legenda curta.
6. **Medir antes de dizer "pronto":** tela dele ≈ 1280 × 690 (também 1366 × 768, iPad 1180 × 820 e 820 × 1180).
7. **Nada de testes de desempenho da IA.** Prioridade nº 1: o app funcionando como ele planejou, com páginas bonitas.
8. **Juntar na versão principal, enviar para o GitHub ou gastar com IA paga: só com o ok dele.** Commit e push só quando ele pedir.

## 2. Princípios (valem para tudo)

1. **O prontuário é o registro mãe.** Tudo na consulta existe para produzir o prontuário; terminada a consulta, as páginas somem e só o prontuário fica. Nada colhido pode se perder.
2. **Constituição — a consulta em 4 fases, nesta ordem:** anamnese → exame físico e complementar → (história clínica) → diagnósticos → conduta. Cada fase só usa o que a anterior salvou.
3. **O médico revisa e salva cada fase.** Salvar libera a próxima; nada fica travado. Mudou uma fase salva → as seguintes ficam "desatualizadas". Só é definitivo ao finalizar a consulta (depois, só adendo datado).
4. **O médico decide, assina e assume.** Tudo o que vem da IA é lembrete. O app é auxílio, não robô: a IA traz o padrão, o médico completa. Não perseguir detalhe nem protocolo para toda doença.
5. **A origem da sugestão** ("protocolo X", "sugestão da IA") aparece só na tela, para o médico. **Nunca no prontuário** nem nos documentos.
6. **Fluxo e estilo são intocáveis:** a estética ousada é ponto forte. A escrita ao vivo da IA tem o ritmo de 3 letras a cada 33 ms.
7. **Mesmas regras para todas as especialidades;** cada uma muda só o que é dela (perguntas, exame físico, protocolos).

## 3. Visual (todas as telas)

1. **Cabe numa tela, sem vazar** (≈ 690 px). Sem rolagem dentro de cartões; sem espaço vazio forçado. Exceção: o **prontuário** é página inteira e rola.
2. **Textos no menor formato que caiba numa linha.** Ações repetidas viram ícones, com legenda no rodapé do cartão.
3. **Só cores da paleta oficial.** Blocos chapados (petróleo, tons da especialidade) e um cartão escuro.
4. **Tarja de alergia no topo da consulta:** bloco vermelho cheio, texto branco. Sinais de alerta na anamnese: cartão branco, letras vermelhas.
5. **Topo do módulo:** só o nome do módulo (ex.: dermatologIA); a marca especIAlista vai no rodapé. Nada sem função.
6. **Formulários por blocos:** um bloco por tela, "Parte X de N", etiqueta OBRIGATÓRIO/OPCIONAL, Voltar · Pular · Próximo numa linha, tela final "Revise e envie".
7. **Campos com a largura do conteúdo.** Campos clínicos sem corretor do navegador; Enter passa para o campo de baixo.

## 4. Página do médico (o paciente marca a consulta)

1. **Início com três cartões:** Como funciona · Dúvidas · Agendar consulta (este na cor da especialidade). Cada um abre a sua página; o nome do médico volta ao início.
2. **Agendar:** presencial/online, dia, horário, depois 5 passos: horário · contatos (nome + WhatsApp, sempre obrigatórios) · particular ou convênio · aceite da transcrição · como prefere o formulário.
3. **Três jeitos de preencher o formulário:** WhatsApp (recomendado), na página agora, ou na consulta (pede para reconsiderar, mas aceita).
4. **Textos para o paciente: sempre "seu médico"**, sem gênero nem especialidade. Online sempre aparece como opção.
5. **Convênios:** o próprio médico cadastra os que atende.
6. **Sem regras de publicidade do CFM;** RQE é opcional.

## 5. Formulário do paciente

1. **Só a Identificação é obrigatória** e fica como está. **Alergias fica em Saúde geral, opcional** (com o botão "Não tenho alergia"); na consulta, sempre aparece em Perguntas. O resto é opcional e pode ser pulado.
2. **Sexo M / F / I** (Masculino, Feminino, Intersexo) e **Nome social** (opcional).
3. **Fotos e documentos:** fotos da pele e também receitas anteriores, exames e laudos (foto, print ou PDF, até 10).
4. **Ao tocar em Enviar, vai direto para o sistema** e aparece "Formulário enviado". Não passa mais pelo WhatsApp.
5. **Quem escolheu "preencher na consulta"** recebe aviso no dia, antes da consulta. A consulta só começa com a Identificação preenchida (a página inicial do formulário continua obrigatória). Se o paciente chegar sem ela, **o médico (ou a secretária) preenche no computador**, ao tocar em Abrir consulta; o resto do formulário aparece em Perguntas. **Aviso no dia:** no cartão da agenda, o botão "Lembrar formulário" abre o WhatsApp com a mensagem e o link escritos; o médico ou a secretária toca em enviar. *(feito)*
6. **Gravidez e amamentação:** duas perguntas Sim/Não ("Está grávida?", "Está amamentando?"), só para sexo F. O médico tem bom senso para saber quando e a quem perguntar.
7. **Saúde geral, nesta ordem:** Doenças crônicas · Medicamentos · Alergias · Grávida · Amamentando.

## 6. Agenda

1. **O pedido da página aparece na agenda do médico como "Pedido novo",** e o horário some para os outros pacientes.
2. **Mensagens ao paciente = mensagem pronta:** o app abre o WhatsApp com o texto escrito e a pessoa toca em enviar. Sem WhatsApp oficial por enquanto.
   O link do formulário chega **azul, de um toque**: o paciente toca, a página abre e ele envia ali mesmo (experiência confortável). Por enquanto via endereço de internet temporário, que só deixa passar a página de agendar e o formulário; a agenda e a consulta ficam só no computador.
3. **A ficha (queixa, alergia, medicamentos...) só aparece para o médico** se o paciente preencheu o formulário, ou no retorno (pois já existe informação). Sem formulário e sem retorno, o cartão mostra só nome, horário e situação. *(Os pacientes de exemplo da agenda são fictícios e não seguem esta regra; ficam só como demonstração. Os agendamentos reais seguem.)*
4. **No cartão do paciente:** Confirmar, Mandar formulário (mensagem com o link), Abrir consulta. **Confirmar:** a etiqueta "Pedido novo" some e o WhatsApp abre com "Olá, Maria! Sua consulta com Dra. Ana Souza está confirmada: sexta-feira, 20 de novembro, às 10h (presencial)." **Avisar** (quando o médico não pode atender): pede confirmação ("Sim, avisar"); o horário é cancelado, sai da agenda, volta a ficar livre na página, e o WhatsApp abre com "Olá, Maria! Infelizmente não será possível atender sexta-feira, 20 de novembro, às 10h. Escolha outro horário: (link da página de agendar)". *(feitos)*

## 7. Anamnese

1. **Três modos: Formulário · Gravar · Escrever.** O médico troca quando quiser, sem perder nada.
2. **Formulário:** os mesmos campos que o paciente viu, já com as respostas. Em cada parte, "Conferido ✓"; na última, "Salvar formulário". O formulário vira texto no começo da caixa, e gravação e escrita entram embaixo. Depois de salvo, só para consulta; correções na caixa.
3. **O que o paciente não respondeu vira lembrete em Perguntas. Alergias aparece sempre**, mesmo respondida. Ficam na lista; se o médico perguntar de novo algo já dito, a IA tira a repetição.
4. **Perguntas da IA:** clicar risca e abre Sim/Não (duas caixas, como está); a resposta vai para a história.
   **Lembretes do formulário:** clicar risca e abre as opções da própria pergunta (ex.: "Está amamentando?" → Sim / Não; "Usa protetor solar?" → Todo dia / Às vezes…) ou, se for pergunta aberta, uma linha para escrever ("Produtos que usa" → "sabonete e hidratante"). A resposta vai para a história, na seção certa. Riscada sem resposta não entra.
5. **Sinais de alerta:** o médico pergunta e marca V ou F. V vai para a história (não para a anamnese).
6. **Gravar só com o aceite da transcrição.** O que vale é o que é salvo: o médico sempre lê a anamnese antes de salvar.

## 8. Exame físico e complementar

1. **Fotos numeradas + campos da especialidade.** O rascunho da IA aparece tracejado; o médico edita.
2. **"Inserir prints, arquivos, laudos":** é onde ficam os exames, laudos e receitas que o paciente trouxe ou mandou.
3. **O que importa dentro dos documentos** (remédios da receita, resultado do laudo) vai como lembrete da IA para o lugar certo da história, com a página de onde saiu. O médico confirma.
4. **Valor extraído de laudo:** presente / "conferir no laudo" (inferido) / "não encontrado no laudo". Nunca inventar.

## 9. História clínica

1. **Só existe como fonte do diagnóstico e do tratamento** e depois some. Não leva nada que não ajude nisso: **sem nome do paciente, sem consulta/retorno, sem presencial/online.** Identificação = "Paciente, 47 anos".
2. **Só nasce da anamnese e do exame salvos** e aparece escrita ao vivo, seção por seção.
3. **Linguagem de prontuário, corrida;** cada informação na seção certa. Exemplo aprovado: *"Paciente, 47 anos, casada, educadora física, refere manchas no rosto há 2 anos, sem mudança de cor, tamanho ou formato, sem prurido, dor ou sangramento. Trabalha exposta ao sol; usa protetor solar às vezes; nega bronzeamento artificial."*
4. **Não perguntado nunca vira "nega".** Não examinado fica desconhecido.
5. **Anamnese ou exame salvos de novo:** a IA mexe só no que mudou. Seção editada pelo médico recebe sugestão ao lado (Aceitar / Manter o meu), nunca é reescrita.

## 10. Diagnósticos diferenciais

1. **Só depois de salvar a história, e só com os dados dela.** Até 3 hipóteses da IA, com CID-10 e %, da mais à menos provável.
2. **Toque confirma, × descarta.** Cada hipótese mostra os pontos a favor e contra, com o trecho da história de onde saíram.
3. **"Não pode perder":** cartão escuro, só quando existe.
4. **Certeza do diagnóstico:** suspeita, hipótese ou clínico. Câncer sem biópsia é suspeita.

## 11. Conduta e tratamento

1. **Só dos diagnósticos salvos.** Ordem das fontes: tabela de protocolos (sem IA) → diretrizes (RAG) → fontes externas. A origem aparece só na tela.
2. **Objetiva, como prescrição:** grupos (Cuidados básicos, Tópico, Sistêmico, Orientações), opções, nada marcado. O médico escolhe. **Sem texto livre da IA.**
3. **Sistêmico e Encaminhamento são de múltipla escolha;** um não exclui outro. Sem "Não indicar": não marcar já significa isso.
4. **Gravidez, suspeita, tentando engravidar ou amamentando** escondem as opções incompatíveis. "Planeja engravidar no futuro" não esconde nada.
5. **Sinal de urgência imediata** traz a ação de emergência fixa do pacote da especialidade (não depende da IA).
6. **Botão de fonte (no DD e na Conduta):** IA · RAG (diretrizes) · Fontes externas. O médico marca uma ou mais; o app consulta cada uma, compara e mostra o melhor resultado; o médico confirma ou descarta. A fonte só na tela. *(depende de ligar a IA real; cada fonte = consulta paga → ok do autor)*

## 12. Receita e anexos

1. **Montados só da conduta salva:** receita, pedido de exames, encaminhamento, orientações; atestado e laudo opcionais.
2. **Receita:** `Limeciclina 300mg (56 CAP)`, `Adapaleno + peróxido de benzoíla 0,1% + 2,5% GEL (01 bisn. 30g)`. Usar a sigla oficial quando existe; quantidade por extenso só nos controlados; via abreviada na posologia ("Tomar 1 CAP VO").
3. **Assinatura digital:** simulação até o autor mandar as regras do CFM (antes de publicar).
4. **O nome do paciente** entra só nos documentos ao paciente e no prontuário. Nunca vai para a IA.

## 13. Prontuário

1. **Finalizar consulta:** o prontuário aparece escrito ao vivo; o médico edita (voz ou texto) e salva. Depois disso, só leitura e adendos datados.
2. **Pode ser aberto a qualquer momento da consulta,** numa janela separada, **a partir do retorno** (na primeira consulta ainda não existe).
3. **Entradas** "Consulta 1", "Consulta 1 — Retorno", "Consulta 2"…, a mais recente no topo. Cabeçalho: Data | Hora | Presencial/Online; Paciente (nome completo) | Idade. **O nome continua no prontuário;** o identificador (id) é só interno, para o banco de dados.
4. **Linhas:** QP, HDA, AP, HP, HF, Ex. físico, Exames, HD; depois CONDUTA (tratamento, Solicitado, Encaminhado para, Orientações, Retorno, Atestado/Laudo). Campo não colhido some.
5. **HD:** sempre 3. Os clicados pelo médico = "Assinalado"; completam até 3 os da IA = "Sugerido". Descartado não entra.
6. **Gravado como dados organizados** (diagnósticos, remédios, exames, fotos). Fotos em miniatura.
7. **O app não guarda por 20 anos:** o médico recebe a cópia e guarda.

## 14. Retorno

1. **Evolução** (melhora, piora, uso do remédio, efeitos; fotos e exames comparados) → **História da evolução** (com gráfico comparativo) → diagnósticos, conduta, receita e anexos (podem mudar) → prontuário atualizado. *(Etapa 1 feita: tela **Evolução** — Gravar/Escrever, sem Formulário; Perguntas do retorno Sim/Não: Melhorou? · Piorou algum ponto? · Usa o remédio direitinho? · Teve efeito colateral?; à direita **Fotos e exames**, com as fotos da consulta anterior ao lado. Faltam: História da evolução, diagnósticos/conduta/anexos do retorno, prontuário atualizado.)*
2. **No retorno, a IA olha o prontuário,** principalmente o que não muda (alergias, comorbidades, efeitos colaterais anteriores).
3. **Explorar o que surge:** quando o paciente relata algo novo (efeito colateral, novo sinal ou sintoma), a tela abre perguntas para aprofundar, ou o médico acrescenta gravando ou escrevendo. *(feito: pergunta fixa "Surgiu algum sintoma ou sinal novo?"; Sim em efeito colateral ou sinal novo abre perguntas de aprofundamento — as de resposta aberta têm uma linha para escrever)*
4. **História da evolução, abertura:** sem identificação (nada de "Paciente, 52 anos, casado, comerciante": já está no prontuário e sabemos de quem se trata). Começa com **"Paciente relata melhora"** (ou "informa" / "piora" / "pouca alteração")... Sem redundâncias. *(Etapa 2 feita, sem o gráfico: três blocos — Evolução, Exame, Exames. Faltam: gráfico comparativo, diagnósticos/conduta/anexos do retorno, prontuário atualizado.)* **Cartão Retorno** da página inicial abre a Evolução (retorno aberto na ficha; senão o próximo; senão o do dia).

## 15. IA e privacidade

1. **À IA vai só o dado clínico, desidentificado:** sem nome, CPF, telefone, e-mail ou endereço. O nome bloqueia o pedido só quando escrito com inicial maiúscula ("pele clara" passa).
2. **Toda saída da IA é conferida antes de usar.** Inválida é descartada, e o médico é avisado. Nada é executado sozinho.
3. **Datas que o médico lê:** dia/mês/ano.
4. **Código sem prender a fornecedor:** IA, transcrição, banco e arquivos atrás de interfaces trocáveis. O código e os dados são do autor.
