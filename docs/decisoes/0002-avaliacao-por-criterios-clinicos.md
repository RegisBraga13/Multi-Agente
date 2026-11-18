# 0002 — Casos avaliados por critérios clínicos; emergência por ação fixa

**Data:** 18/11/2026 · **Situação:** aceita (revisão do autor dos 20 casos)

**Contexto.** A versão 1 dos casos aprovava por palavra literal ("deve incluir: anti-histamínico"; "não pode
aparecer: isotretinoína"). O autor mostrou que isso reprova uma advertência correta ("isotretinoína
contraindicada") e aprova uma conduta insegura (anti-histamínico sem avaliar a via aérea).

**Decisão.**
1. **Formato v2:** história com fatos, negativas e desconhecidos (negado ≠ não perguntado ≠ não examinado);
   diagnóstico com certeza (suspeita/hipótese/clínico), alternativas aceitas e "rastrear e registrar";
   conduta com urgência (rotina/prioritária/imediata), obrigatórios e proibidos em frases clínicas e
   remédios proibidos na receita.
2. **Avaliação no marco 3 = IA avaliadora + regras.** Uma IA avaliadora confere cada critério clínico e
   devolve saída tipada (aprovado/reprovado + trecho que justifica). O que é estruturado (remédio na receita,
   CID, sinal pego, urgência) é conferido por regra fixa. O autor confere amostra e as dúvidas da avaliadora.
3. **Sinais de alerta com tipo, ação e prazo.** A ação dos sinais de urgência imediata é a resposta de
   emergência fixa do pacote da especialidade: entra na conduta por regra, sem depender da IA, mesmo sem
   protocolo na tabela (ex. Stevens-Johnson).

**Alternativas recusadas.** Palavra-chave (erra nos dois sentidos); só leitura humana (toda mudança de
prompt exigiria reler todos os casos); IA escrever a conduta de emergência (erro chegaria à tela).

**Consequências.** O marco 3 precisa da avaliadora (com seus próprios casos de calibração) e da injeção da
ação fixa na conduta. O validador já exige conduta imediata quando um sinal de urgência imediata é esperado.
