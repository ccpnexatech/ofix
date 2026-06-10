# OFIX — Contexto do Projeto (LEIA SEMPRE)

Sistema multi-tenant de gestão de ordens de serviço para assistências técnicas, com nível de filial, mapa público de filiais, tour guiado e assistente de IA. Projeto de portfólio nível pleno/sênior. Autor: Caio César Passos Viana Ponte.

## Fonte de verdade

1. `specs/000-master.md` — orquestrador. **Toda sessão começa lendo ele.** Ele aponta a fase atual e o checklist global.
2. `specs/001..012` — especificações detalhadas. Nada é implementado fora delas.
3. `docs/adr/` — decisões. Decisão nova não prevista em spec → escrever ADR ANTES de codar.
4. Ideia fora de spec → anotar em `docs/backlog.md`. NUNCA implementar por impulso.

## Regras invioláveis

1. **TypeScript strict em tudo.** Proibido `any`, `@ts-ignore` sem comentário justificando, e type assertion para "calar" o compilador.
2. **Nenhuma fase fecha** sem: `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓, checklist de DoD da spec 100% marcado, item correspondente atualizado no `000-master.md`.
3. **Sem gambiarra.** Solução "temporária" não existe. Se não dá para fazer certo agora, registrar no backlog e ajustar o plano.
4. **Toda regra de negócio (RN-xx) tem teste unitário** antes de a fase fechar.
5. **Isolamento multi-tenant é sagrado.** Toda query de domínio passa pelo escopo de tenant (ver spec 002). Teste de isolamento é obrigatório para todo endpoint novo.
6. **Dinheiro sempre em centavos (int).** Nunca float.
7. **Idioma:** código, nomes de variáveis e commits em inglês. Documentação, specs e UI em pt-BR.

## Git e GitHub (gh CLI já autenticado)

- Repo: criar na Fase 0 com `gh repo create ofix --public --source=. --push` (confirmar visibilidade com o Caio antes).
- **Commits pequenos e por contexto.** Um commit = uma unidade lógica (ex.: "feat(api): add quote approval via public token"). Nunca commitar fase inteira de uma vez. Após cada tarefa concluída do plano da fase → commit.
- Conventional Commits: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci` com escopo `(api)`, `(web)`, `(shared)`, `(db)`, `(specs)`.
- Fluxo por fase: branch `feat/fase-N-nome` → commits atômicos → `gh pr create` com descrição do que foi feito, decisões e como testar → merge. O PR é o registro de "code review" do projeto.
- Nunca usar `git push --force` na main.

## Comandos do monorepo

```bash
pnpm dev              # api + web em paralelo (turbo)
pnpm typecheck        # tsc em todos os pacotes
pnpm lint             # eslint
pnpm test             # vitest (api + web)
pnpm test:e2e         # playwright
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # prisma studio
pnpm db:seed          # seed demo
tsx scripts/<nome>.ts # scripts operacionais (tenant, filial, usuário)
docker compose up -d  # postgres local
```

## Stack (versões mais recentes estáveis)

pnpm workspaces + Turborepo 2 · NestJS 11 · Prisma 6 + PostgreSQL 16 · Next.js 15 (App Router) + React 19 · Tailwind CSS v4 · Zod 4 em `packages/shared` (fonte única de schemas) · TanStack Query v5 · React Hook Form · Radix Primitives · react-leaflet (mapa, OpenStreetMap) · Vitest 3 + Supertest + Testing Library · Playwright · Anthropic SDK (assistente IA). Node 22 LTS.

## Estrutura

```
apps/api        NestJS (controller → service → repository)
apps/web        Next.js App Router
packages/shared tipos, schemas Zod, constantes de domínio, máquina de estados
packages/config eslint/ts/prettier compartilhados
scripts/        scripts operacionais EXPOSTOS e documentados (tsx)
specs/          especificações (governam tudo)
docs/           ADRs, API, fluxos, banco (ER), design system, guia do usuário
```

## Postura esperada

Agir como engenheiro pleno/sênior: ler a spec inteira antes de codar, planejar a fase em tarefas pequenas, implementar com testes, commitar por contexto, documentar decisões. Em dúvida entre duas abordagens → escolher a mais simples que cumpre a spec e registrar ADR se a decisão for estrutural. Perguntar ao Caio apenas o que for bloqueante (credenciais, visibilidade de repo, chaves de API).
