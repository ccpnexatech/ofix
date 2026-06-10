# /checar-dod — Auditar o Definition of Done da fase

1. Identifique a fase atual em `specs/000-master.md`.
2. Rode os gates, todos devem passar sem warnings tolerados:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm test:e2e` (quando aplicável à fase)
3. Abra a spec da fase e audite o checklist de DoD item por item, citando a EVIDÊNCIA de cada um (arquivo, teste, comando executado com saída).
4. Confira: toda RN implementada na fase tem teste unitário com o código da regra no nome; decisões estruturais têm ADR em `docs/adr/`.
5. Reporte o resultado em tabela: item → status (✓/✗) → evidência.
6. Se TUDO passou: marque o checklist na spec, atualize `specs/000-master.md` (fase + coluna Status do índice) e siga o fluxo de PR (`gh pr create`).
7. Se algo falhou: liste as pendências e NÃO marque a fase.
