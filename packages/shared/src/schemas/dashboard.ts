import { z } from 'zod';

import { OrderStatus } from '../enums';

// Dashboard contracts (spec 005). Definitions in docs/business-rules.md:
// revenue = APPROVED quotes of orders DELIVERED in the period (by deliveredAt);
// avg repair time = mean(deliveredAt - createdAt); overdue = promisedAt < now
// and non-terminal status.

export const dashboardQuerySchema = z.object({
  branchId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const dashboardSummarySchema = z.object({
  openOrders: z.number().int(),
  overdueOrders: z.number().int(),
  revenueCents: z.number().int(),
  avgTicketCents: z.number().int(),
  /** 0..1 — APPROVED / (APPROVED + REJECTED) decided in the period. */
  quoteApprovalRate: z.number().nullable(),
  avgRepairTimeHours: z.number().nullable(),
  deliveredCount: z.number().int(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const ordersByStatusSchema = z.array(
  z.object({ status: z.enum(OrderStatus), count: z.number().int() }),
);
export type OrdersByStatus = z.infer<typeof ordersByStatusSchema>;

export const revenueByMonthQuerySchema = z.object({
  branchId: z.uuid().optional(),
  months: z.coerce.number().int().min(1).max(24).default(6),
});
export type RevenueByMonthQuery = z.infer<typeof revenueByMonthQuerySchema>;

export const revenueByMonthSchema = z.array(
  z.object({
    /** "2026-06" */
    month: z.string(),
    revenueCents: z.number().int(),
    deliveredCount: z.number().int(),
  }),
);
export type RevenueByMonth = z.infer<typeof revenueByMonthSchema>;

export const branchesComparisonSchema = z.array(
  z.object({
    branchId: z.uuid(),
    branchName: z.string(),
    openOrders: z.number().int(),
    overdueOrders: z.number().int(),
    revenueCents: z.number().int(),
    deliveredCount: z.number().int(),
  }),
);
export type BranchesComparison = z.infer<typeof branchesComparisonSchema>;

/** GET /public/map/:mapToken (RN-15): only active branches with coordinates. */
export const publicMapResponseSchema = z.object({
  tenantName: z.string(),
  branches: z.array(
    z.object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      phone: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
});
export type PublicMapResponse = z.infer<typeof publicMapResponseSchema>;
