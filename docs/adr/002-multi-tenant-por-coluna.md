# ADR-002 — Multi-tenancy por coluna discriminadora com escopo imposto em código

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

O OFIX atende várias empresas (tenants) num único deploy. As estratégias clássicas de isolamento são: (a) database por tenant, (b) schema PostgreSQL por tenant, (c) coluna discriminadora (`tenantId`) em tabelas compartilhadas. As opções (a) e (b) dão isolamento físico, mas exigem provisionamento por tenant (criar database/schema, rodar migrations N vezes, gerenciar conexões) — custo operacional desproporcional para o porte do projeto: dezenas de tenants, não milhares, e nenhum requisito regulatório de segregação física. O risco real da opção (c) é humano: uma query de domínio esquecida sem filtro de `tenantId` vaza dados entre empresas.

## Decisão

Multi-tenancy por **coluna discriminadora `tenantId`** em todos os modelos de domínio, com isolamento **imposto em código por uma Prisma Client Extension** (`apps/api/src/infra/prisma`):

1. Todo modelo tenant-scoped tem `tenantId` e índice iniciando por `tenantId`.
2. A extension injeta `tenantId` em todo `where`/`data` das operações desses modelos, a partir do contexto da request.
3. Operação de domínio **sem tenant no contexto lança `TenantIsolationError`** — não existe caminho silencioso sem escopo.
4. Modelos não tenant-scoped (ex.: `Tenant` em si, `OrderCodeSequence` via chave composta, `RefreshToken` por usuário) são listados explicitamente como exceção na extension.
5. Teste automatizado de isolamento é obrigatório: (a) query sem contexto falha; (b) tenant A não enxerga dados do tenant B. Todo endpoint novo ganha teste de isolamento (spec 008).

## Consequências

- Custo zero de provisionamento: criar tenant é um `INSERT` (via `scripts/create-tenant.ts`), migrations rodam uma vez.
- O isolamento depende de disciplina de código, mitigada por: extension central (impossível esquecer o filtro em query de domínio), erro explícito em vez de resultado vazio, e suíte de testes de isolamento.
- Backup/restore e métricas são por banco, não por tenant; restaurar um tenant isoladamente exige filtragem manual. Aceitável para o porte.
- Alternativas rejeitadas: schema por tenant (provisionamento e migrations N×, conexões por schema), database por tenant (idem, pior), Row-Level Security do PostgreSQL (forte, porém duplicaria a regra entre SQL e Prisma e complica o pool de conexões; a extension cobre o mesmo risco no nível em que as queries são escritas).
