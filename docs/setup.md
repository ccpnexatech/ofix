# Setup — local e produção

## Rodar local (5 comandos)

Pré-requisitos: Node 22+, pnpm 9+, Docker.

```bash
pnpm install
docker compose up -d        # postgres dev (5432) e teste (5433)
pnpm db:migrate             # migrations + client
pnpm db:seed                # playground demo (imprime credenciais e links públicos)
pnpm dev                    # web em :3000, api em :3001
```

Login: `admin@tecnorte.dev` / `ofix-demo-123` (os outros usuários saem no
console do seed). Testes: `pnpm test` · E2E: `pnpm build && pnpm test:e2e`.

## Variáveis de ambiente

### apps/api (`apps/api/.env`, modelo em `.env.example`)

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✓ | Postgres (`postgresql://ofix:ofix@localhost:5432/ofix` no dev) |
| `JWT_SECRET` | ✓ | ≥ 32 caracteres |
| `PORT` | — | default `3001` |
| `CORS_ORIGIN` | — | origem do web (default `http://localhost:3000`) |
| `ASSISTANT_MODE` | — | `local` (default, ADR-012) ou `anthropic` |
| `ANTHROPIC_API_KEY` | só no modo anthropic | nunca exposta ao front |
| `ASSISTANT_MODEL` | — | default `claude-sonnet-4-20250514` |

### apps/web

| Var | Obrigatória | Descrição |
|---|---|---|
| `API_ORIGIN` | em produção | origem da API (ex.: `https://ofix-api.onrender.com`); o Next faz proxy same-origin de `/api/v1/*`, então cookies funcionam sem CORS no navegador |

## Deploy (free tier: Neon + Render + Vercel)

A arquitetura já é deploy-ready: o web faz **proxy same-origin** para a API
(rewrites do Next), então o cookie httpOnly de refresh funciona mesmo com api
e web em domínios diferentes.

1. **Neon (postgres):** crie um projeto → copie a connection string
   (`...?sslmode=require`). As migrations rodam sozinhas no start da API.
2. **Render (api):** New → Blueprint → aponte para este repositório (o
   [`render.yaml`](../render.yaml) descreve o serviço). Preencha
   `DATABASE_URL` (Neon) e `CORS_ORIGIN` (URL do Vercel, dá para ajustar
   depois). Após o primeiro deploy: Shell do serviço → `pnpm db:seed` para o
   playground demo (anote os links públicos impressos).
3. **Vercel (web):** Add New Project → este repositório → **Root Directory =
   `apps/web`** (o resto é autodetectado) → env `API_ORIGIN` = URL do Render.
4. Volte ao Render e ajuste `CORS_ORIGIN` para a URL final do Vercel.

**Cold start:** no plano free o Render hiberna após ~15 min ocioso; a
primeira requisição pode levar ~50 s (aviso para avaliadores no README).

**Instância de referência (este repositório):** web em
`https://ofix-web.vercel.app`, API em `https://ofix-2g8f.onrender.com`,
banco no Neon. Duas pegadinhas reais resolvidas aqui, registradas para o
futuro: serviço Render criado manualmente precisa de `PORT=10000` e do health
check em `/api/v1/health`; e o proxy do web é um route handler em runtime —
rewrites do Next assam a env no build (ver comentário em
`apps/web/src/app/api/v1/[...path]/route.ts`).
