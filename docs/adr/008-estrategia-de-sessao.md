# ADR-008 — Estratégia de sessão: JWT curto + refresh token opaco rotativo em cookie httpOnly

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

A API atende um SPA (Next.js) e páginas públicas sem login. A sessão precisa: sobreviver a refresh de página, não expor credenciais a XSS, permitir revogação real (demissão de funcionário, roubo de token) e carregar o contexto multi-tenant (tenant, filial, papel) em toda request sem ida ao banco. Sessão server-side pura (cookie de sessão + tabela) revoga bem mas custa uma query por request; JWT puro de longa duração não revoga nunca.

## Decisão

Modelo híbrido (spec 003):

1. **Access token JWT de 15 minutos**, HS256 com `JWT_SECRET` (env), payload mínimo: `sub`, `tenantId`, `branchId|null`, `role`, `name`. Vive **em memória** no web — nunca em localStorage. Verificação é local (sem query), e o payload alimenta o `TenantContextInterceptor` que escopa o Prisma.
2. **Refresh token opaco de 7 dias** — 256 bits aleatórios, armazenado **hasheado com SHA-256** na tabela `RefreshToken`. SHA-256 (e não Argon2) porque o token tem 256 bits de entropia: força bruta é inviável por construção; o hash protege apenas contra leitura do banco.
3. **Rotação a cada uso:** `POST /auth/refresh` revoga o token usado e emite par novo. **Reuso de token já revogado = sinal de roubo** → revoga todos os refresh tokens do usuário (a "família", que no nosso modelo é por usuário) e registra log de segurança.
4. **Transporte do refresh em cookie `httpOnly` `Secure` `SameSite=Lax`** com `path=/auth` — o JavaScript do app nunca o lê (imune a exfiltração via XSS) e o navegador só o envia às rotas de auth.
5. Logout revoga o refresh atual e limpa o cookie.

## Consequências

- Revogação efetiva em até 15 min (vida do access token) — aceitável para o domínio; revogação imediata exigiria denylist e custaria uma query por request.
- HS256 simétrico basta porque só a própria API valida tokens; se um segundo serviço precisar validar no futuro, migrar para RS256 (novo ADR).
- O web precisa de interceptor para repetir a request uma vez após 401 + refresh automático (spec 003) — custo de implementação no client, pago uma vez.
- Alternativas rejeitadas: sessão server-side (query por request, sem ganho aqui), JWT de longa duração (não revoga), refresh em localStorage (exposto a XSS), Argon2 no hash do refresh (custo de CPU sem ganho contra 256 bits de entropia).
