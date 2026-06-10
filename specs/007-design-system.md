# SPEC 007 — Design System e Identidade Visual

## Identidade OFIX

Conceito: **oficina moderna** — precisão técnica com calor humano. Primária âmbar/laranja queimado sobre neutros levemente quentes. Visual limpo, denso de informação sem poluição, status sempre comunicado por cor + ícone + texto (nunca só cor).

**Logo tipográfica:** "ofix" minúsculo, peso 700, com o ponto do "i" em âmbar. Gerar como componente SVG (`<Logo />`) com variantes full/ícone e claro/escuro.

## Tipografia (OBRIGATÓRIO — fontes modernas e usuais, via `next/font`, self-hosted)

- **UI / texto:** `Inter` (variable) — `font-feature-settings: "cv11", "ss01"` e **`tabular-nums` em qualquer número** (tabelas, valores, métricas).
- **Display (títulos de páginas públicas e logo):** `Sora` — dá personalidade sem excentricidade.
- **Mono (códigos de OS, tokens, valores em tabelas técnicas):** `JetBrains Mono`.
- Proibido: fonte serifada como padrão de UI, fontes default de sistema sem fallback definido, e qualquer "fonte de IA". Escala tipográfica: 12 / 14 (base) / 16 / 18 / 24 / 30 / 38, line-height 1.5 em texto e 1.2 em headings.

## Tokens (Tailwind v4 — `@theme` com CSS variables)

```css
@theme {
  /* Marca */
  --color-brand-50..950        /* âmbar: 500 = #F59E0B aprox., calibrar contraste AA */
  /* Neutros quentes (stone-like) */
  --color-surface, --color-surface-raised, --color-surface-sunken
  --color-border, --color-border-strong
  --color-text, --color-text-muted, --color-text-faint
  /* Semânticas */
  --color-success-* --color-warning-* --color-danger-* --color-info-*
  /* Status da OS (1 token por status — usados nos Badges e no donut) */
  --status-received --status-in-diagnosis --status-quote-sent --status-approved
  --status-rejected --status-in-repair --status-ready --status-delivered --status-canceled
  /* Geometria */
  --radius-sm 6px  --radius-md 10px  --radius-lg 16px
  --shadow-sm/md/lg (sombras suaves, nunca pretas puras)
  /* Espaçamento em escala de 4px */
}
```

**Temas:** claro/escuro via `data-theme` no `<html>`, respeitando `prefers-color-scheme` na primeira visita, persistido em cookie (sem flash — script inline no head). Os tokens trocam de valor; componentes NUNCA referenciam cor crua.

## Estratégia de componentes (ADR-009)

Permitido usar **shadcn/ui como scaffold copiado para dentro do projeto** apenas em primitivos complexos (Dialog, DropdownMenu, Popover, Toast — que já usam Radix), mas com **re-estilização total pelos tokens OFIX**: o resultado final não pode ser reconhecível como shadcn default (cores, raios, sombras, densidade e tipografia próprios). Componentes simples (Button, Input, Badge, Card, Table, StatCard, EmptyState, Skeleton, Timeline, StatusBadge) são escritos do zero. Tudo vive em `apps/web/src/design-system/` com API tipada por variants (CVA).

## Inventário mínimo

Button (primary/secondary/ghost/danger × sm/md/lg, loading) · Input/Textarea/Select/Combobox (busca de cliente) · DatePicker simples · Badge + **StatusBadge** (um por status, token próprio, com ícone) · PriorityBadge · Card · Table (densa, header sticky, tabular-nums) · Dialog · DropdownMenu · Toast · Tabs · Skeleton · EmptyState (ilustração SVG própria simples) · Timeline · StatCard (valor + delta) · PageHeader · Sidebar/Nav · ThemeToggle · Logo.

## Definition of Done (Fase 5)

- [ ] Tokens completos nos 2 temas, com contraste AA verificado nos pares texto/superfície.
- [ ] Fontes via next/font sem layout shift (verificar com throttling).
- [ ] Inventário implementado com testes de componente dos críticos (Button, StatusBadge, Dialog, Table).
- [ ] Rota interna `/design` (dev-only) exibindo todos os componentes nos 2 temas — serve de homologação visual e fonte dos screenshots.
- [ ] `docs/design-system.md` com a filosofia, tokens e screenshot da rota `/design` nos 2 temas.
- [ ] ADR-009 (scaffold shadcn re-estilizado vs. tudo do zero) escrito.
