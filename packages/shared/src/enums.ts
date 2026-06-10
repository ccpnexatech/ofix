// Domain enums — single source of truth, mirrored in the Prisma schema (spec 002).
// Defined as const objects (not TS enums) so values stay plain string unions.

export const Role = {
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
  ATTENDANT: 'ATTENDANT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role);

export const OrderStatus = {
  RECEIVED: 'RECEIVED',
  IN_DIAGNOSIS: 'IN_DIAGNOSIS',
  QUOTE_SENT: 'QUOTE_SENT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  IN_REPAIR: 'IN_REPAIR',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
export const ORDER_STATUSES = Object.values(OrderStatus);

export const Priority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const PRIORITIES = Object.values(Priority);

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];
export const QUOTE_STATUSES = Object.values(QuoteStatus);

export const ItemKind = {
  LABOR: 'LABOR',
  PART: 'PART',
} as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];
export const ITEM_KINDS = Object.values(ItemKind);

export const ActorType = {
  USER: 'USER',
  CUSTOMER: 'CUSTOMER',
  SYSTEM: 'SYSTEM',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];
export const ACTOR_TYPES = Object.values(ActorType);
