# ADR-001 — Monorepo pnpm + Turborepo com NestJS (API) e Next.js (web)

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

O OFIX tem dois aplicativos (API REST e web) que compartilham o mesmo vocabulário de domínio: enums de status, schemas de validação, a máquina de estados da OS e constantes. Em repositórios separados, esse contrato duplicaria e divergiria com o tempo — exatamente o tipo de bug silencioso que um sistema multi-tenant não pode ter. O projeto também é peça de portfólio: a organização do código precisa contar a história da arquitetura.

## Decisão

1. **Monorepo com pnpm workspaces + Turborepo 2.** Workspaces `apps/*` e `packages/*`; pipelines `dev`, `build`, `lint`, `typecheck`, `test` orquestradas pelo turbo com cache e dependência `^build` (pacotes compilam antes de quem os consome).
2. **`packages/shared` é a fonte única de verdade do domínio.** Schemas Zod, tipos, constantes e (a partir da Fase 3) a máquina de estados pura. Compilado com tsup para CJS + ESM + d.ts, consumível tanto pelo NestJS (CJS) quanto pelo Next.js (bundler).
3. **`packages/config` centraliza tooling:** tsconfig base (strict + `noUncheckedIndexedAccess`), ESLint flat config type-checked e preset do Prettier. Nenhum app redefine regra por conta própria.
4. **API em NestJS 11** (camadas controller → service → repository, DI nativa, guards/interceptors para o contexto de tenant) e **web em Next.js 15 App Router** (Server Components por padrão, páginas públicas leves para `/q/[token]` e `/m/[mapToken]`).

## Consequências

- Tipo divergente entre front e back torna-se impossível por construção: ambos importam de `@ofix/shared`.
- Um único `pnpm install`, um único CI, um único PR por fase — histórico de commits conta a história inteira do projeto.
- Custo assumido: `packages/shared` precisa de build step (tsup) e o turbo adiciona uma camada de configuração; aceitável pelo ganho de cache e ordenação de tarefas.
- Alternativas rejeitadas: repositórios separados (duplicação de contrato), Nx (mais pesado do que o necessário), backend dentro do Next (route handlers não comportam bem a complexidade de guards/RBAC/multi-tenant planejada).
