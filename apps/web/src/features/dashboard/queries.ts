import type {
  BranchesComparison,
  DashboardSummary,
  OrdersByStatus,
  PublicMapResponse,
  RevenueByMonth,
} from '@ofix/shared';

import { apiFetch } from '../../lib/api';

/** Standardized query keys (spec 001). */
export const dashboardKeys = {
  summary: (branchId: string | null) => ['dashboard', 'summary', branchId] as const,
  byStatus: (branchId: string | null) => ['dashboard', 'by-status', branchId] as const,
  revenue: (branchId: string | null) => ['dashboard', 'revenue', branchId] as const,
  comparison: ['dashboard', 'comparison'] as const,
  mapToken: ['branches', 'map-token'] as const,
};

function branchParam(branchId: string | null): string {
  return branchId === null ? '' : `?branchId=${branchId}`;
}

export async function getSummary(branchId: string | null): Promise<DashboardSummary> {
  return apiFetch(`/dashboard/summary${branchParam(branchId)}`);
}

export async function getOrdersByStatus(branchId: string | null): Promise<OrdersByStatus> {
  return apiFetch(`/dashboard/orders-by-status${branchParam(branchId)}`);
}

export async function getRevenueByMonth(branchId: string | null): Promise<RevenueByMonth> {
  const params = new URLSearchParams({ months: '6' });
  if (branchId !== null) {
    params.set('branchId', branchId);
  }
  return apiFetch(`/dashboard/revenue-by-month?${params.toString()}`);
}

export async function getBranchesComparison(): Promise<BranchesComparison> {
  return apiFetch('/dashboard/branches-comparison');
}

export async function getMapToken(): Promise<{ publicMapToken: string }> {
  return apiFetch('/branches/map-token');
}

export async function getPublicMap(mapToken: string): Promise<PublicMapResponse> {
  return apiFetch(`/public/map/${mapToken}`);
}
