# SPEC 002 — Banco de Dados Multi-Tenant, Filiais e Scripts Operacionais

## Modelo de hierarquia

```
Tenant (empresa) ──< Branch (filial) ──< ServiceOrder
       │                                      │
       ├──< User (com escopo opcional de filial)
       ├──< Customer ──< Equipment
       └── publicMapToken (mapa compartilhável de filiais)
```

**Decisão (ADR-002):** multi-tenancy por **coluna discriminadora (`tenantId`) com escopo imposto em código**, não por schema/database separado. Justificativa: simplicidade operacional, custo zero de provisionamento, adequado ao porte. O isolamento é garantido por uma **Prisma Client Extension** que injeta `tenantId` em todo `where` de modelos tenant-scoped — nenhuma query de domínio roda sem tenant no contexto (erro `TenantIsolationError` se faltar). Teste automatizado de isolamento é obrigatório (spec 008).

**Sem painel administrativo de tenant/filial:** criação e manutenção de Tenant, Branch e primeiro usuário ADMIN são feitas pelos **scripts operacionais** (abaixo). Decisão consciente: evitar tela que será usada uma vez (registrar como ADR-007, citando o trade-off).

## Schema (Prisma 6 / PostgreSQL 16)

```prisma
model Tenant {
  id             String   @id @default(uuid())
  name           String
  slug           String   @unique            // usado em URLs e no mapa público
  document       String?                     // CNPJ
  publicMapToken String   @unique @default(uuid())
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  branches  Branch[]   users User[]   customers Customer[]
  orders    ServiceOrder[]
}

model Branch {
  id        String  @id @default(uuid())
  tenantId  String
  name      String                            // "Matriz", "Filial Aldeota"
  phone     String?
  address   String                            // endereço completo legível
  city      String   state String  zipCode String?
  latitude  Decimal? @db.Decimal(9,6)         // para o mapa
  longitude Decimal? @db.Decimal(9,6)
  isActive  Boolean @default(true)
  createdAt DateTime @default(now())
  tenant Tenant @relation(...)   users User[]   orders ServiceOrder[]
  @@unique([tenantId, name])
  @@index([tenantId])
}

model User {
  id           String   @id @default(uuid())
  tenantId     String
  branchId     String?            // null = acesso a TODAS as filiais do tenant
  name         String
  email        String
  passwordHash String             // Argon2id
  role         Role               // ADMIN | TECHNICIAN | ATTENDANT
  isActive     Boolean  @default(true)
  completedTours String[] @default([])   // ids de tours concluídos (spec 009)
  createdAt    DateTime @default(now())
  @@unique([tenantId, email])
  @@index([tenantId])
}

model Customer {
  id String @id @default(uuid())
  tenantId String
  name String   phone String   email String?   document String?
  address String?   notes String?
  createdAt DateTime @default(now())
  equipments Equipment[]   orders ServiceOrder[]
  @@index([tenantId, name])
}

model Equipment {
  id String @id @default(uuid())
  tenantId String   customerId String
  type String   brand String   model String
  serialNumber String?   notes String?
  @@index([tenantId])  @@index([customerId])
}

model ServiceOrder {
  id        String  @id @default(uuid())
  tenantId  String
  branchId  String                       // OS SEMPRE pertence a uma filial
  code      String                       // "OS-2026-0001" — sequencial por tenant+ano
  customerId String   equipmentId String
  status    OrderStatus @default(RECEIVED)
  priority  Priority    @default(NORMAL)
  reportedIssue      String
  technicalDiagnosis String?
  assignedTechnicianId String?
  warrantyParentId     String?           // self-relation (OS de garantia)
  promisedAt  DateTime?   deliveredAt DateTime?   warrantyUntil DateTime?
  canceledReason String?
  createdById String
  createdAt   DateTime @default(now())   updatedAt DateTime @updatedAt
  quotes Quote[]   events OrderEvent[]
  @@unique([tenantId, code])
  @@index([tenantId, status])  @@index([tenantId, branchId])
  @@index([customerId])  @@index([assignedTechnicianId])
}

model OrderCodeSequence {                // RN-13: sequência por tenant+ano sem race
  tenantId String   year Int   lastValue Int @default(0)
  @@id([tenantId, year])
}

model Quote {
  id String @id @default(uuid())
  tenantId String   serviceOrderId String
  version Int                            // 1, 2, 3... por OS
  status QuoteStatus @default(DRAFT)     // DRAFT | SENT | APPROVED | REJECTED | EXPIRED
  publicToken String @unique @default(uuid())
  tokenExpiresAt DateTime?
  approvedAt DateTime?   rejectedAt DateTime?   rejectionReason String?
  totalCents Int @default(0)             // recalculado a cada mudança de item, na transação
  createdAt DateTime @default(now())
  items QuoteItem[]
  @@unique([serviceOrderId, version])
  @@index([publicToken])
}

model QuoteItem {
  id String @id @default(uuid())
  quoteId String
  kind ItemKind                          // LABOR | PART
  description String
  quantity Int   unitPriceCents Int   subtotalCents Int
}

model OrderEvent {                       // auditoria append-only — NUNCA update/delete
  id String @id @default(uuid())
  tenantId String   serviceOrderId String
  actorType ActorType                    // USER | CUSTOMER | SYSTEM
  actorId String?
  type String                            // ORDER_CREATED, STATUS_CHANGED, QUOTE_SENT, QUOTE_APPROVED...
  fromStatus OrderStatus?   toStatus OrderStatus?
  metadata Json?
  createdAt DateTime @default(now())
  @@index([serviceOrderId, createdAt])
}

model RefreshToken {
  id String @id @default(uuid())
  userId String   tokenHash String
  expiresAt DateTime   revokedAt DateTime?
  @@index([userId])
}
```

