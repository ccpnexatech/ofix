# SPEC 006 — Frontend (Rotas, Telas e Estados)

## Mapa de rotas (App Router)

```
/login
/(app)                          ← layout autenticado: sidebar, header (busca global,
                                  seletor de filial, toggle de tema, sino, avatar)
  /dashboard
  /orders                       ← tabela paginada + filtros (status, filial, técnico,
                                  prioridade) + busca; chips de filtro ativos
  /orders/new                   ← wizard 4 passos: cliente (buscar ou criar inline) →
                                  equipamento (do cliente ou novo) → problema/prioridade/
                                  filial/prazo → revisão
  /orders/[id]                  ← TELA CENTRAL (detalhe abaixo)
  /customers · /customers/[id]  ← perfil + equipamentos + histórico de OS
  /branches/map                 ← mapa interno (todas as filiais) + botão "copiar link público"
                                  ADMIN: criar/editar filial em dialog (ADR-013)
  /settings/users               ← ADMIN
/q/[token]                      ← PÁGINA PÚBLICA de orçamento (vitrine, mobile-first)
/m/[mapToken]                   ← PÁGINA PÚBLICA do mapa de filiais (compartilhável)
```

## Tela `/orders/[id]` (a mais importante)

Coluna principal: cabeçalho (code, badge de status, prioridade, filial, prazo com indicador de atraso) · cartões de cliente/equipamento · problema relatado e diagnóstico (editável conforme estado) · **orçamento** (itens, total, status, botão copiar link público, versões anteriores em accordion) · garantia (se DELIVERED: validade + botão "Reabrir em garantia"; se OS de garantia: link para a OS mãe e itens originais de referência).
Coluna lateral: **painel de transição** — botões renderizados pela MESMA máquina de estados do shared, filtrados pelo papel do usuário (matriz RN); ações destrutivas (cancelar, rejeitar) abrem Dialog com motivo obrigatório · **timeline de eventos** (auditoria, asc, com ator e horário relativo).

## Páginas públicas (vitrine do projeto)

- `/q/[token]`: identidade da empresa/filial no topo, resumo do equipamento e diagnóstico, tabela de itens com total em destaque, validade do orçamento, botões grandes Aprovar (confirm) / Recusar (motivo). Estados: aprovado ✓, recusado, expirado (410 amigável: "peça um novo orçamento"), inexistente. **Mobile-first, leve, sem JS desnecessário** — Server Component + form actions.
- `/m/[mapToken]`: mapa OpenStreetMap (react-leaflet) com pins das filiais; clique → card com nome, endereço, telefone (link `tel:`), botão "como chegar" (deep link Google Maps). Lista das filiais abaixo do mapa para acessibilidade/SEO. Sem login.

## Dashboard

Linha de StatCards (OS abertas, atrasadas ⚠, receita do mês, ticket médio, taxa de aprovação, tempo médio de reparo) · gráfico de receita 6 meses (Recharts) · donut por status · tabela "atrasadas/urgentes" com link · **seletor de filial no header** ("Todas as filiais" | filial específica) persistido na URL (`?branchId=`) — usuário com filial fixa vê o seletor travado · ADMIN: card comparativo entre filiais · card **"Análise da IA"** (spec 010). Dashboards de TECHNICIAN mostram recorte das suas OS.

## Padrões obrigatórios

- Server Components para leitura inicial; `"use client"` só com interação. Mutations via TanStack Query com invalidação por chave.
- TODA tela com os 4 estados: loading (skeleton específico), empty (EmptyState desenhado com CTA), erro (mensagem + retry), sucesso.
- Formulários: RHF + Zod resolver com schemas do shared; erros de campo inline; submit com pending state.
- Acessibilidade: navegação por teclado completa, foco visível, labels, `aria-live` em toasts, contraste AA.
- Toasts para feedback de mutação; otimismo apenas onde reversível.
- Todos os elementos-alvo do tour com `data-tour="..."` (spec 009).

## Definition of Done (Fases 6 e 7)

- [x] Todas as rotas implementadas com os 4 estados de UI. — Fases 6 e 7 ✓ (card de IA do dashboard chega com a spec 010/Fase 11)
- [x] Painel de transições 100% dirigido pela máquina de estados compartilhada (zero lógica de transição duplicada no front) — teste de componente provando botões por estado × papel. — Fase 6: `transition-panel.spec.tsx` (15 combinações)
- [x] Wizard de OS com validação por passo e criação inline de cliente/equipamento. — Fase 6
- [x] `/q/[token]` e `/m/[mapToken]` impecáveis em viewport 375px. — screenshots reais em docs/assets/
- [x] Seletor de filial persistido em URL e respeitando RN-12/RN-14. — Fase 7: seletor global no header + RN-14 na API
- [x] Lighthouse das públicas: performance e acessibilidade ≥ 90. — /q = 97/96; /m = 99/100 (build de produção, facade de mapa)
