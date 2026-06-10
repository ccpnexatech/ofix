# Referência da API

Prefixo: `/api/v1`. Autenticação: `Authorization: Bearer {accessToken}` em toda
rota não marcada como pública. Validação por schemas Zod de `@ofix/shared`.
Paginação: `?page=1&perPage=20` → `{ data, meta: { page, perPage, total, totalPages } }`.
Erro padrão: `{ statusCode, error, message, details? }` — em violações de regra
de negócio, `details.code` carrega o código da RN.

As respostas abaixo são reais, capturadas contra o seed local
(`pnpm db:seed`, usuário `admin@tecnorte.dev`, senha `ofix-demo-123`).

## Auth

### POST /auth/login — público, rate limit 5/min/IP

```bash
curl -X POST localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tecnorte.dev","password":"ofix-demo-123"}'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "fb1b8175-3f7c-4e9f-a66c-e9d34afe68b6",
    "tenantId": "f6ce16aa-8d1a-4e4f-9551-17ff09f9d92f",
    "branchId": null,
    "name": "Ana Souza",
    "email": "admin@tecnorte.dev",
    "role": "ADMIN"
  }
}
```

O refresh token (7 dias, rotativo) viaja num cookie `httpOnly` com
`Path=/api/v1/auth`. Mesmo e-mail em mais de um tenant → `400` com
`details.code = "TENANT_SLUG_REQUIRED"`; reenvie com `tenantSlug`.

### POST /auth/refresh — público (usa o cookie)

Rotaciona: revoga o token usado e emite par novo. **Reuso de token já
rotacionado revoga todas as sessões do usuário** (sinal de roubo).

### POST /auth/logout — autenticado · 204
### GET /auth/me — autenticado

```json
{ "user": { "...": "..." }, "branch": null, "completedTours": [] }
```

## Branches

### GET /branches — todas as roles

Filiais ativas do tenant (seletores e mapa interno). Escrita só via scripts
(ADR-007).

```bash
curl localhost:3001/api/v1/branches -H "Authorization: Bearer $TOKEN"
```

```json
[
  {
    "id": "3a8980fd-0507-418a-91a7-886a6712f152",
    "name": "Matriz Fortaleza",
    "phone": "(85) 3222-1000",
    "address": "Av. Bezerra de Menezes, 100 — São Gerardo",
    "city": "Fortaleza",
    "state": "CE",
    "zipCode": "60325-002",
    "latitude": "-3.731862",
    "longitude": "-38.52667"
  }
]
```

## Customers & Equipments

| Rota | Roles | Notas |
|---|---|---|
| `GET /customers?search=&page=` | todas | busca em nome/telefone/e-mail |
| `POST /customers` | ADMIN, ATTENDANT | |
| `GET /customers/:id` | todas | inclui equipamentos |
| `PATCH /customers/:id` | ADMIN, ATTENDANT | |
| `GET /customers/:id/orders` | todas | histórico, com escopo de filial (RN-12) |
| `POST /customers/:id/equipments` | ADMIN, ATTENDANT | |
| `PATCH /equipments/:id` | ADMIN, ATTENDANT | |

```bash
curl -X POST localhost:3001/api/v1/customers \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Maria Silva","phone":"(85) 98888-7777","email":"maria@gmail.com"}'
```

```json
{
  "id": "08331bc5-a1e4-42ba-93a1-d924a8294cdb",
  "tenantId": "f6ce16aa-8d1a-4e4f-9551-17ff09f9d92f",
  "name": "Maria Silva",
  "phone": "(85) 98888-7777",
  "email": "maria@gmail.com",
  "document": null,
  "address": null,
  "notes": null,
  "createdAt": "2026-06-10T18:37:45.034Z"
}
```

## Service Orders

