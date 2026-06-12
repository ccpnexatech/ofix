# ADR-013 — Cadastro e edição de filial na UI (revisa parcialmente o ADR-007)

- **Status:** aceita
- **Data:** 2026-06-12
- **Revisa:** [ADR-007](007-gestao-de-tenant-via-scripts.md) (apenas a parte de filiais)

## Contexto

O ADR-007 colocou tenant, filial e usuários iniciais atrás de scripts operacionais, assumindo que são operações de onboarding: raras e executadas pelo time da plataforma. A premissa se sustenta para tenant e primeiro usuário — acontecem uma vez por cliente. Para **filial**, não: abrir uma unidade nova é um evento recorrente da vida do cliente (expansão), não do onboarding. Com 50 tenants e ~20% expandindo por ano, cada expansão viraria um chamado para o operador rodar `create-branch.ts` — um gargalo operacional que cresce com a base.

O próprio ADR-007 previu este momento: *"se um dia o onboarding precisar ser self-service, esta decisão deve ser revista em novo ADR — os scripts já isolam a lógica reaproveitável"*. Há também precedente de CRUD administrativo dentro do tenant: a tela de Usuários (ADMIN cria e edita a equipe na UI desde a spec 003/005).

## Decisão

**Criar e editar filial passa a ser self-service do ADMIN do tenant, na UI** (tela Filiais), com endpoints dedicados:

- `POST /branches` — cria filial (nome único por tenant → 409; lat/lng opcionais, sem elas a filial não aparece no mapa).
- `PATCH /branches/:id` — edita dados cadastrais (nome, telefone, endereço, cidade, UF, CEP, coordenadas).

Validação por schemas Zod em `packages/shared` (mesma fonte para form e API), RBAC `ADMIN`-only via guard existente, isolamento garantido pela Prisma Client Extension (ADR-002) e teste de isolamento obrigatório como em todo endpoint.

**O que continua no ADR-007 (scripts):** criação de tenant + Matriz + primeiro ADMIN, criação de usuário inicial, rotação do token do mapa, seed/reset. `create-branch.ts` permanece como ferramenta do operador (bulk/automação), agora redundante com a UI por design.

**Fora de escopo (backlog):** desativação de filial na UI — exige política para usuários com escopo fixo (RN-12) e OS abertas da filial; sem demanda concreta, fica registrada no backlog.

## Consequências

- Expansão de um tenant deixa de depender do operador da plataforma; o custo é a superfície nova de API/UI/testes, mitigada por espelhar o padrão já estabelecido no módulo de Usuários.
- A UI passa a expor escrita em um módulo que era somente leitura; a lista `GET /branches` continua retornando apenas filiais ativas, então nada muda para seletores e mapa.
- O ADR-007 segue válido para tudo que não é filial; seu status referencia esta revisão.
