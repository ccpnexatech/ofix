# ADR-007 — Gestão de tenant, filial e primeiro usuário via scripts operacionais (sem painel admin)

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

Criar um tenant, sua filial Matriz e o primeiro usuário ADMIN é uma operação de onboarding: acontece uma vez por cliente, executada por quem opera a plataforma (não pelo usuário final). Um painel "super admin" exigiria uma camada extra de autenticação acima dos tenants, telas de CRUD, RBAC próprio e testes — código significativo para fluxos usados raramente, fora do coração do produto (gestão de ordens de serviço).

## Decisão

Tenant, Branch e usuários iniciais são geridos por **scripts operacionais em `scripts/` (TypeScript, executados com `tsx`)**, expostos e documentados em `docs/scripts.md`:

- `create-tenant.ts` — tenant + filial Matriz + ADMIN inicial; imprime credenciais e token do mapa.
- `create-branch.ts` — nova filial (lat/lng opcionais, com alerta sobre o mapa).
- `create-user.ts` — usuário com role e filial opcional.
- `rotate-map-token.ts` — rotaciona o `publicMapToken` (revoga o link público antigo).
- `seed-demo.ts` / `reset-db.ts` — ambiente de demonstração e reset de dev.

Os scripts são interativos quando chamados sem argumentos, aceitam flags para uso não interativo, têm `--help` e são idempotentes quando possível.

## Consequências

- Zero código de UI/auth/RBAC para um fluxo raro; o esforço fica no domínio.
- Trade-off assumido: operar exige acesso ao repositório e ao banco (linha de comando), o que é adequado enquanto o operador é o time da plataforma. Se um dia o onboarding precisar ser self-service, esta decisão deve ser revista em novo ADR — os scripts já isolam a lógica reaproveitável.
- Os scripts fazem parte do produto: são versionados, documentados com exemplos reais e tratados com o mesmo rigor de código de produção (validação de entrada, mensagens claras, aborto seguro).
