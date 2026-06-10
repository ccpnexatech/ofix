import { describe, expect, it } from 'vitest';

import { OrderStatus, QuoteStatus } from './enums';
import {
  ORDER_ACTIONS,
  OrderAction,
  canReopenWarranty,
  canTransition,
  nextStatus,
  type TransitionContext,
} from './order-state-machine';

/** Context that satisfies every per-action precondition. */
const SATISFYING_CONTEXT: TransitionContext = {
  hasAssignedTechnician: true,
  technicalDiagnosis: 'Fonte queimada por surto elétrico; substituição necessária.',
  activeQuote: { status: QuoteStatus.DRAFT, itemCount: 2, totalCents: 45000 },
  reason: 'Cliente desistiu do reparo por causa do valor.',
};

/** The complete set of valid (status, action, next) triples — spec 004 diagram. */
const VALID_TRANSITIONS: [OrderStatus, OrderAction, OrderStatus][] = [
  [OrderStatus.RECEIVED, OrderAction.START_DIAGNOSIS, OrderStatus.IN_DIAGNOSIS],
  [OrderStatus.RECEIVED, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.IN_DIAGNOSIS, OrderAction.SEND_QUOTE, OrderStatus.QUOTE_SENT],
  [OrderStatus.IN_DIAGNOSIS, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.QUOTE_SENT, OrderAction.SEND_QUOTE, OrderStatus.QUOTE_SENT],
  [OrderStatus.QUOTE_SENT, OrderAction.APPROVE_QUOTE, OrderStatus.APPROVED],
  [OrderStatus.QUOTE_SENT, OrderAction.REJECT_QUOTE, OrderStatus.REJECTED],
  [OrderStatus.QUOTE_SENT, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.APPROVED, OrderAction.START_REPAIR, OrderStatus.IN_REPAIR],
  [OrderStatus.APPROVED, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.REJECTED, OrderAction.SEND_QUOTE, OrderStatus.QUOTE_SENT],
  [OrderStatus.REJECTED, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.IN_REPAIR, OrderAction.MARK_READY, OrderStatus.READY],
  [OrderStatus.IN_REPAIR, OrderAction.CANCEL, OrderStatus.CANCELED],
  [OrderStatus.READY, OrderAction.DELIVER, OrderStatus.DELIVERED],
  [OrderStatus.READY, OrderAction.CANCEL, OrderStatus.CANCELED],
];

function isValid(status: OrderStatus, action: OrderAction): boolean {
  return VALID_TRANSITIONS.some(([from, a]) => from === status && a === action);
}

describe('order state machine — full transition coverage', () => {
  it.each(VALID_TRANSITIONS)(
    'allows %s + %s -> %s with satisfied preconditions',
    (from, action, to) => {
      const check = canTransition(from, action, SATISFYING_CONTEXT);
      expect(check).toEqual({ ok: true, nextStatus: to });
      expect(nextStatus(from, action)).toBe(to);
    },
  );

  // RN-01: cartesian product status x action; every pair outside the map fails.
  const invalidPairs = Object.values(OrderStatus).flatMap((status) =>
    ORDER_ACTIONS.filter((action) => !isValid(status, action)).map(
      (action) => [status, action] as const,
    ),
  );

  it.each(invalidPairs)('RN-01: invalid transition %s + %s is rejected', (status, action) => {
    const check = canTransition(status, action, SATISFYING_CONTEXT);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.code).toBe('RN-01');
    }
    expect(nextStatus(status, action)).toBeUndefined();
  });

  it('covers the whole cartesian product (sanity)', () => {
    const total = Object.values(OrderStatus).length * ORDER_ACTIONS.length;
    expect(VALID_TRANSITIONS.length + invalidPairs.length).toBe(total);
  });

  it('DELIVERED and CANCELED are terminal for every action', () => {
    for (const action of ORDER_ACTIONS) {
      expect(canTransition(OrderStatus.DELIVERED, action, SATISFYING_CONTEXT).ok).toBe(false);
      expect(canTransition(OrderStatus.CANCELED, action, SATISFYING_CONTEXT).ok).toBe(false);
    }
  });
});

