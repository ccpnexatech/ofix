# ADR-006 — Endpoint único de transições de status

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

A OS muda de status por nove ações de negócio (diagnosticar, enviar orçamento, aprovar, entregar, cancelar...). Modelar cada ação como endpoint próprio (`POST /orders/:id/deliver`, `/cancel`, ...) espalha a lógica de transição por N handlers; aceitar `PATCH /orders/:id { status }` deixa o cliente escolher o status destino e empurra a validação para baixo.

## Decisão

**Toda mudança de status passa por `POST /orders/:id/transitions { action, payload? }`.**

1. O corpo carrega a **ação** (`START_DIAGNOSIS`, `SEND_QUOTE`, `APPROVE_QUOTE`, `REJECT_QUOTE`, `START_REPAIR`, `MARK_READY`, `DELIVER`, `CANCEL`), nunca o status destino — quem decide o próximo status é a máquina de estados pura de `packages/shared` (`nextStatus(from, action)`), a mesma função que o web usa para decidir quais botões renderizar.
2. O handler único: valida a ação com a máquina (RN-01), aplica as pré-condições da ação (RN-02, RN-03, RN-04, RN-06, RN-08), executa efeitos colaterais (datas de entrega/garantia, status da quote) e grava o `OrderEvent` — tudo numa única `$transaction` (RN-09, ADR-004).
3. Exceções deliberadas: `POST /orders/:id/assign` (não muda status) e `POST /orders/:id/warranty-reopen` (RN-07 — não transiciona a OS original, cria uma nova OS filha; DELIVERED permanece terminal).

## Consequências

- Um único lugar para ler/auditar/testar a lógica de transição; a matriz de permissões por ação é aplicada num ponto só.
- Front e back não podem divergir sobre transições válidas: ambos importam o mesmo mapa.
- Custo: payloads polimórficos por ação (validados por schema Zod discriminado por `action`); o handler é maior que um endpoint dedicado — mitigado por um validador de pré-condição por ação, pequeno e testável.
- Alternativas rejeitadas: endpoint por ação (lógica espalhada, N pontos de RBAC), `PATCH { status }` (cliente escolhe o destino; convite a pular validação).
