# SPEC 009 — Tour Guiado (Onboarding por Tela)

## Objetivo

Em toda tela autenticada existe um balão de ajuda. Ao acioná-lo (ou no primeiro acesso à tela), inicia um tour passo a passo: overlay escurece a página, o elemento-alvo ganha **foco recortado** (spotlight) e um popover ancorado exibe título + descrição + progresso (`2 de 6`) + botões Voltar/Próximo/Pular. O tour termina ao completar o fluxo daquela tela.

## Engine própria (`features/tour/`) — ADR-010

Construir engine leve própria (sem driver.js/intro.js — justificar no ADR: controle total de estilo pelos tokens, bundle mínimo, demonstração de capacidade):

- `TourProvider` (contexto global) + hook `useTour(tourId)`.
- Definições declarativas em `features/tour/tours/*.ts`:
  ```ts
  defineTour({
    id: "dashboard",
    steps: [{ target: '[data-tour="stat-cards"]', title: "...", body: "...",
              placement: "bottom", route?: "/dashboard" }, ...]
  })
  ```
- **Spotlight:** overlay fixo com recorte do retângulo do alvo (CSS `clip-path` calculado de `getBoundingClientRect`), borda âmbar animada sutil; recalcula em resize/scroll (observer). Alvo fora da viewport → scroll suave até ele antes de exibir.
- **Popover:** Radix Popover ancorado ao alvo, estilizado pelos tokens, com placement automático de fallback.
- Acessibilidade: foco preso no popover, `Esc` = pular, setas navegam, `aria-live` anuncia o passo.
- Alvo não encontrado (elemento condicional ausente) → passo é pulado silenciosamente com `console.warn` em dev.

## Persistência e disparo

- Conclusão/pulo grava o `tourId` em `User.completedTours` (`PATCH /users/me/tours` — endpoint próprio, idempotente). Persistência **no banco**, não no navegador: sobrevive a troca de dispositivo.
- Primeiro acesso a uma tela com tour não concluído → inicia automaticamente após 800ms (uma única vez).
- Botão flutuante `?` (canto inferior esquerdo, acima do balão da IA) reabre o tour da tela atual a qualquer momento.

## Tours obrigatórios (1 por tela)

| Tour | Passos mínimos |
|---|---|
| `dashboard` | StatCards → seletor de filial → gráfico de receita → atrasadas → card da IA |
| `orders-list` | Filtros → busca → badge de status → criar OS |
| `order-detail` | Cabeçalho/status → painel de transições → orçamento + link público → timeline → garantia |
| `order-new` | Os 4 passos do wizard |
| `customers` | Busca → perfil → histórico |
| `branches-map` | Mapa → pin/card → copiar link público |
| `settings-users` | Criar usuário → papéis → escopo de filial |

Textos em pt-BR, tom direto e curto (máx. 2 frases por passo), escritos junto com a spec 012 para manter consistência com o guia.

## Definition of Done (Fase 8)

- [x] Engine própria com spotlight + popover + teclado + persistência no banco. — `features/tour/` + `PATCH /users/me/tours`
- [x] 7 tours definidos e funcionando; `data-tour` presente em todos os alvos. — `features/tour/tours/index.ts`
- [x] Auto-start no primeiro acesso + reabertura manual pelo `?`. — validado no navegador (skip persiste após reload)
- [x] Teste de componente da engine (navegação, skip, alvo ausente) + E2E nº 6 cobrindo o ciclo completo. — engine (`tour.spec.tsx`) + `e2e/06-theme-tour.spec.ts`
- [x] ADR-010 escrito.
