# Fluxos do OFIX

Diagramas de referência dos três fluxos centrais. A máquina de estados é uma
função pura compartilhada entre API e web
([`order-state-machine.ts`](../packages/shared/src/order-state-machine.ts));
as regras citadas (RN-xx) estão detalhadas em
[business-rules.md](business-rules.md).

## Máquina de estados da OS

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: criação da OS
    RECEIVED --> IN_DIAGNOSIS: START_DIAGNOSIS (RN-02)
    IN_DIAGNOSIS --> QUOTE_SENT: SEND_QUOTE (RN-03)
    QUOTE_SENT --> QUOTE_SENT: SEND_QUOTE (nova versão, RN-05)
    QUOTE_SENT --> APPROVED: APPROVE_QUOTE (RN-04)
    QUOTE_SENT --> REJECTED: REJECT_QUOTE (RN-04)
    REJECTED --> QUOTE_SENT: SEND_QUOTE (nova versão)
    APPROVED --> IN_REPAIR: START_REPAIR
    IN_REPAIR --> READY: MARK_READY
    READY --> DELIVERED: DELIVER (RN-06)
    RECEIVED --> CANCELED: CANCEL (RN-08)
    IN_DIAGNOSIS --> CANCELED: CANCEL
    QUOTE_SENT --> CANCELED: CANCEL
    APPROVED --> CANCELED: CANCEL
    REJECTED --> CANCELED: CANCEL
    IN_REPAIR --> CANCELED: CANCEL
    READY --> CANCELED: CANCEL
    DELIVERED --> [*]: terminal (garantia cria NOVA OS)
    CANCELED --> [*]: terminal
```

## Sequência da aprovação pública (ADR-005)

```mermaid
sequenceDiagram
    actor T as Técnico/Admin
    participant API as API OFIX
    actor C as Cliente (celular)
    participant W as Página pública /q/{token}

    T->>API: POST /quotes/{id}/send (SEND_QUOTE)
    API->>API: quote -> SENT, token novo, validade 7 dias (RN-03)
    T->>C: envia o link por WhatsApp/SMS
    C->>W: abre /q/{token} (sem login)
    W->>API: GET /public/quotes/{token}
    API-->>W: empresa, OS resumida, itens, total, validade
    C->>W: toca em "Aprovar orçamento"
    W->>API: POST /public/quotes/{token}/approve
    API->>API: máquina valida (RN-01) + evento actorType=CUSTOMER (RN-09)
    API-->>W: OS -> APPROVED
    Note over API: token expirado responde 410 (RN-05)
```

## Fluxo de garantia (RN-06/RN-07)

```mermaid
flowchart TD
    A[OS entregue\nDELIVER] -->|grava deliveredAt e\nwarrantyUntil = +90 dias| B[Garantia ativa]
    B -->|cliente volta com defeito\naté warrantyUntil| C{Reabrir em garantia}
    C -->|dentro do prazo| D[NOVA OS filha\nstatus RECEIVED\nprioridade mínima HIGH\nwarrantyParentId aponta para a original]
    C -->|prazo vencido| E[422 com a data limite\nabre-se OS normal, cobrável]
    D --> F[Orçamento da filha nasce com a\nmão de obra original ZERADA\npeças podem ser cobradas]
    B -->|90 dias se passam| G[Garantia encerra\nOS original permanece DELIVERED]
```
