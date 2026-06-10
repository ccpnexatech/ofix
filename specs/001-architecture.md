# SPEC 001 — Arquitetura, Monorepo e Convenções

## Layout do monorepo (pnpm workspaces + Turborepo 2)

```
ofix/
├── apps/
│   ├── api/                  # NestJS 11
│   │   └── src/
│   │       ├── modules/      # auth, users, customers, equipments, orders,
│   │       │                 # quotes, public, dashboard, branches, assistant
│   │       ├── common/       # guards, decorators, filters, interceptors, pipes
│   │       └── infra/        # prisma service (com extensão de tenant), config, anthropic client
│   └── web/                  # Next.js 15 App Router + React 19
│       └── src/
│           ├── app/          # rotas
│           ├── design-system/# tokens + componentes próprios
│           ├── features/     # módulos por domínio (orders, customers, dashboard, tour, assistant)
│           └── lib/          # api client, query client, auth helpers
├── packages/
│   ├── shared/               # Zod 4 schemas, tipos, enums, máquina de estados (pura), constantes
│   └── config/               # eslint flat config, tsconfig base, prettier
├── scripts/                  # scripts operacionais (tsx) — EXPOSTOS, ver spec 002
├── specs/  docs/  .claude/  .github/workflows/
├── docker-compose.yml        # postgres 16 (porta 5432) + postgres_test (porta 5433)
└── turbo.json  pnpm-workspace.yaml
```

## Princípios

1. **`packages/shared` é a fonte única de verdade do domínio.** Enums (status, roles, prioridades), schemas Zod de request/response e a função pura de transição da máquina de estados vivem ali. API valida com eles (via pipe Zod), web valida formulários com eles (RHF resolver). Tipo divergente entre front e back é impossível por construção.
2. **API em camadas:** controller (HTTP, validação, auth) → service (regra de negócio, transação) → repository (Prisma). Regra de negócio NUNCA em controller.
3. **Máquina de estados isolada e pura:** `packages/shared/src/order-state-machine.ts` exporta `canTransition(from, action, ctx)` e `nextStatus(from, action)` sem dependência de framework — testável em milissegundos.
4. **Erros padronizados:** exception filter global → `{ statusCode, error, message, details? }`. Erros de domínio são classes (`InvalidTransitionError`, `QuoteExpiredError`, `TenantIsolationError`...) mapeadas para HTTP no filter.
5. **Config tipada:** env validado com Zod no boot (api e web). Boot falha com mensagem clara se faltar variável. `.env.example` sempre atualizado.
6. **Server Components por padrão no web;** `"use client"` apenas onde há interação. Data fetching client-side via TanStack Query com chaves padronizadas em `features/*/queries.ts`.

## Convenções de código

- TS `strict: true` + `noUncheckedIndexedAccess` em todos os pacotes.
- ESLint flat config compartilhado; zero warnings tolerados no CI.
- Nomes: arquivos `kebab-case`, tipos `PascalCase`, funções/vars `camelCase`, constantes `SCREAMING_SNAKE`.
- Imports absolutos via paths (`@/...` no web, `@api/...` na api, `@ofix/shared`).
- Comentários explicam **porquês**, não o óbvio.

## Definition of Done (Fase 0)

- [x] `git init`, commit inicial com specs + CLAUDE.md + .claude/, `gh repo create` + push. (commit `7adbfc3`; repo https://github.com/ccpnexatech/ofix)
- [x] Monorepo montado: pnpm workspaces, turbo.json com pipelines `dev`, `build`, `lint`, `typecheck`, `test`. (`pnpm-workspace.yaml`, `turbo.json`)
- [x] `apps/api` NestJS 11 bootando com healthcheck `GET /api/v1/health`. (verificado via curl: `{"status":"ok","service":"OFIX",...}`)
- [x] `apps/web` Next.js 15 bootando com página placeholder. (`apps/web/src/app/page.tsx`; build estático ok)
- [x] `packages/shared` e `packages/config` criados e consumidos pelos dois apps. (api e web importam `@ofix/shared`; presets de `@ofix/config` em todos os pacotes)
- [x] docker-compose com postgres dev + test sobe sem erro. (`ofix-postgres` e `ofix-postgres-test` healthy)
- [x] 1 teste unitário trivial em api e em web rodando no Vitest. (`health.controller.spec.ts`, `page.spec.tsx`)
- [x] CI no GitHub Actions verde (ver spec 011). (run do PR #1: success)
- [x] `docs/adr/001-monorepo-nest-next.md` escrito.
