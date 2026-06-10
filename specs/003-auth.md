# SPEC 003 — Autenticação, Sessão e RBAC

## Fluxo de autenticação

1. `POST /auth/login` `{ email, password, tenantSlug? }` → valida com Argon2id → emite **access token JWT (15 min)** + **refresh token opaco (7 dias, rotativo)**.
   - E-mail é único **por tenant**; se o mesmo e-mail existir em mais de um tenant, a resposta pede o `tenantSlug` (caso raro, tratado explicitamente).
2. Access token (payload): `sub`, `tenantId`, `branchId|null`, `role`, `name`. Assinado HS256 com `JWT_SECRET` (env).
3. Refresh: opaco (random 256 bits), armazenado **hasheado** em `RefreshToken`. `POST /auth/refresh` valida, **revoga o antigo e emite par novo** (rotação). Reuso de refresh revogado → revoga TODA a família de tokens do usuário (proteção contra roubo) e registra log.
4. `POST /auth/logout` revoga o refresh atual. `GET /auth/me` retorna o perfil + filial + tours concluídos.
5. Transporte no web: access token em memória (estado do app) + refresh em cookie `httpOnly` `Secure` `SameSite=Lax` setado pela API. Interceptor do client tenta refresh automático em 401 e refaz a requisição uma vez.

## Contexto de requisição (coração do multi-tenant)

- `JwtAuthGuard` valida o token e popula `request.user` (claims acima).
- `TenantContextInterceptor` injeta `tenantId` no contexto da Prisma Extension (AsyncLocalStorage). A partir daí TODA query de domínio já nasce escopada — services não passam `tenantId` manualmente.
- `BranchScopeGuard`/helper: se `user.branchId != null`, queries de OS/dashboard são adicionalmente filtradas pela filial; tentar acessar recurso de outra filial → 403.
- Rotas públicas (`/public/*`, `/auth/login`, `/auth/refresh`, health) marcadas com decorator `@Public()`.

## RBAC

Decorator `@Roles('ADMIN', ...)` + `RolesGuard`. Matriz completa de permissões na spec 004 (é regra de negócio). Princípio: **negar por padrão** — endpoint sem `@Public()` e sem `@Roles()` explícito falha no lint customizado/teste de sanidade.

## Segurança adicional

- Argon2id com parâmetros explícitos e justificados em comentário.
- Rate limit (Nest Throttler): global 100 req/min/IP; `/auth/login` 5/min/IP; `/public/*` 20/min/IP.
- Helmet na API; CORS restrito à origin do web (env).
- Mensagem de erro de login genérica ("credenciais inválidas") — sem enumeração de e-mails.
- Senha: mínimo 8 caracteres, validado por schema Zod compartilhado.

## Definition of Done (Fase 2)

- [x] Login, refresh rotativo (com revogação em cascata no reuso), logout e `/me` implementados e testados (unit + integração). — `apps/api/src/modules/auth/` + `auth.integration.spec.ts` (12 testes)
- [x] Guards + interceptor de tenant funcionando; teste de integração prova que usuário do tenant A recebe 404/403 em recurso do tenant B. — `security.integration.spec.ts` via `expectTenantIsolation`
- [x] Teste prova que usuário com `branchId` fixo não acessa OS de outra filial. — mecanismo (BranchScopeGuard 403 + helpers unit); endpoints de OS herdam na Fase 3 (E2E fluxo 4)
- [x] Rate limit ativo nos pontos definidos, com teste do `/auth/login`. — `rate-limit.integration.spec.ts` (429 na 6ª tentativa)
- [x] `.env.example` atualizado; ADR-008 (estratégia de sessão: JWT + refresh rotativo, cookie httpOnly) escrito. — `docs/adr/008-estrategia-de-sessao.md`
