import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ItemKind,
  OrderAction,
  OrderStatus,
  QuoteStatus,
  Role,
  calculateQuoteTotals,
  type UpdateQuoteItemsBody,
} from '@ofix/shared';
import { ActorType, type ServiceOrder } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TENANT_INJECTED } from '../../infra/prisma/tenant.extension';
import { OrderTransitionsService } from '../orders/order-transitions.service';
import { OrdersService } from '../orders/orders.service';
import { QuoteExpirationService } from '../orders/quote-expiration.service';

/** Order statuses in which a new quote version may be drafted. */
const QUOTABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.RECEIVED,
  OrderStatus.IN_DIAGNOSIS,
  OrderStatus.QUOTE_SENT,
  OrderStatus.REJECTED,
]);

/** Matrix (spec 004): quotes are handled by ADMIN or the assigned technician. */
function assertQuoteActor(user: AuthenticatedUser, order: ServiceOrder): void {
  if (user.role === Role.ADMIN) {
    return;
  }
  if (user.role === Role.TECHNICIAN && order.assignedTechnicianId === user.id) {
    return;
  }
  throw new ForbiddenException('Orçamentos são geridos pelo ADMIN ou pelo técnico atribuído');
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly transitions: OrderTransitionsService,
    private readonly expiration: QuoteExpirationService,
  ) {}

  /** POST /orders/:id/quotes — new DRAFT version (spec 005). */
  async createVersion(orderId: string, user: AuthenticatedUser) {
    const order = await this.ordersService.getScoped(orderId, user);
    assertQuoteActor(user, order);

    if (!QUOTABLE_STATUSES.has(order.status)) {
      throw new UnprocessableEntityException(
        `OS no status ${order.status} não aceita novo orçamento`,
      );
    }

    const rawLatest = await this.prisma.client.quote.findFirst({
      where: { serviceOrderId: order.id },
      orderBy: { version: 'desc' },
    });
    // RN-05: an expired SENT quote stops blocking a new version.
    const latest = rawLatest ? await this.expiration.resolve(rawLatest) : null;
    if (latest && (latest.status === QuoteStatus.DRAFT || latest.status === QuoteStatus.SENT)) {
      throw new UnprocessableEntityException(
        'Já existe um orçamento ativo (rascunho ou enviado) para esta OS',
      );
    }

    // RN-07: a warranty order's quote is born with the original LABOR items
    // zeroed — labor for the same services is not chargeable again.
    const seededItems = await this.warrantyLaborSeed(order);

    return this.prisma.client.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: order.id,
          version: (latest?.version ?? 0) + 1,
          totalCents: 0,
          items: { create: seededItems },
        },
        include: { items: true },
      });
      await tx.orderEvent.create({
        data: {
          tenantId: TENANT_INJECTED,
          serviceOrderId: order.id,
          actorType: ActorType.USER,
          actorId: user.id,
          type: 'QUOTE_VERSION_CREATED',
          metadata: { quoteId: quote.id, version: quote.version },
        },
      });
      return quote;
    });
  }

  /** PATCH /quotes/:id — batch item replace while DRAFT; total recomputed in the transaction. */
  async updateItems(quoteId: string, body: UpdateQuoteItemsBody, user: AuthenticatedUser) {
    const quote = await this.getScopedQuote(quoteId, user);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new UnprocessableEntityException('Apenas orçamentos em rascunho podem ser editados');
    }

    const totals = calculateQuoteTotals(body.items);
    return this.prisma.client.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: quote.id } });
      return tx.quote.update({
        where: { id: quote.id },
        data: {
          totalCents: totals.totalCents,
          items: { create: totals.items },
        },
        include: { items: true },
      });
    });
  }

  /** POST /quotes/:id/send — shortcut to the SEND_QUOTE transition (spec 005). */
  async send(quoteId: string, user: AuthenticatedUser) {
    const quote = await this.getScopedQuote(quoteId, user);
    const newest = await this.prisma.client.quote.findFirst({
      where: { serviceOrderId: quote.serviceOrderId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (newest?.id !== quote.id) {
      throw new UnprocessableEntityException('Apenas a versão mais recente pode ser enviada');
    }
    return this.transitions.execute(
      quote.serviceOrderId,
      { action: OrderAction.SEND_QUOTE },
      user,
    );
  }

  private async getScopedQuote(quoteId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.client.quote.findUnique({ where: { id: quoteId } });
    if (!quote) {
      throw new NotFoundException('Orçamento não encontrado');
    }
    // Branch scope + permission come from the owning order.
    const order = await this.ordersService.getScoped(quote.serviceOrderId, user);
    assertQuoteActor(user, order);
    return quote;
  }

  private async warrantyLaborSeed(order: ServiceOrder) {
    if (order.warrantyParentId === null) {
      return [];
    }
    const approved = await this.prisma.client.quote.findFirst({
      where: { serviceOrderId: order.warrantyParentId, status: QuoteStatus.APPROVED },
      orderBy: { version: 'desc' },
      include: { items: { where: { kind: ItemKind.LABOR } } },
    });
    return (approved?.items ?? []).map((item) => ({
      kind: ItemKind.LABOR,
      description: `Garantia — ${item.description}`,
      quantity: item.quantity,
      unitPriceCents: 0, // RN-07: same-service labor is not chargeable again
      subtotalCents: 0,
    }));
  }
}