describe('per-action preconditions', () => {
  it('RN-02: START_DIAGNOSIS requires an assigned technician', () => {
    const check = canTransition(OrderStatus.RECEIVED, OrderAction.START_DIAGNOSIS, {
      hasAssignedTechnician: false,
    });
    expect(check).toMatchObject({ ok: false, code: 'RN-02' });
  });

  it('RN-03: SEND_QUOTE requires a diagnosis with at least 20 chars', () => {
    const check = canTransition(OrderStatus.IN_DIAGNOSIS, OrderAction.SEND_QUOTE, {
      ...SATISFYING_CONTEXT,
      technicalDiagnosis: 'curto demais',
    });
    expect(check).toMatchObject({ ok: false, code: 'RN-03' });
  });

  it('RN-03: SEND_QUOTE requires a DRAFT quote', () => {
    for (const activeQuote of [
      null,
      { status: QuoteStatus.SENT, itemCount: 2, totalCents: 1000 },
    ]) {
      const check = canTransition(OrderStatus.IN_DIAGNOSIS, OrderAction.SEND_QUOTE, {
        ...SATISFYING_CONTEXT,
        activeQuote,
      });
      expect(check).toMatchObject({ ok: false, code: 'RN-03' });
    }
  });

  it('RN-03: SEND_QUOTE requires >= 1 item and total > 0', () => {
    for (const activeQuote of [
      { status: QuoteStatus.DRAFT, itemCount: 0, totalCents: 1000 },
      { status: QuoteStatus.DRAFT, itemCount: 1, totalCents: 0 },
    ]) {
      const check = canTransition(OrderStatus.IN_DIAGNOSIS, OrderAction.SEND_QUOTE, {
        ...SATISFYING_CONTEXT,
        activeQuote,
      });
      expect(check).toMatchObject({ ok: false, code: 'RN-03' });
    }
  });

  it('RN-04: REJECT_QUOTE requires a reason with at least 5 chars', () => {
    const tooShort = canTransition(OrderStatus.QUOTE_SENT, OrderAction.REJECT_QUOTE, {
      reason: 'caro',
    });
    expect(tooShort).toMatchObject({ ok: false, code: 'RN-04' });
    const ok = canTransition(OrderStatus.QUOTE_SENT, OrderAction.REJECT_QUOTE, {
      reason: 'muito caro',
    });
    expect(ok.ok).toBe(true);
  });

  it('RN-08: CANCEL requires a reason with at least 10 chars', () => {
    const tooShort = canTransition(OrderStatus.RECEIVED, OrderAction.CANCEL, {
      reason: 'desistiu',
    });
    expect(tooShort).toMatchObject({ ok: false, code: 'RN-08' });
    const ok = canTransition(OrderStatus.RECEIVED, OrderAction.CANCEL, {
      reason: 'cliente desistiu do reparo',
    });
    expect(ok.ok).toBe(true);
  });

  it('RN-08: CANCEL is forbidden from DELIVERED', () => {
    const check = canTransition(OrderStatus.DELIVERED, OrderAction.CANCEL, {
      reason: 'cliente desistiu do reparo',
    });
    expect(check).toMatchObject({ ok: false, code: 'RN-01' });
  });
});

describe('RN-07: warranty reopen', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('RN-07: allows reopening a DELIVERED order within warranty', () => {
    const check = canReopenWarranty(OrderStatus.DELIVERED, { warrantyUntil: future });
    expect(check).toEqual({ ok: true, nextStatus: OrderStatus.RECEIVED });
  });

  it('RN-07: warranty reopen blocks after warrantyUntil, citing the date', () => {
    const check = canReopenWarranty(OrderStatus.DELIVERED, { warrantyUntil: past });
    expect(check).toMatchObject({ ok: false, code: 'RN-07' });
    if (!check.ok) {
      expect(check.message).toContain(past.toISOString().slice(0, 10));
    }
  });

  it('RN-07: only DELIVERED orders can be reopened', () => {
    const check = canReopenWarranty(OrderStatus.READY, { warrantyUntil: future });
    expect(check).toMatchObject({ ok: false, code: 'RN-07' });
  });

  it('RN-07: missing warrantyUntil blocks reopening', () => {
    const check = canReopenWarranty(OrderStatus.DELIVERED, { warrantyUntil: null });
    expect(check).toMatchObject({ ok: false, code: 'RN-07' });
  });
});
