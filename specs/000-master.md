# SPEC 000 — MASTER (Orquestrador)

> Este arquivo governa a execução do OFIX. Toda sessão de trabalho começa aqui.
> Regra suprema: **nenhuma fase encerra com teste falhando, type error, lint error ou item de checklist aberto.**

## O que é o OFIX

Plataforma multi-tenant de gestão de ordens de serviço (OS) para assistências técnicas: várias empresas (tenants), cada uma com uma ou mais filiais (branches). Cobre o ciclo completo: entrada do equipamento → diagnóstico → orçamento (aprovado pelo cliente via link público, sem login) → reparo → entrega → garantia de 90 dias. Inclui dashboard consolidado ou por filial, mapa público de filiais, tour guiado em todas as telas e assistente de IA conectado à documentação. **Todas as funcionalidades são padrão para todos os tenants — não existe plano pago ou tier de features.**

## Índice de specs

| Spec | Tema | Status |
|---|---|---|
| 001 | Arquitetura, monorepo, convenções | ✅ concluída (Fase 0) |
| 002 | Banco de dados multi-tenant + filiais + scripts operacionais | ✅ concluída (Fase 1) |
| 003 | Autenticação, sessão e RBAC | ✅ concluída (Fase 2) |
| 004 | Regras de negócio (RN-01..RN-15) e máquina de estados | ✅ concluída (Fases 3-4-7) |
| 005 | API REST (contratos) | ✅ concluída (Fases 3-4-7; /assistant na F11) |
| 006 | Frontend (rotas, telas, estados) | ✅ concluída (Fases 6-7; card de IA na F11) |
| 007 | Design system e identidade visual | ✅ concluída (Fase 5) |
| 008 | Estratégia de testes | ✅ concluída (Fase 9) |
| 009 | Tour guiado (onboarding por tela) | ✅ concluída (Fases 8-9) |
| 010 | Assistente de IA (chat + insights do dashboard) | — |
| 011 | Entrega: CI, deploy, seed, git e scripts expostos | 🔶 parcial — CI feito na Fase 0 |
| 012 | Documentação de uso da ferramenta (última spec) | ✅ concluída (Fase 10) |

## Fases de execução

> Marcar `[x]` SOMENTE após o ritual de DoD (abaixo). A fase atual é a primeira desmarcada.

- [x] **Fase 0 — Fundação:** git + gh repo, monorepo, tooling, CI verde com teste hello-world. (Specs 001, 011-parcial) — PR #1
- [x] **Fase 1 — Banco e scripts:** schema Prisma multi-tenant completo, migrations, docker compose, scripts operacionais de tenant/filial/usuário, seed básico, ERD gerado. (Spec 002) — PR #2
- [x] **Fase 2 — Auth:** login, refresh rotativo, guards, RBAC, escopo de tenant/filial no request. Testes. (Spec 003) — PR #3
- [x] **Fase 3 — Domínio OS:** customers, equipments, service orders, máquina de estados, eventos de auditoria. Testes de TODAS as RN de transição + isolamento de tenant. (Specs 004, 005) — PR #4
- [x] **Fase 4 — Orçamentos:** quotes versionadas, itens, envio, fluxo público de aprovação por token, expiração. Testes. (Specs 004, 005) — PR #5
- [x] **Fase 5 — Design system:** tokens, temas claro/escuro, fontes, componentes base documentados. (Spec 007) — PR #6
- [x] **Fase 6 — Telas core:** layout autenticado, login, lista/detalhe/wizard de OS, clientes, página pública `/q/[token]`. (Spec 006) — PR #7
- [x] **Fase 7 — Dashboard, filiais e mapa:** métricas consolidadas/por filial, seletor de filial, mapa interno e mapa público compartilhável. (Specs 005, 006) — PR #8
- [x] **Fase 8 — Tour guiado:** engine própria + fluxos de tour em todas as telas. (Spec 009) — PR #9
- [x] **Fase 9 — E2E e hardening:** Playwright nos fluxos críticos, rate limit nas rotas públicas, headers de segurança, snapshots de tela. (Spec 008) — PR #11
- [x] **Fase 10 — Documentação de uso:** guia completo do usuário com os snapshots gerados na Fase 9. (Spec 012) — PR #12
- [x] **Fase 11 — Assistente de IA:** chat flutuante com contexto dos docs + tools, e card de insights no dashboard. (Spec 010) — PR #13
- [ ] **Fase 12 — Entrega final:** deploy completo, seed demo rico, README com gif e credenciais, revisão geral. (Spec 011)

## Ritual de Definition of Done (vale para TODA fase)

1. `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` ✓ (e `pnpm test:e2e` quando aplicável).
2. Checklist de DoD da spec da fase: 100% marcado, com evidência (arquivo/teste).
3. RNs implementadas na fase possuem teste unitário com o código da regra no nome.
4. Decisões estruturais → ADR em `docs/adr/` (template: Contexto → Decisão → Consequências).
5. Commits pequenos por contexto; PR aberto via `gh pr create` com descrição de decisões e como testar; merge.
6. Atualizar este arquivo: marcar a fase e atualizar a coluna Status do índice.

## Anti-derrapagem

- Funcionalidade fora das specs → `docs/backlog.md`, nunca código.
- "Depois eu testo" não existe. Teste acompanha a implementação.
- Se uma spec se mostrar inviável/contraditória durante a execução: PARAR, propor ajuste ao Caio, atualizar a spec via commit `docs(specs): ...` e só então continuar.
