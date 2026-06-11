import { Injectable } from '@nestjs/common';
import {
  OrderStatus,
  QuoteStatus,
  Role,
  type BranchesComparison,
  type DashboardQuery,
  type DashboardSummary,
  type OrdersByStatus,
  type RevenueByMonth,
  type RevenueByMonthQuery,
} from '@ofix/shared';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { assertBranchAccess, branchScopeWhere } from '../../common/branch-scope';
import { PrismaService } from '../../infra/prisma/prisma.service';

const TERMINAL: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELED];

function startOfMonth(date: Date, monthsBack = 0): Date {
  return new Date(date.getFullYear(), date.getMonth() - monthsBack, 1);
}

function monthKey(date: Date): string {
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * RN-14: default aggregation is the whole tenant; ?branchId filters; a
   * fixed-branch user asking for another branch gets 403 (assertBranchAccess)
   * and is otherwise pinned to their own. Technicians only see THEIR orders
   * (permission matrix).
   */
  private scope(
    user: AuthenticatedUser,
    branchId: string | undefined,
  ): Prisma.ServiceOrderWhereInput {
    if (branchId !== undefined) {
      assertBranchAccess(user, branchId);
    }
    const where: Prisma.ServiceOrderWhereInput = { ...branchScopeWhere(user) };
    if (branchId !== undefined) {
      where.branchId = branchId;
    }
    if (user.role === Role.TECHNICIAN) {
      where.assignedTechnicianId = user.id;
    }
    return where;
  }

  /** Delivered orders in the period with their approved quote total. */
  private async deliveredWithRevenue(
    scope: Prisma.ServiceOrderWhereInput,
    from: Date,
    to: Date,
  ) {
    const delivered = await this.prisma.client.serviceOrder.findMany({
      where: { ...scope, status: OrderStatus.DELIVERED, deliveredAt: { gte: from, lte: to } },
      select: {
        createdAt: true,
        deliveredAt: true,
        quotes: {
          where: { status: QuoteStatus.APPROVED },
          orderBy: { version: 'desc' },
          take: 1,
          select: { totalCents: true },
        },
      },
    });
    return delivered.map((order) => ({
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      revenueCents: order.quotes[0]?.totalCents ?? 0,
    }));
  }

  async summary(user: AuthenticatedUser, query: DashboardQuery): Promise<DashboardSummary> {
    const scope = this.scope(user, query.branchId);
    const now = new Date();
    const from = query.from ?? startOfMonth(now);
    const to = query.to ?? now;

    const [openOrders, overdueOrders, delivered, approvedQuotes, rejectedQuotes] =
      await Promise.all([
        this.prisma.client.serviceOrder.count({
          where: { ...scope, status: { notIn: TERMINAL } },
        }),
        this.prisma.client.serviceOrder.count({
          where: { ...scope, status: { notIn: TERMINAL }, promisedAt: { lt: now } },
        }),
        this.deliveredWithRevenue(scope, from, to),
        this.prisma.client.quote.count({
          where: { approvedAt: { gte: from, lte: to }, serviceOrder: scope },
        }),
        this.prisma.client.quote.count({
          where: { rejectedAt: { gte: from, lte: to }, serviceOrder: scope },
        }),
      ]);

    const revenueCents = delivered.reduce((sum, order) => sum + order.revenueCents, 0);
    const deliveredCount = delivered.length;
    const repairTimes = delivered.flatMap((order) =>
      order.deliveredAt === null
        ? []
        : [(order.deliveredAt.getTime() - order.createdAt.getTime()) / 3_600_000],
    );
    const decided = approvedQuotes + rejectedQuotes;

    return {
      openOrders,
      overdueOrders,
      revenueCents,
      avgTicketCents: deliveredCount === 0 ? 0 : Math.round(revenueCents / deliveredCount),
      quoteApprovalRate: decided === 0 ? null : approvedQuotes / decided,
      avgRepairTimeHours:
        repairTimes.length === 0
          ? null
          : Math.round((repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length) * 10) / 10,
      deliveredCount,
    };
  }

  async ordersByStatus(
    user: AuthenticatedUser,
    branchId: string | undefined,
  ): Promise<OrdersByStatus> {
    const scope = this.scope(user, branchId);
    const grouped = await this.prisma.client.serviceOrder.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    });
    return Object.values(OrderStatus).map((status) => ({
      status,
      count: grouped.find((g) => g.status === status)?._count._all ?? 0,
    }));
  }

  async revenueByMonth(
    user: AuthenticatedUser,
    query: RevenueByMonthQuery,
  ): Promise<RevenueByMonth> {
    const scope = this.scope(user, query.branchId);
    const now = new Date();
    const from = startOfMonth(now, query.months - 1);
    const delivered = await this.deliveredWithRevenue(scope, from, now);

    const buckets = new Map<string, { revenueCents: number; deliveredCount: number }>();
    for (let i = query.months - 1; i >= 0; i -= 1) {
      buckets.set(monthKey(startOfMonth(now, i)), { revenueCents: 0, deliveredCount: 0 });
    }
    for (const order of delivered) {
      if (order.deliveredAt === null) {
        continue;
      }
      const bucket = buckets.get(monthKey(order.deliveredAt));
      if (bucket) {
        bucket.revenueCents += order.revenueCents;
        bucket.deliveredCount += 1;
      }
    }
    return Array.from(buckets, ([month, data]) => ({ month, ...data }));
  }

  /** ADMIN-only comparative table (spec 005); revenue = current month. */
  async branchesComparison(user: AuthenticatedUser): Promise<BranchesComparison> {
    const branches = await this.prisma.client.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    const now = new Date();
    const from = startOfMonth(now);

    return Promise.all(
      branches.map(async (branch) => {
        const scope = this.scope(user, branch.id);
        const [openOrders, overdueOrders, delivered] = await Promise.all([
          this.prisma.client.serviceOrder.count({
            where: { ...scope, status: { notIn: TERMINAL } },
          }),
          this.prisma.client.serviceOrder.count({
            where: { ...scope, status: { notIn: TERMINAL }, promisedAt: { lt: now } },
          }),
          this.deliveredWithRevenue(scope, from, now),
        ]);
        return {
          branchId: branch.id,
          branchName: branch.name,
          openOrders,
          overdueOrders,
          revenueCents: delivered.reduce((sum, order) => sum + order.revenueCents, 0),
          deliveredCount: delivered.length,
        };
      }),
    );
  }
}
