import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  OrderStatus,
  Role,
  pageMeta,
  type AssignTechnicianBody,
  type CreateOrderBody,
  type ListOrdersQuery,
  type UpdateOrderBody,
} from '@ofix/shared';
import { ActorType } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { assertBranchAccess, branchScopeWhere } from '../../common/branch-scope';
import { PrismaService, type TenantTransactionClient } from '../../infra/prisma/prisma.service';
import { currentTenantId } from '../../infra/prisma/tenant-context';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';
import { ORDER_DETAIL_INCLUDE, OrdersRepository } from './orders.repository';

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.DELIVERED,
  OrderStatus.CANCELED,
]);

/**
 * Editable fields per status (spec 005: "campos editáveis variam por estado").
 * Diagnosis and reported issue freeze once a quote is sent — they are the
 * basis of what the customer approved; priority/promisedAt stay editable
 * until a terminal status.
 */
const FIELD_EDITABLE_STATUSES: Record<keyof UpdateOrderBody, ReadonlySet<OrderStatus>> = {
  reportedIssue: new Set([OrderStatus.RECEIVED, OrderStatus.IN_DIAGNOSIS]),
  technicalDiagnosis: new Set([OrderStatus.RECEIVED, OrderStatus.IN_DIAGNOSIS]),
  priority: new Set(Object.values(OrderStatus).filter((s) => !TERMINAL_STATUSES.has(s))),
  promisedAt: new Set(Object.values(OrderStatus).filter((s) => !TERMINAL_STATUSES.has(s))),
};

/** Generates the next per-tenant+year order code atomically (RN-10/RN-13). */
export async function nextOrderCode(
  tx: TenantTransactionClient,
  tenantId: string,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  // INSERT ... ON CONFLICT keeps this race-free; the increment takes a row lock.
  await tx.orderCodeSequence.upsert({
    where: { tenantId_year: { tenantId, year } },
    create: { tenantId, year, lastValue: 0 },
    update: {},
  });
  const sequence = await tx.orderCodeSequence.update({
    where: { tenantId_year: { tenantId, year } },
    data: { lastValue: { increment: 1 } },
  });
  return `OS-${String(year)}-${String(sequence.lastValue).padStart(4, '0')}`;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: OrdersRepository,
  ) {}

  async list(query: ListOrdersQuery, user: AuthenticatedUser) {
    // RN-12: a fixed-branch user asking for another branch gets 403; without
    // an explicit branchId the scope filter forces their own branch.
    if (query.branchId !== undefined) {
      assertBranchAccess(user, query.branchId);
    }
    const { data, total } = await this.repository.list(query, branchScopeWhere(user));
    return { data, meta: pageMeta(query, total) };
  }

  /** Loads the order and enforces branch scope (RN-12). */
  async getScoped(id: string, user: AuthenticatedUser) {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new NotFoundException('OS não encontrada');
    }
    assertBranchAccess(user, order.branchId);
    return order;
  }

  async getDetail(id: string, user: AuthenticatedUser) {
    await this.getScoped(id, user);
    return this.repository.findDetailById(id);
  }

  async listEvents(id: string, user: AuthenticatedUser) {
    await this.getScoped(id, user);
    return this.repository.listEvents(id);
  }

  async create(body: CreateOrderBody, user: AuthenticatedUser) {
    assertBranchAccess(user, body.branchId); // RN-12: create only in own branch

    const [branch, customer, equipment] = await Promise.all([
      this.prisma.client.branch.findUnique({ where: { id: body.branchId } }),
      this.prisma.client.customer.findUnique({ where: { id: body.customerId } }),
      this.prisma.client.equipment.findUnique({ where: { id: body.equipmentId } }),
    ]);
    if (!branch?.isActive) {
      throw new UnprocessableEntityException('Filial inválida ou inativa');
    }
    if (!customer) {
      throw new UnprocessableEntityException('Cliente inválido');
    }
    if (equipment?.customerId !== customer.id) {
      throw new UnprocessableEntityException('Equipamento inválido ou não pertence ao cliente');
    }

    const tenantId = this.requireTenantId();
    // RN-09/RN-10: code generation, order and audit event share one transaction.
    return this.prisma.client.$transaction(async (tx) => {
      const code = await nextOrderCode(tx, tenantId);
      const order = await tx.serviceOrder.create({
        data: {
          tenantId: TENANT_INJECTED,
          branchId: body.branchId,
          customerId: body.customerId,
          equipmentId: body.equipmentId,
          reportedIssue: body.reportedIssue,
          priority: body.priority,
          promisedAt: body.promisedAt,
          code,
          createdById: user.id,
        },
        include: ORDER_DETAIL_INCLUDE,
      });
      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: order.id,
          actorType: ActorType.USER,
          actorId: user.id,
          type: 'ORDER_CREATED',
          toStatus: order.status,
        },
      });
      return order;
    });
  }

  async assign(id: string, body: AssignTechnicianBody, user: AuthenticatedUser) {
    const order = await this.getScoped(id, user);
    if (TERMINAL_STATUSES.has(order.status)) {
      throw new UnprocessableEntityException('OS encerrada não aceita atribuição de técnico');
    }
    const technician = await this.prisma.client.user.findUnique({
      where: { id: body.technicianId },
    });
    if (!technician || !technician.isActive || technician.role !== Role.TECHNICIAN) {
      throw new UnprocessableEntityException('Técnico inválido');
    }
    if (technician.branchId !== null && technician.branchId !== order.branchId) {
      throw new UnprocessableEntityException('Técnico pertence a outra filial');
    }

    return this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: { assignedTechnicianId: technician.id },
      });
      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: order.id,
          actorType: ActorType.USER,
          actorId: user.id,
          type: 'TECHNICIAN_ASSIGNED',
          metadata: { technicianId: technician.id, technicianName: technician.name },
        },
      });
      return updated;
    });
  }

  async update(id: string, body: UpdateOrderBody, user: AuthenticatedUser) {
    const order = await this.getScoped(id, user);

    // Role-level field rules: technicians only write their diagnosis (on their
    // own orders); attendants never touch the technical diagnosis.
    const fields = Object.keys(body) as (keyof UpdateOrderBody)[];
    if (user.role === Role.TECHNICIAN) {
      if (fields.some((field) => field !== 'technicalDiagnosis')) {
        throw new ForbiddenException('Técnico só edita o diagnóstico técnico');
      }
      if (order.assignedTechnicianId !== user.id) {
        throw new ForbiddenException('Técnico só edita OS atribuídas a si');
      }
    }
    if (user.role === Role.ATTENDANT && fields.includes('technicalDiagnosis')) {
      throw new ForbiddenException('Atendente não edita o diagnóstico técnico');
    }

    for (const field of fields) {
      if (!FIELD_EDITABLE_STATUSES[field].has(order.status)) {
        throw new UnprocessableEntityException(
          `Campo ${field} não é editável no status ${order.status}`,
        );
      }
    }

    return this.prisma.client.serviceOrder.update({ where: { id: order.id }, data: body });
  }

  private requireTenantId(): string {
    const tenantId = currentTenantId();
    if (tenantId === undefined) {
      // Unreachable behind the auth guard; fail loudly if wiring breaks.
      throw new Error('Tenant context missing in OrdersService');
    }
    return tenantId;
  }
}
