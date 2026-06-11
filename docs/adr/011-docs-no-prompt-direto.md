# ADR-011 — Documentação inteira no system prompt (sem RAG, por enquanto)

- **Status:** aceita
- **Data:** 2026-06-11

## Contexto

A Fia (spec 010) responde dúvidas de uso citando a documentação do produto e
consulta dados do tenant via tools. Para "conhecer" os docs há duas rotas:
recuperação seletiva (RAG — embeddings, índice, busca por similaridade) ou
colocar o conteúdo inteiro no system prompt. O contexto consolidado
(`context.generated.md` = guia de uso + regras de negócio + fluxos) tem ~25 KB
(~7k tokens) — confortável na janela do modelo e barato com prompt caching.

## Decisão

1. **Documentação inteira no system prompt**, lida de
   `apps/api/src/modules/assistant/context.generated.md` no boot do módulo.
2. O arquivo é **gerado e commitado** (`pnpm assistant:context`); o CI falha
   se estiver desatualizado em relação aos docs — a Fia nunca responde por
   documentação velha.
3. Dados dinâmicos NUNCA vão pro prompt: vêm das **tools somente leitura**,
   que executam os services existentes e herdam escopo de tenant e RBAC do
   usuário logado.
4. RAG fica registrado no backlog como evolução natural quando os docs
   crescerem (gatilho sugerido: contexto > 50 KB ou latência de primeira
   resposta acima de 3s).

## Consequências

- Zero infraestrutura extra (sem banco vetorial, sem pipeline de embeddings) e
  respostas que enxergam o documento COMPLETO — sem o risco clássico de RAG de
  recuperar o trecho errado.
- Custo por conversa maior que com recuperação seletiva; mitigado pelo prompt
  caching do provedor e pelo limite de 10 mensagens por conversa.
- O acoplamento docs→prompt é explícito e verificado por CI, não implícito.
