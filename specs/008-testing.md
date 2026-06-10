# SPEC 008 — Estratégia de Testes

## Pirâmide

| Camada | Ferramentas | Alvo | Cobertura mínima |
|---|---|---|---|
| Unitário (shared) | Vitest | Máquina de estados, cálculo de totais, helpers | 100% da state machine |
| Unitário (api) | Vitest | Services: RN-01..RN-15, geração de código, garantia, RBAC | Toda RN nomeada |
| Integração (api) | Vitest + Supertest + Postgres real (`postgres_test` do compose; Testcontainers se viável no CI, senão service container) | Endpoints: feliz + 401 + 403 (papel E tenant) + 404 + 422 | Endpoints críticos 100% |
| Componente (web) | Vitest + Testing Library | Design system crítico, painel de transições, formulários | Componentes core |
| E2E | Playwright (chromium + mobile viewport) | 6 fluxos abaixo | Todos verdes no CI |

## Infra de teste obrigatória

- **Factories tipadas** (`tests/factories/`): `createTenant()`, `createBranch()`, `createUser({ role, branchId })`, `createOrder({ status })` — composáveis, com defaults realistas.
- **Helper de contexto**: `api.as(user)` injeta token; `expectTenantIsolation(endpoint)` — utilitário que cria recurso no tenant A e verifica 404/403 acessando como tenant B. **Todo endpoint novo chama esse helper.**
- Banco de integração truncado entre suítes; testes independentes de ordem.
- Teste de concorrência da RN-10 (20 criações paralelas, códigos únicos).

## Fluxos E2E (Playwright)

1. **Ciclo completo:** login admin → criar cliente+equipamento via wizard → OS criada → atribuir técnico → diagnóstico → orçamento com 2 itens → enviar.
2. **Aprovação pública:** abrir `/q/[token]` em viewport mobile → conferir itens/total → aprovar → status da OS vira APPROVED → evento na timeline.
3. **Entrega e garantia:** reparo → pronta → entregar → garantia visível com data → reabrir em garantia → OS filha criada com prioridade HIGH e referência à mãe.
4. **RBAC e filial:** técnico não vê botão Cancelar e recebe 403 forçando a API; atendente de filial fixa não enxerga OS de outra filial.
5. **Mapa público:** `/m/[mapToken]` renderiza pins e card de filial sem login.
6. **Tema e tour:** alternar tema persiste após reload; tour do dashboard percorre todos os passos e marca como concluído (não reaparece).

## Snapshots de tela (insumo da spec 012)

Os testes E2E capturam screenshots nomeadas em pontos-chave (`screenshots/{fluxo}/{passo}-{nome}.png`): dashboard, lista de OS, detalhe nos estados principais, wizard, página pública de orçamento (mobile), mapa, tour ativo — **nos 2 temas para as telas principais**. Script `pnpm shots` roda só a suíte de captura e despeja em `docs/assets/screens/`. A documentação de uso (spec 012) consome essas imagens — por isso a Fase 10 vem depois da 9.

## Política

- Bug encontrado → teste de regressão ANTES do fix (commit do teste falhando + commit do fix, separados — fica visível no histórico).
- Teste flaky → corrigir ou apagar; nunca `retry` para mascarar.
- CI bloqueia merge com qualquer teste vermelho.

## Definition of Done (Fase 9)

- [ ] 6 fluxos E2E verdes local e no CI.
- [ ] `expectTenantIsolation` aplicado a 100% dos endpoints autenticados.
- [ ] Hardening: rate limit testado, headers de segurança (helmet) verificados por teste, dependências auditadas (`pnpm audit`).
- [ ] `pnpm shots` gerando o pacote completo de screenshots nos 2 temas.
- [ ] Relatório de cobertura publicado como artifact do CI.
