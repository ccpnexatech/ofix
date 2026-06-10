# ADR-009 — Primitivos complexos via scaffold copiado (padrão shadcn) re-estilizado; o resto do zero

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

O design system do OFIX (spec 007) precisa de ~20 componentes. A maioria
(Button, Badge, Card, Table, StatCard...) é marcação + tokens — escrever do
zero é barato e dá controle total. Quatro são genuinamente difíceis de fazer
certo por causa de acessibilidade e foco: Dialog, DropdownMenu, Popover e
Toast (gerência de foco, aria, portais, dismissal, navegação por teclado).
Reimplementar isso é semanas de borda afiada; adotar uma lib de componentes
pronta (MUI, Mantine) imporia identidade visual alheia.

## Decisão

1. **Primitivos complexos usam Radix Primitives** (headless, acessível),
   seguindo o padrão shadcn/ui: o código do componente é **copiado para dentro
   de `apps/web/src/design-system/`** — é nosso, versionado, editável, sem
   dependência de CLI ou atualização externa.
2. **Re-estilização total pelos tokens OFIX é obrigatória**: cores, raios,
   sombras, densidade e tipografia vêm das CSS variables do tema — o resultado
   não pode ser reconhecível como shadcn default. Nenhum componente referencia
   cor crua.
3. **Todo o resto é escrito do zero** com CVA para variants tipadas: Button,
   Input/Textarea/Select, Badge/StatusBadge/PriorityBadge, Card, Table,
   StatCard, EmptyState, Skeleton, Timeline, PageHeader, Sidebar, ThemeToggle,
   Logo, Combobox e DatePicker.

## Consequências

- Acessibilidade de Dialog/menus herdada do Radix (testada por milhões de
  apps) sem herdar identidade visual de ninguém.
- O código vive no repositório: ajustar comportamento é editar o arquivo, não
  brigar com uma API de tema de terceiros.
- Custo assumido: somos donos da manutenção dos primitivos copiados (sem
  upstream automático) e do peso do Radix no bundle (aceitável: tree-shakeable,
  por primitivo).
- Alternativas rejeitadas: tudo do zero (semanas em foco/aria de Dialog sem
  valor de portfólio proporcional), lib completa estilizada (identidade visual
  de terceiros, briga de especificidade), shadcn via CLI sem re-estilizar
  (visual genérico reconhecível — proibido pela spec).
