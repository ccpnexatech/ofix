# Scripts operacionais

Tenant, filial e usuários iniciais não têm painel administrativo — são geridos por
scripts de linha de comando (decisão registrada no [ADR-007](adr/007-gestao-de-tenant-via-scripts.md)).
Todos vivem em `scripts/`, rodam com `tsx`, têm `--help`, são interativos quando
chamados num terminal sem as flags necessárias e idempotentes quando possível.

Pré-requisitos: `pnpm install`, `docker compose up -d`, `pnpm db:migrate` e
`apps/api/.env` criado a partir de `apps/api/.env.example` (os scripts leem o
`DATABASE_URL` de lá).

> Flags numéricas negativas (latitude/longitude) exigem a forma `--lat=-3.73`
> (limitação do parser de argumentos do Node).

## `create-tenant.ts` — cria tenant + filial Matriz + ADMIN inicial

```bash
tsx scripts/create-tenant.ts \
  --name "TecNorte Assistência" --slug tecnorte \
  --address "Av. Bezerra de Menezes, 100" --city Fortaleza --state CE \
  --lat=-3.731862 --lng=-38.526670 \
  --admin-name "Ana Souza" --admin-email ana@tecnorte.dev
```

Saída real:

```
Tenant criado com sucesso!
  Tenant:  Teste QA (slug teste-qa, id 20c61503-c26a-41ca-aff5-82a014e9595f)
  Filial:  Matriz — Fortaleza/CE
  ADMIN:   qa@teste.dev
  Senha:   hM1pXIzCGaBL  (troque após o primeiro login)
  Mapa:    /m/bdfd9944-c75b-43ce-8be9-50411e4a6d28
```

Sem `--admin-password`, uma senha aleatória é gerada e impressa uma única vez.
Se o slug já existir, nada é alterado (idempotente). Sem `--lat/--lng`, o script
alerta que a filial não aparecerá no mapa público.

## `create-branch.ts` — adiciona filial a um tenant

```bash
tsx scripts/create-branch.ts --tenant tecnorte --name "Filial Aldeota" \
  --address "Av. Santos Dumont, 1500" --city Fortaleza --state CE \
  --lat=-3.732700 --lng=-38.496700
```

Idempotente por (tenant, nome da filial). Sem coordenadas, alerta sobre o mapa.

## `create-user.ts` — cria usuário (role + filial opcional)

```bash
tsx scripts/create-user.ts --tenant tecnorte --name "Carlos Lima" \
  --email carlos@tecnorte.dev --role TECHNICIAN --branch "Matriz Fortaleza"
```

Roles: `ADMIN | TECHNICIAN | ATTENDANT`. Sem `--branch`, o usuário tem acesso a
**todas** as filiais do tenant. Senha gerada quando `--password` é omitida.
Idempotente por (tenant, e-mail).

## `rotate-map-token.ts` — revoga o link público do mapa

```bash
tsx scripts/rotate-map-token.ts --tenant tecnorte --yes
```

Gera um novo `publicMapToken`; o link `/m/{token}` antigo deixa de funcionar
imediatamente. Sem `--yes`, pede confirmação.

## `seed-demo.ts` — dados de demonstração (`pnpm db:seed`)

```bash
pnpm db:seed
```

Cria os dois tenants de demonstração (idempotente):

| Tenant | Filiais | Usuários |
|---|---|---|
| TecNorte Assistência (`tecnorte`) | Matriz Fortaleza, Filial Aldeota (com lat/lng reais) | admin@tecnorte.dev (ADMIN, todas), tecnico@tecnorte.dev (TECHNICIAN, Matriz), atendente@tecnorte.dev (ATTENDANT, Aldeota) |
| Eletrolar Recife (`eletrolar`) | Matriz | admin@eletrolar.dev (ADMIN, todas) |

Senha padrão de demonstração: `ofix-demo-123`. Os tokens do mapa público são
impressos ao final. Ordens de serviço e orçamentos de demonstração serão
adicionados quando o domínio existir (spec 011, Fase 12).

## `reset-db.ts` — drop + migrate + seed (apenas dev)

```bash
tsx scripts/reset-db.ts        # pede confirmação
tsx scripts/reset-db.ts --yes  # sem confirmação
```

Roda `prisma migrate reset` (apaga TODOS os dados), reaplica as migrations e
executa o seed de demonstração. **Aborta imediatamente se `NODE_ENV=production`.**

## Explorando os dados

`pnpm db:studio` abre o Prisma Studio (http://localhost:5555) para navegar nas
tabelas do banco local. Veja também [database.md](database.md) para o ERD e o
dicionário de dados.
