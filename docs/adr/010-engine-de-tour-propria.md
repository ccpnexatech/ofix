# ADR-010 — Engine de tour própria em vez de driver.js/intro.js

- **Status:** aceita
- **Data:** 2026-06-11

## Contexto

A spec 009 exige tour guiado em toda tela autenticada: overlay com spotlight
recortado sobre o alvo, popover ancorado com progresso e navegação, teclado e
persistência da conclusão no banco. Bibliotecas prontas (driver.js, intro.js,
shepherd.js) entregam isso em minutos — mas com CSS próprio para sobrescrever
(briga de especificidade contra os tokens OFIX), bundle de recursos não usados
e abstrações que não falam com o nosso roteamento (App Router) nem com a
persistência em `User.completedTours`.

## Decisão

**Engine leve própria em `apps/web/src/features/tour/`** (~300 linhas):

1. `TourProvider` global + definições declarativas (`defineTour({ id, steps })`)
   com alvos por seletor `[data-tour="..."]`.
2. Spotlight: overlay fixo com recorte do retângulo do alvo via `clip-path`
   (polígono evenodd) calculado de `getBoundingClientRect`, re-medido
   periodicamente enquanto o tour está ativo (resize/scroll/late layout);
   borda âmbar sutil. Alvo fora da viewport → `scrollIntoView` antes.
3. Popover do design system (Radix) ancorado a um anchor virtual posicionado
   sobre o alvo, com fallback de colisão do próprio Radix — 100% tokens.
4. Acessibilidade: foco preso no popover, `Esc` pula, setas navegam,
   `aria-live` anuncia "passo X de Y".
5. Alvo ausente (elemento condicional, ex.: card da IA antes da Fase 11) →
   passo pulado silenciosamente com `console.warn` em dev.
6. Conclusão/pulo persiste via `PATCH /users/me/tours` — sobrevive a troca de
   dispositivo; auto-start único por tela após 800ms; botão `?` reabre.

## Consequências

- Estilo 100% pelos tokens (zero CSS de terceiros), bundle mínimo, e a engine
  é peça de demonstração de capacidade — objetivo explícito do portfólio.
- Custo: manutenção própria de medição/posicionamento. Mitigado pelo reuso do
  Radix Popover (posicionamento/colisão é dele) e por testes de componente de
  navegação, skip e alvo ausente.
- Alternativas rejeitadas: driver.js/intro.js (estilo e bundle alheios, sem
  integração com rota/persistência), shepherd.js (idem, mais pesado).
