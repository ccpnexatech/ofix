import type {
  BranchSummary,
  ItemKind,
  OrderStatus,
  PageMeta,
  Priority,
  QuoteStatus,
} from '@ofix/shared';

// Shapes returned by the API (Prisma entities + includes, spec 005).

export interface OrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  priority: Priority;
  branchId: string;
  promisedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  equipment: { id: string; type: string; brand: string; model: string };
  branch: { id: string; name: string };
  assignedTechnician: { id: string; name: string } | null;
}

export interface QuoteItemView {
  id: string;
  kind: ItemKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface QuoteView {
  id: string;
  version: number;
  status: QuoteStatus;
  publicToken: string;
  tokenExpiresAt: string | null;
  totalCents: number;
  rejectionReason: string | null;
  items: QuoteItemView[];
}

export interface OrderDetail extends OrderListItem {
  reportedIssue: string;
  technicalDiagnosis: string | null;
  warrantyParentId: string | null;
  deliveredAt: string | null;
  warrantyUntil: string | null;
  canceledReason: string | null;
  customer: { id: string; name: string; phone: string; email: string | null };
  quotes: QuoteView[];
}

export interface OrderEventView {
  id: string;
  actorType: 'USER' | 'CUSTOMER' | 'SYSTEM';
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export type Branch = BranchSummary;
