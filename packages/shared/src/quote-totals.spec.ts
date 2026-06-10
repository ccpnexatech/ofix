import { describe, expect, it } from 'vitest';

import { ItemKind } from './enums';
import { calculateQuoteTotals } from './quote-totals';

describe('calculateQuoteTotals (ADR-003: integer cents)', () => {
  it('computes subtotals and total from quantity x unit price', () => {
    const totals = calculateQuoteTotals([
      { kind: ItemKind.PART, description: 'Tela 15.6', quantity: 1, unitPriceCents: 45000 },
      { kind: ItemKind.LABOR, description: 'Troca de tela', quantity: 2, unitPriceCents: 8000 },
    ]);
    expect(totals.items.map((i) => i.subtotalCents)).toEqual([45000, 16000]);
    expect(totals.totalCents).toBe(61000);
  });

  it('handles the empty quote and zero-priced warranty labor (RN-07)', () => {
    expect(calculateQuoteTotals([]).totalCents).toBe(0);
    const warranty = calculateQuoteTotals([
      { kind: ItemKind.LABOR, description: 'Garantia — Troca de tela', quantity: 1, unitPriceCents: 0 },
    ]);
    expect(warranty.totalCents).toBe(0);
  });

  it('stays exact for values that break floats', () => {
    const totals = calculateQuoteTotals([
      { kind: ItemKind.PART, description: 'Peça', quantity: 3, unitPriceCents: 1 },
      { kind: ItemKind.PART, description: 'Peça 2', quantity: 1, unitPriceCents: 2 },
    ]);
    expect(totals.totalCents).toBe(5); // 0.1 + 0.2 style sums never drift in cents
  });
});
