# ADR-004 — Auditoria append-only na mesma transação da mudança

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

Uma OS passa por mãos diferentes (atendente, técnico, cliente via link público) e por estados com consequência financeira (aprovação de orçamento, entrega, garantia). Disputas do tipo "quem cancelou?", "quando o cliente aprovou?" exigem uma trilha confiável. Logs de aplicação não servem: rotacionam, vivem fora do banco e não participam de transação.

## Decisão

1. **Tabela `OrderEvent` append-only**: nenhum caminho de código faz `update` ou `delete` nela — não existe service/repository com esses métodos, e a revisão de PR bloqueia qualquer um que apareça.
2. **Evento gravado na MESMA `$transaction` da mudança que o gerou (RN-09).** Se a gravação do evento falha, a transição inteira falha. Não existe estado sem evento correspondente.
3. Cada evento carrega: `actorType` (USER | CUSTOMER | SYSTEM), `actorId` quando houver, `type` (`ORDER_CREATED`, `STATUS_CHANGED`, `TECHNICIAN_ASSIGNED`...), `fromStatus`/`toStatus` em transições e `metadata` JSON para contexto (motivo de cancelamento, método de aprovação etc.).
4. A timeline da OS (`GET /orders/:id/events`) é a leitura direta dessa tabela em ordem cronológica — índice `(serviceOrderId, createdAt)`.

## Consequências

- A linha do tempo exibida ao usuário é, por construção, a verdade do banco — não uma reconstrução.
- Custo: uma linha extra por mudança de estado; volume baixo (dezenas de eventos por OS) e a tabela nunca é varrida sem o índice.
- Imutabilidade é por disciplina de código (não há trigger de banco bloqueando UPDATE); o risco é aceito e mitigado pela ausência de qualquer método de escrita além de `create` e pela revisão.
- Alternativas rejeitadas: log estruturado fora do banco (não transacional, não consultável com os dados), event sourcing completo (complexidade desproporcional — o estado atual na linha da OS continua sendo a fonte para queries).
