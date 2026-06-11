# SPEC 004 — Regras de Negócio e Máquina de Estados

> Cada RN vira pelo menos um teste unitário cujo nome contém o código (ex.: `"RN-07: warranty reopen blocks labor recharge"`). `docs/business-rules.md` explica cada uma com exemplo.

## Máquina de estados da OS

```
RECEIVED → IN_DIAGNOSIS → QUOTE_SENT → APPROVED → IN_REPAIR → READY → DELIVERED
                              ↓ ↑(nova versão de quote)
                           REJECTED ──→ IN_REPAIR? NÃO. REJECTED permite: nova QUOTE_SENT ou CANCELED
Qualquer estado exceto DELIVERED → CANCELED (terminal, exige motivo)
DELIVERED é terminal (garantia gera NOVA OS vinculada)
```

Ações (API usa ações, não status): `START_DIAGNOSIS`, `SEND_QUOTE`, `APPROVE_QUOTE`, `REJECT_QUOTE`, `START_REPAIR`, `MARK_READY`, `DELIVER`, `CANCEL`, `REOPEN_WARRANTY`.

Implementação: função pura em `packages/shared/src/order-state-machine.ts` — mapa `{ status: { action: nextStatus } }` + validadores de pré-condição por ação. API e web consomem a MESMA função (web usa para decidir quais botões renderizar).

## Regras de transição e domínio

- **RN-01** Transição fora do mapa → `InvalidTransitionError` (422). Teste cobre TODAS as combinações inválidas (gerado por produto cartesiano status × ação).
- **RN-02** `START_DIAGNOSIS` exige técnico atribuído à OS.
- **RN-03** `SEND_QUOTE` exige `technicalDiagnosis` preenchido (≥ 20 chars) E quote DRAFT com ≥ 1 item e total > 0. Ao executar: quote → SENT, gera `publicToken` com `tokenExpiresAt = now + 7 dias`.
- **RN-04** `APPROVE_QUOTE`/`REJECT_QUOTE` ocorrem por: (a) cliente via token público (actor CUSTOMER) ou (b) ADMIN manualmente (actor USER, `metadata.method = "in_person"`). Rejeição exige motivo (≥ 5 chars).
- **RN-05** Quote SENT com `tokenExpiresAt` vencido → tratada como EXPIRED (avaliação lazy ao acessar + varredura no boot do dia via cron simples). OS permanece QUOTE_SENT; permitido criar versão N+1 (novo token). Token expirado na rota pública → 410 Gone com mensagem amigável.
- **RN-06** `DELIVER` (a partir de READY): grava `deliveredAt = now` e `warrantyUntil = deliveredAt + 90 dias`.
- **RN-07** `REOPEN_WARRANTY`: só se `now <= warrantyUntil` da OS original (senão 422 com mensagem citando a data). Cria NOVA OS: `warrantyParentId` = original, mesma filial/cliente/equipamento, prioridade mínima HIGH, status RECEIVED. A tela exibe os itens da quote original como referência; **mão de obra dos mesmos serviços não é recobrável** — quote de OS de garantia nasce com itens LABOR zerados referenciando os originais.
- **RN-08** `CANCEL`: exige motivo ≥ 10 chars; estado terminal; proibido a partir de DELIVERED.
- **RN-09** Toda transição grava `OrderEvent` **na mesma transação** da mudança (Prisma `$transaction`). Falhou o evento, falhou a transição.
- **RN-10** Código da OS: `OS-{ANO}-{NNNN}` sequencial por **tenant+ano**, via `OrderCodeSequence` com `UPDATE ... RETURNING` atômico dentro da transação de criação. Teste de concorrência: 20 criações paralelas → zero duplicidade.

## Regras multi-tenant e filial

- **RN-11** Todo registro de domínio pertence a um tenant; isolamento imposto pela Prisma Extension. Teste de isolamento obrigatório para cada endpoint (spec 008 define o helper).
- **RN-12** Usuário com `branchId` definido: enxerga e opera apenas OS da sua filial; dashboards restritos a ela. `branchId = null` → todas as filiais do tenant.
- **RN-13** (= RN-10 escopo) sequência de código é por tenant — tenants diferentes podem ter `OS-2026-0001` cada.
- **RN-14** Dashboard: agregação padrão = tenant inteiro; query param `branchId` filtra. ATTENDANT/TECHNICIAN com filial fixa não podem consultar agregado de outra filial (403).
- **RN-15** Mapa público (`publicMapToken`): expõe SOMENTE filiais ativas com lat/lng — nome, endereço, telefone, cidade. Nunca dados de OS, clientes ou usuários. Token rotacionável via script.

## Matriz de permissões (testada como tabela)

| Ação | ADMIN | TECHNICIAN | ATTENDANT |
|---|---|---|---|
| Criar OS / cliente / equipamento | ✓ | — | ✓ |
| Atribuir técnico | ✓ | — | ✓ |
| START_DIAGNOSIS / quote / START_REPAIR / MARK_READY | ✓ | ✓ (apenas OS atribuídas a si) | — |
| APPROVE/REJECT presencial | ✓ | — | — |
| DELIVER | ✓ | — | ✓ |
| CANCEL | ✓ | — | — |
| REOPEN_WARRANTY | ✓ | — | ✓ |
| Gerenciar usuários do tenant | ✓ | — | — |
| Dashboard agregado do tenant | ✓ | ✗ (apenas suas OS) | ✓ (da sua filial, ou todas se branchId null) |

## Definition of Done (verificado nas Fases 3 e 4)

- [x] Máquina de estados pura no shared com 100% de cobertura de transições (válidas e inválidas). — Fase 3: `order-state-machine.spec.ts` (produto cartesiano completo)
- [x] RN-01..RN-15 com testes nomeados pelo código da regra. — Fases 3-4 (RN-01..13) e 7 (RN-14/15) ✓
- [x] Matriz de permissões testada de forma tabular (test.each). — Fase 3: `permissions-matrix.integration.spec.ts` (31 linhas)
- [x] `docs/business-rules.md` escrito com diagrama Mermaid da máquina de estados. — Fase 3
- [x] ADR-004 (auditoria append-only), ADR-005 (aprovação pública por token), ADR-006 (endpoint único de transições) escritos. — Fases 3 (004, 006) e 4 (005)