| Rota | Roles | Notas |
|---|---|---|
| `GET /orders?status=&branchId=&technicianId=&priority=&search=&page=` | todas | filial fixa → `branchId` forçado; outra filial → 403; busca em código/cliente/equipamento |
| `POST /orders` | ADMIN, ATTENDANT | código `OS-{ano}-{seq}` por tenant+ano (RN-10) |
| `GET /orders/:id` | todas | OS + cliente + equipamento + filial + quote ativa |
| `GET /orders/:id/events` | todas | trilha de auditoria asc (ADR-004) |
| `PATCH /orders/:id` | todas* | campos por estado e por papel (ver business-rules) |
| `POST /orders/:id/assign` | ADMIN, ATTENDANT | técnico ativo da mesma filial (ou sem filial) |
| `POST /orders/:id/transitions` | por ação | único ponto de mudança de status (ADR-006) |
| `POST /orders/:id/warranty-reopen` | ADMIN, ATTENDANT | cria OS filha (RN-07) |

### POST /orders

```bash
curl -X POST localhost:3001/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"branchId":"3a8980fd-...","customerId":"08331bc5-...","equipmentId":"c5d488ea-...","reportedIssue":"Não liga após queda de energia","priority":"HIGH"}'
```

```json
{
  "id": "cf2dcb55-2408-4c19-98bf-d2dc0cf3e72e",
  "code": "OS-2026-0001",
  "status": "RECEIVED",
  "priority": "HIGH",
  "reportedIssue": "Não liga após queda de energia",
  "customer": { "id": "08331bc5-...", "name": "Maria Silva", "phone": "(85) 98888-7777", "email": "maria@gmail.com" },
  "equipment": { "id": "c5d488ea-...", "type": "Notebook", "brand": "Dell", "model": "Inspiron 15" },
  "branch": { "id": "3a8980fd-...", "name": "Matriz Fortaleza" },
  "assignedTechnician": null,
  "quotes": [],
  "createdAt": "2026-06-10T18:37:45.189Z"
}
```

### POST /orders/:id/transitions

Ações: `START_DIAGNOSIS` · `SEND_QUOTE` · `APPROVE_QUOTE` · `REJECT_QUOTE` ·
`START_REPAIR` · `MARK_READY` · `DELIVER` · `CANCEL`. Payloads:
`CANCEL { reason ≥ 10 }` · `REJECT_QUOTE { reason ≥ 5 }`.

```bash
curl -X POST localhost:3001/api/v1/orders/$ORDER/transitions \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"START_DIAGNOSIS"}'
# → 201 { ..., "status": "IN_DIAGNOSIS" }
```

Transição inválida (resposta real):

```bash
curl -X POST .../transitions -d '{"action":"DELIVER"}'   # OS em IN_DIAGNOSIS
```

```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Ação DELIVER não é permitida no status IN_DIAGNOSIS",
  "details": { "code": "RN-01" }
}
```

### GET /orders/:id/events (resposta real, abreviada)

```json
[
  { "type": "ORDER_CREATED", "actorType": "USER", "toStatus": "RECEIVED", "createdAt": "2026-06-10T18:37:45.206Z" },
  { "type": "TECHNICIAN_ASSIGNED", "metadata": { "technicianId": "379f98e3-...", "technicianName": "Carlos Lima" } },
  { "type": "STATUS_CHANGED", "fromStatus": "RECEIVED", "toStatus": "IN_DIAGNOSIS", "metadata": { "action": "START_DIAGNOSIS" } }
]
```

### POST /orders/:id/warranty-reopen

Body opcional `{ "reportedIssue": "..." }`. Resposta: a OS filha
(`warrantyParentId` preenchido, prioridade ≥ HIGH, status RECEIVED). Fora da
garantia → `422` com `details.code = "RN-07"` e a data limite na mensagem.

## Users (ADMIN)

| Rota | Notas |
|---|---|
| `GET /users?search=&page=` | nunca expõe `passwordHash` |
| `POST /users` | e-mail duplicado no tenant → 409; filial inválida → 422 |
| `PATCH /users/:id` | nome, role, branchId, isActive |

## A implementar nas próximas fases

- **Quotes** (`POST /orders/:id/quotes`, `PATCH /quotes/:id`, `POST /quotes/:id/send`) e rotas públicas `/public/quotes/:token` — Fase 4.
- **`GET /public/map/:mapToken`** e **Dashboard** (`/dashboard/*`) — Fase 7.
- **Assistente** (`/assistant/*`) — Fase 11.
