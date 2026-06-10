# ADR-003 — Valores monetários em centavos (inteiro)

- **Status:** aceita
- **Data:** 2026-06-10

## Contexto

Orçamentos têm itens com preço unitário, quantidade e subtotal, e o total da OS alimenta dashboard de receita. Representações possíveis: `Float` (binário, impreciso por construção — `0.1 + 0.2 !== 0.3`), `Decimal` do PostgreSQL (preciso, mas vira `Prisma.Decimal` no client: objeto que não é `number`, não serializa direto em JSON e convida a conversões espalhadas) e inteiro em centavos.

## Decisão

**Todo valor monetário é `Int` em centavos**, do banco à UI: `unitPriceCents`, `subtotalCents`, `totalCents`. A convenção faz parte do nome do campo. Aritmética (subtotal = `quantity * unitPriceCents`, total = soma dos subtotais) acontece em inteiros, dentro da transação que altera itens. Formatação para reais (R$ 1.234,56) é responsabilidade exclusiva da camada de apresentação (`Intl.NumberFormat`, helper em `packages/shared`).

## Consequências

- Soma e comparação exatas, serialização JSON trivial, sem dependência de biblioteca decimal.
- Limite de `Int` (2^31−1 centavos ≈ R$ 21,4 milhões por valor) é ordens de magnitude acima de qualquer orçamento de assistência técnica.
- Custo assumido: legibilidade no banco (123450 = R$ 1.234,50) e disciplina para nunca dividir por 100 fora da formatação. O sufixo `Cents` nos nomes e a regra inviolável nº 6 do CLAUDE.md tornam o desvio visível em review.
- Alternativas rejeitadas: `Float` (impreciso, proibido para dinheiro), `Decimal` (preciso, porém atrito de tipo no client e na serialização sem ganho real, já que centavos cobrem a granularidade necessária — não há fração de centavo no domínio).