Enums em `packages/shared` e espelhados no Prisma: `Role`, `OrderStatus` (RECEIVED, IN_DIAGNOSIS, QUOTE_SENT, APPROVED, REJECTED, IN_REPAIR, READY, DELIVERED, CANCELED), `Priority`, `QuoteStatus`, `ItemKind`, `ActorType`.

## Scripts operacionais (`scripts/` — expostos e documentados)

Todos em TypeScript, executados com `tsx`, interativos quando sem argumentos, e idempotentes quando possível. Documentação em `docs/scripts.md` com exemplo real de uso de cada um.

| Script | Função |
|---|---|
| `scripts/create-tenant.ts` | Cria tenant + filial Matriz + usuário ADMIN inicial. Imprime credenciais e token do mapa. |
| `scripts/create-branch.ts` | Adiciona filial a um tenant (com lat/lng opcional; se ausente, alerta que não aparecerá no mapa). |
| `scripts/create-user.ts` | Cria usuário (role + filial opcional) num tenant. |
| `scripts/rotate-map-token.ts` | Rotaciona o `publicMapToken` de um tenant (revoga link antigo do mapa). |
| `scripts/seed-demo.ts` | Seed completo de demonstração (ver spec 011). |
| `scripts/reset-db.ts` | Drop + migrate + seed (apenas dev; aborta se `NODE_ENV=production`). |

## Visualização do banco (obrigatório)

- `prisma-erd-generator` configurado: `pnpm db:erd` gera `docs/assets/erd.svg` automaticamente a partir do schema.
- `docs/database.md` contém: o ERD (svg + versão Mermaid no próprio md), **dicionário de dados** (tabela por tabela: campo, tipo, regra, exemplo), explicação de cada relacionamento em linguagem natural ("uma OS pertence a uma filial porque...") e a lista de índices com justificativa.
- `pnpm db:studio` documentado como forma de explorar dados localmente.

## Definition of Done (Fase 1)

- [ ] Schema completo migrado (`prisma migrate dev`) sem warnings.
- [ ] Prisma Client Extension de tenant implementada em `apps/api/src/infra/prisma` com teste provando que (a) query sem tenant no contexto lança erro e (b) tenant A não enxerga dados do tenant B.
- [ ] Os 6 scripts operacionais funcionando, com `--help` e documentados em `docs/scripts.md`.
- [ ] `pnpm db:erd` gerando `docs/assets/erd.svg`; `docs/database.md` completo (ERD + dicionário + relacionamentos + índices).
- [ ] Seed básico: 2 tenants ("TecNorte" com 2 filiais; "Eletrolar Recife" com 1), usuários por papel.
- [ ] ADR-002 (multi-tenant por coluna), ADR-003 (dinheiro em centavos), ADR-007 (gestão de tenant via scripts) escritos.
