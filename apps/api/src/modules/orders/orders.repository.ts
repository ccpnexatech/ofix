import { Injectable } from '@nestjs/common';
import type { ListOrdersQuery } from '@ofix/shared';
import type { Prisma } from '@prisma/client';

import { pageArgs } from '../../common/pagination';
import { PrismaService } from '../../infra/prisma/prisma.service';

export const ORDER_LIST_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  equipment: { select: { id: true, type: true, brand: true, model: true } },
  branch: { select: { id: true, name: true } },
  assignedTechnician: { select: { id: true, name: true } },
} satisfies Prisma.ServiceOrderInclude;

export const ORDER_DETAIL_INCLUDE = {
  ...ORDER_LIST_INCLUDE,
  customer: { select: { id: true, name: true, phone: true, email: true } },
  // All versions, newest first — the web shows the active quote plus the
  // previous-versions accordion (spec 006).
  quotes: {
    orderBy: { version: 'desc' as const },
    include: { items: true },
  },
} satisfies Prisma.ServiceOrderInclude;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  private listWhere(query: ListOrdersQuery): Prisma.ServiceOrderWhereInput {
    const where: Prisma.ServiceOrderWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.branchId !== undefined) {
      where.branchId = query.branchId;
    }
    if (query.technicianId !== undefined) {
      where.assignedTechnicianId = query.technicianId;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.search !== undefined) {
      // Search covers order code, customer name and equipment (spec 005).
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
        { equipment: { brand: { contains: query.search, mode: 'insensitive' } } },
        { equipment: { model: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  async list(query: ListOrdersQuery, extraWhere: Prisma.ServiceOrderWhereInput = {}) {
    const where: Prisma.ServiceOrderWhereInput = { AND: [this.listWhere(query), extraWhere] };
    const [data, total] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.client.serviceOrder.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.client.serviceOrder.findUnique({ where: { id } });
  }

  async findDetailById(id: string) {
    return this.prisma.client.serviceOrder.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
  }

  async listEvents(serviceOrderId: string) {
    return this.prisma.client.orderEvent.findMany({
      where: { serviceOrderId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
