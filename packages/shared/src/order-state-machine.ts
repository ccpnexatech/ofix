import { OrderStatus, QuoteStatus, Role } from './enums';

// Pure state machine of the service order (spec 004). API and web consume the
// SAME functions: the API to validate transitions, the web to decide which
// action buttons to render. No framework, no I/O — testable in milliseconds.

export const OrderAction = {
  START_DIAGNOSIS: 'START_DIAGNOSIS',
  SEND_QUOTE: 'SEND_QUOTE',
  APPROVE_QUOTE: 'APPROVE_QUOTE',
  REJECT_QUOTE: 'REJECT_QUOTE',
  START_REPAIR: 'START_REPAIR',
  MARK_READY: 'MARK_READY',
  DELIVER: 'DELIVER',
  CANCEL: 'CANCEL',
} as const;
export type OrderAction = (typeof OrderAction)[keyof typeof OrderAction];
export const ORDER_ACTIONS = Object.values(OrderAction);

/**
 * Status-changing transitions. REOPEN_WARRANTY is deliberately NOT here: it
 * never transitions the original order (DELIVERED is terminal) — it creates a
 * linked child order, validated by canReopenWarranty (RN-07, ADR-006).
 */
const TRANSITIONS: Readonly<Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>>> = {
  RECEIVED: {
    START_DIAGNOSIS: OrderStatus.IN_DIAGNOSIS,
    CANCEL: OrderStatus.CANCELED,
  },
  IN_DIAGNOSIS: {
    SEND_QUOTE: OrderStatus.QUOTE_SENT,
    CANCEL: OrderStatus.CANCELED,
  },
  QUOTE_SENT: {
    // Self-transition: expired/superseded quote gets a new version (RN-05).
    SEND_QUOTE: OrderStatus.QUOTE_SENT,
    APPROVE_QUOTE: OrderStatus.APPROVED,
    REJECT_QUOTE: OrderStatus.REJECTED,
    CANCEL: OrderStatus.CANCELED,
  },
  APPROVED: {
    START_REPAIR: OrderStatus.IN_REPAIR,
    CANCEL: OrderStatus.CANCELED,
  },
  REJECTED: {
    SEND_QUOTE: OrderStatus.QUOTE_SENT,
    CANCEL: OrderStatus.CANCELED,
  },
  IN_REPAIR: {
    MARK_READY: OrderStatus.READY,
    CANCEL: OrderStatus.CANCELED,
  },
  READY: {
    DELIVER: OrderStatus.DELIVERED,
    CANCEL: OrderStatus.CANCELED,
  },
  DELIVERED: {}, // terminal — warranty creates a NEW linked order (RN-07)
  CANCELED: {}, // terminal
};

/** Data the precondition validators need; the API builds it from the database. */
export interface TransitionContext {
  /** RN-02: START_DIAGNOSIS requires an assigned technician. */
  hasAssignedTechnician?: boolean;
  /** RN-03: SEND_QUOTE requires a diagnosis with at least 20 chars. */
  technicalDiagnosis?: string | null;
  /** RN-03: SEND_QUOTE requires a DRAFT quote with >= 1 item and total > 0. */
  activeQuote?: { status: QuoteStatus; itemCount: number; totalCents: number } | null;
  /** RN-04 (reject >= 5 chars) and RN-08 (cancel >= 10 chars). */
  reason?: string;
}

export type TransitionCheck = Readonly<
  { ok: true; nextStatus: OrderStatus } | { ok: false; code: string; message: string }
>;

function invalid(code: string, message: string): TransitionCheck {
  return { ok: false, code, message };
}

const PRECONDITIONS: Partial<
  Record<OrderAction, (ctx: TransitionContext) => TransitionCheck | undefined>
> = {
  START_DIAGNOSIS: (ctx) =>
    ctx.hasAssignedTechnician === true
      ? undefined
      : invalid('RN-02', 'A OS precisa de um técnico atribuído antes do diagnóstico'),
  SEND_QUOTE: (ctx) => {
    if ((ctx.technicalDiagnosis ?? '').trim().length < 20) {
      return invalid('RN-03', 'O diagnóstico técnico deve ter no mínimo 20 caracteres');
    }
    const quote = ctx.activeQuote;
    if (quote?.status !== QuoteStatus.DRAFT) {
      return invalid('RN-03', 'É necessário um orçamento em rascunho para enviar');
    }
    if (quote.itemCount < 1 || quote.totalCents <= 0) {
      return invalid('RN-03', 'O orçamento precisa de ao menos 1 item e total maior que zero');
    }
    return undefined;
  },
  REJECT_QUOTE: (ctx) =>
    (ctx.reason ?? '').trim().length >= 5
      ? undefined
      : invalid('RN-04', 'A recusa exige um motivo com no mínimo 5 caracteres'),
  CANCEL: (ctx) =>
    (ctx.reason ?? '').trim().length >= 10
      ? undefined
      : invalid('RN-08', 'O cancelamento exige um motivo com no mínimo 10 caracteres'),
};

/** RN-01 only: is the pair (status, action) in the transition map? */
export function nextStatus(from: OrderStatus, action: OrderAction): OrderStatus | undefined {
  return TRANSITIONS[from][action];
}

/** RN-01 + per-action preconditions. The single source of transition truth. */
export function canTransition(
  from: OrderStatus,
  action: OrderAction,
  ctx: TransitionContext = {},
): TransitionCheck {
  const to = nextStatus(from, action);
  if (to === undefined) {
    return invalid('RN-01', `Ação ${action} não é permitida no status ${from}`);
  }
  const failed = PRECONDITIONS[action]?.(ctx);
  return failed ?? { ok: true, nextStatus: to };
}

/** Actions a technician may execute, restricted to orders assigned to them. */
const TECHNICIAN_ACTIONS: ReadonlySet<OrderAction> = new Set([
  OrderAction.START_DIAGNOSIS,
  OrderAction.SEND_QUOTE,
  OrderAction.START_REPAIR,
  OrderAction.MARK_READY,
]);

export interface ActionActor {
  role: Role;
  /** Whether the actor is the technician assigned to THIS order. */
  isAssignedTechnician: boolean;
}

/**
 * Permission matrix for transitions (spec 004) — single source for the API
 * guard and for which buttons the web renders (spec 006).
 */
export function canRoleExecuteAction(actor: ActionActor, action: OrderAction): boolean {
  if (actor.role === Role.ADMIN) {
    return true;
  }
  if (actor.role === Role.TECHNICIAN) {
    return TECHNICIAN_ACTIONS.has(action) && actor.isAssignedTechnician;
  }
  // ATTENDANT: only DELIVER goes through the transition endpoint.
  return action === OrderAction.DELIVER;
}

export interface WarrantyReopenContext {
  warrantyUntil: Date | null;
  now?: Date;
}

/** RN-07: reopening is only possible while the original warranty is valid. */
export function canReopenWarranty(
  status: OrderStatus,
  ctx: WarrantyReopenContext,
): TransitionCheck {
  if (status !== OrderStatus.DELIVERED) {
    return invalid('RN-07', 'Somente OS entregues podem ser reabertas em garantia');
  }
  const now = ctx.now ?? new Date();
  if (ctx.warrantyUntil === null || now.getTime() > ctx.warrantyUntil.getTime()) {
    const limit = ctx.warrantyUntil
      ? ctx.warrantyUntil.toISOString().slice(0, 10)
      : 'indisponível';
    return invalid('RN-07', `Garantia expirada (válida até ${limit})`);
  }
  return { ok: true, nextStatus: OrderStatus.RECEIVED };
}
