# 0001 — Casos de teste em YAML, validados por Pydantic

**Data:** 18/11/2026 · **Situação:** aceita

**Contexto.** O desenho do servidor (§7.8) exige 20–30 consultas fictícias de Dermatologia com a resposta
esperada por etapa, revisadas pelo autor (médico, não programador), para medir se cada motor de IA funciona.
Toda mudança de prompt ou modelo roda contra elas.

**Decisão.** Um arquivo YAML por caso em `backend/casos_de_teste/<especialidade>/`, validado por modelos
Pydantic com `extra="forbid"` (campo com nome errado é erro, não é ignorado). O autor não lê YAML: um comando
gera uma folha HTML (`python -m casos_de_teste folha`) com cada caso em linguagem de médico. Casos nascem
`pendente`; só o autor aprova.

**Alternativas recusadas.** JSON (difícil de ler e revisar à mão); casos no banco (precisam viajar no git,
junto com prompts e esquemas, e ser comparáveis versão a versão).

**Consequências.** O formato é a régua dos motores: no marco 3, um script roda os motores sobre estes arquivos
e mede diagnóstico esperado entre os 3, sinais de alerta pegos, conduta vinda da tabela, saídas inválidas,
custo e tempo. Mudar o formato exige subir `versao_formato`.
