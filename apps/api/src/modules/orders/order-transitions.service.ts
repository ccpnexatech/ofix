import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  OrderAction,
  OrderStatus,
  Priority,
  QuoteStatus,
  Role,
  canReopenWarranty,
  canTransition,
  type TransitionBody,
  type TransitionContext,
} from '@ofix/shared';
import { ActorType, type ServiceOrder } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { InvalidTransitionError, WarrantyReopenError } from '../../common/errors/domain.errors';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentTenantId } from '../../infra/prisma/tenant-context';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';
import { ORDER_DETAIL_INCLUDE } from './orders.repository';
import { OrdersService, nextOrderCode } from './orders.service';
import { QuoteExpirationService } from './quote-expiration.service';

export const QUOTE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // RN-03: 7 days

/** Actions a technician may execute, restricted to orders assigned to them. */
const TECHNICIAN_ACTIONS: ReadonlySet<OrderAction> = new Set([
  OrderAction.START_DIAGNOSIS,
  OrderAction.SEND_QUOTE,
  OrderAction.START_REPAIR,
  OrderAction.MARK_READY,
]);

/** Who is performing the transition — staff (USER) or the customer via public token. */
export interface TransitionActor {
  type: ActorType;
  id: string | null;
  /** RN-04: how a quote decision was made. */
  method?: 'in_person' | 'public_token';
}

/** Permission matrix for transitions (spec 004), tested tabularly. */
function assertActionPermitted(
  user: AuthenticatedUser,
  action: OrderAction,
  assignedTechnicianId: string | null,
): void {
  if (user.role === Role.ADMIN) {
    return;
  }
  if (user.role === Role.TECHNICIAN) {
    if (!TECHNICIAN_ACTIONS.has(action)) {
      throw new ForbiddenException('Ação não permitida para o papel TECHNICIAN');
    }
    if (assignedTechnicianId !== user.id) {
      throw new ForbiddenException('Técnico só opera OS atribuídas a si');
    }
    return;
  }
  // ATTENDANT: only DELIVER goes through the transition endpoint.
  if (action !== OrderAction.DELIVER) {
    throw new ForbiddenException('Ação não permitida para o papel ATTENDANT');
  }
}

const WARRANTY_DAYS_MS = 90 * 24 * 60 * 60 * 1000; // RN-06

