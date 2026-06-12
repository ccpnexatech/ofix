# SPEC 011 — Entrega: CI, Git, Deploy, Seed e Scripts Expostos

## Git e GitHub (gh CLI)

- Fase 0: `gh repo create ofix --source=. --push` (visibilidade confirmada com o Caio).
- **Commits pequenos por contexto** (regra do CLAUDE.md): 1 unidade lógica = 1 commit; Conventional Commits em inglês com escopo. O histórico é peça de avaliação — `git log --oneline` deve contar a história do projeto.
- 1 branch por fase (`feat/fase-N-nome`) → PR via `gh pr create` com template: o que foi feito · decisões (links para ADRs) · como testar · screenshots quando UI. Merge por squash NÃO — preservar os commits atômicos (merge commit ou rebase-merge).
- Releases: ao final, `gh release create v1.0.0` com changelog gerado do histórico.

## CI (GitHub Actions — `.github/workflows/ci.yml`)

Em push/PR: setup pnpm com cache → `install` → `lint` → `typecheck` → `test` (unit + integração com postgres service container) → `build` → (job separado, em PR para main) `test:e2e` com artifacts de screenshots/trace em falha → verificação do contexto da IA (spec 010). Badge de status no README. Tempo alvo < 8 min.

## Deploy

- **web** → Vercel · **api** → Railway (ou Render) · **postgres** → Neon. Envs documentadas em `docs/setup.md`; `.env.example` completo nos dois apps.
- Migrations: `prisma migrate deploy` no start da api.
- Cold start de free tier explicado no README (avaliador avisado).
- Rodar local em ≤ 5 comandos (documentado e testado do zero): `pnpm i` → `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`.

## Seed demo (`scripts/seed-demo.ts`) — o playground do avaliador

- Tenant **"TecNorte Assistência"** (slug `tecnorte`): filiais **Matriz Fortaleza** e **Filial Aldeota** (com lat/lng reais de Fortaleza) — alimentam o mapa.
- Tenant **"Eletrolar Recife"** (1 filial) — prova o isolamento: logar nele e não ver NADA da TecNorte.
- Usuários (senha padrão de demo documentada): admin@tecnorte.dev (ADMIN, todas as filiais) · tecnico@tecnorte.dev (TECHNICIAN, Matriz) · atendente@tecnorte.dev (ATTENDANT, Aldeota) · admin@eletrolar.dev.
- ~18 OS distribuídas por TODOS os status e pelas 2 filiais, com datas espalhadas em 6 meses (gráfico de receita ganha forma), 2 atrasadas, 1 entregue dentro da garantia (permite testar reabertura) e 1 OS de garantia já criada.
- 1 orçamento SENT com token público válido — **o link `/q/{token}` e o link do mapa `/m/{mapToken}` são impressos ao final do seed e colados no README** para o avaliador testar sem login.

## README.md raiz (porta de entrada — capricho máximo)

Ordem: logo + uma frase do que é → gif de 30s do fluxo principal → badges (CI, license) → **links demo + credenciais dos 4 usuários + link público de orçamento + link do mapa** → arquitetura (diagrama Mermaid) → stack com justificativa de 1 linha cada → como rodar local (5 comandos) → como testar → mapa da documentação (specs, ADRs, guia de uso, scripts, banco) → decisões-chave (top 5 ADRs linkados) → o que ficou fora e por quê (backlog) → autor com contatos (LinkedIn da NEXATECH).

## Definition of Done (Fases 0-parcial e 12)

- [x] CI verde com todos os estágios; badge no README. — pipeline completo desde a F9/F10; badge na F12
- [ ] Deploy dos 3 serviços funcionando; fluxo público testado em produção pelo celular.
- [ ] Seed demo completo; links públicos reais no README. — seed ✓ (19 OS, links impressos); links REAIS aguardam o deploy
- [x] README final com gif; `docs/setup.md` validado seguindo do zero em máquina limpa (ou container). — 2 gifs reais; o job E2E do CI roda install→migrate→seed→stack em container limpo a cada PR
- [ ] `gh release create v1.0.0`.
- [x] Revisão final: rodar `/checar-dod` de TODAS as fases; zero TODO/FIXME no código; `docs/backlog.md` organizado. — 314 testes + 6 E2E; 12 specs auditadas
