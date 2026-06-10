import type { ItemKind } from './enums';

// Pure money math for quotes (ADR-003: integer cents only). The API recomputes
// on every item change inside the transaction; the web reuses it for live
// totals in the quote form. Client-provided subtotals are never trusted.

export interface QuoteItemInput {
  kind: ItemKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface QuoteItemWithSubtotal extends QuoteItemInput {
  subtotalCents: number;
}

export interface QuoteTotals {
  items: QuoteItemWithSubtotal[];
  totalCents: number;
}

export function calculateQuoteTotals(items: readonly QuoteItemInput[]): QuoteTotals {
  const withSubtotals = items.map((item) => ({
    ...item,
    subtotalCents: item.quantity * item.unitPriceCents,
  }));
  return {
    items: withSubtotals,
    totalCents: withSubtotals.reduce((sum, item) => sum + item.subtotalCents, 0),
  };
}