@Injectable()
export class OrderTransitionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly expiration: QuoteExpirationService,
  ) {}

  /** Authenticated entry point for status changes (ADR-006). */
  async execute(orderId: string, body: TransitionBody, user: AuthenticatedUser) {
    const order = await this.ordersService.getScoped(orderId, user);
    assertActionPermitted(user, body.action, order.assignedTechnicianId);
    const isDecision =
      body.action === OrderAction.APPROVE_QUOTE || body.action === OrderAction.REJECT_QUOTE;
    return this.applyTransition(order, body.action, {
      reason: body.payload?.reason,
      actor: {
        type: ActorType.USER,
        id: user.id,
        ...(isDecision ? { method: 'in_person' as const } : {}),
      },
    });
  }

  /**
   * Core of ADR-006, shared by the authenticated endpoint and the public
   * token flow (actor CUSTOMER). Must run inside a tenant context.
   */
  async applyTransition(
    order: ServiceOrder,
    action: OrderAction,
    options: { reason?: string; actor: TransitionActor },
  ) {
    const { reason, actor } = options;
    const rawQuote = await this.prisma.client.quote.findFirst({
      where: { serviceOrderId: order.id },
      orderBy: { version: 'desc' },
      include: { _count: { select: { items: true } } },
    });
    // RN-05: lazy expiration — an expired SENT quote behaves as EXPIRED here.
    const latestQuote = rawQuote ? await this.expiration.resolve(rawQuote) : null;

    const ctx: TransitionContext = {
      hasAssignedTechnician: order.assignedTechnicianId !== null,
      technicalDiagnosis: order.technicalDiagnosis,
      activeQuote: latestQuote
        ? {
            status: latestQuote.status,
            itemCount: latestQuote._count.items,
            totalCents: latestQuote.totalCents,
          }
        : null,
      reason,
    };

    const check = canTransition(order.status, action, ctx);
    if (!check.ok) {
      throw new InvalidTransitionError(check.message, check.code);
    }

    // RN-04: decisions act on the latest SENT (non-expired) quote.
    if (
      (action === OrderAction.APPROVE_QUOTE || action === OrderAction.REJECT_QUOTE) &&
      latestQuote?.status !== QuoteStatus.SENT
    ) {
      throw new InvalidTransitionError('Não há orçamento enviado para decidir', 'RN-04');
    }

    const now = new Date();
    // RN-09: side effects, status change and audit event in ONE transaction.
    return this.prisma.client.$transaction(async (tx) => {
      if (action === OrderAction.SEND_QUOTE && latestQuote) {
        // RN-03: quote goes SENT with a fresh public token valid for 7 days.
        await tx.quote.update({
          where: { id: latestQuote.id },
          data: {
            status: QuoteStatus.SENT,
            publicToken: randomUUID(),
            tokenExpiresAt: new Date(now.getTime() + QUOTE_TOKEN_TTL_MS),
          },
        });
      }
      if (action === OrderAction.APPROVE_QUOTE && latestQuote) {
        await tx.quote.update({
          where: { id: latestQuote.id },
          data: { status: QuoteStatus.APPROVED, approvedAt: now },
        });
      }
      if (action === OrderAction.REJECT_QUOTE && latestQuote) {
        await tx.quote.update({
          where: { id: latestQuote.id },
          data: { status: QuoteStatus.REJECTED, rejectedAt: now, rejectionReason: reason },
        });
      }

      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: {
          status: check.nextStatus,
          // RN-06: delivery stamps deliveredAt and 90 days of warranty.
          ...(action === OrderAction.DELIVER
            ? { deliveredAt: now, warrantyUntil: new Date(now.getTime() + WARRANTY_DAYS_MS) }
            : {}),
          ...(action === OrderAction.CANCEL ? { canceledReason: reason } : {}),
        },
        include: ORDER_DETAIL_INCLUDE,
      });

      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: order.id,
          actorType: actor.type,
          actorId: actor.id,
          type: 'STATUS_CHANGED',
          fromStatus: order.status,
          toStatus: check.nextStatus,
          metadata: {
            action,
            ...(reason === undefined ? {} : { reason }),
            ...(actor.method === undefined ? {} : { method: actor.method }),
          },
        },
      });

      return updated;
    });
  }

  /** RN-07: creates the linked warranty child order; the original stays DELIVERED. */
  async reopenWarranty(orderId: string, user: AuthenticatedUser, reportedIssue?: string) {
    if (user.role === Role.TECHNICIAN) {
      throw new ForbiddenException('Ação não permitida para o papel TECHNICIAN');
    }
    const original = await this.ordersService.getScoped(orderId, user);

    const check = canReopenWarranty(original.status, { warrantyUntil: original.warrantyUntil });
    if (!check.ok) {
      throw new WarrantyReopenError(check.message, check.code);
    }

    const tenantId = this.requireTenantId();
    return this.prisma.client.$transaction(async (tx) => {
      const code = await nextOrderCode(tx, tenantId);
      const child = await tx.serviceOrder.create({
        data: {
          tenantId: TENANT_INJECTED,
          branchId: original.branchId,
          customerId: original.customerId,
          equipmentId: original.equipmentId,
          code,
          reportedIssue: reportedIssue ?? `Reabertura em garantia da ${original.code}`,
          // RN-07: warranty reopens enter with at least HIGH priority.
          priority: original.priority === Priority.URGENT ? Priority.URGENT : Priority.HIGH,
          status: OrderStatus.RECEIVED,
          warrantyParentId: original.id,
          createdById: user.id,
        },
        include: ORDER_DETAIL_INCLUDE,
      });
      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: child.id,
          actorType: ActorType.USER,
          actorId: user.id,
          type: 'ORDER_CREATED',
          toStatus: child.status,
          metadata: { warrantyParentId: original.id, warrantyParentCode: original.code },
        },
      });
      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: original.id,
          actorType: ActorType.USER,
          actorId: user.id,
          type: 'WARRANTY_REOPENED',
          metadata: { childOrderId: child.id, childOrderCode: child.code },
        },
      });
      return child;
    });
  }

  private requireTenantId(): string {
    const tenantId = currentTenantId();
    if (tenantId === undefined) {
      throw new Error('Tenant context missing in OrderTransitionsService');
    }
    return tenantId;
  }
}
