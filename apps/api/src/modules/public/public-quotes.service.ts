import {
  GoneException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OrderAction, QuoteStatus, type PublicQuoteResponse } from '@ofix/shared';
import { ActorType, type Quote } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';
import { runWithTenant } from '../../infra/prisma/tenant-context';
import { OrderTransitionsService } from '../orders/order-transitions.service';
import { QuoteExpirationService } from '../orders/quote-expiration.service';

/**
 * Public capability-token flow (ADR-005). Lookups are unscoped by necessity —
 * there is no tenant before the token resolves; the token itself (122 random
 * bits, unique) is the credential and the tenant comes from the quote row.
 * Status mapping: unknown/DRAFT -> 404 generic, expired -> 410 Gone (RN-05),
 * already decided -> 422.
 */
@Injectable()
export class PublicQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transitions: OrderTransitionsService,
    private readonly expiration: QuoteExpirationService,
  ) {}

  async view(token: string): Promise<PublicQuoteResponse> {
    const quote = await this.findByToken(token);
    await this.assertNotExpired(quote);
    const order = await this.prisma.unscoped.serviceOrder.findUniqueOrThrow({
      where: { id: quote.serviceOrderId },
      include: {
        tenant: { select: { name: true } },
        branch: { select: { name: true, city: true, state: true, phone: true } },
        equipment: { select: { type: true, brand: true, model: true } },
      },
    });
    const items = await this.prisma.unscoped.quoteItem.findMany({
      where: { quoteId: quote.id },
      orderBy: { description: 'asc' },
    });
    return {
      company: { name: order.tenant.name, branch: order.branch },
      order: {
        code: order.code,
        equipment: `${order.equipment.type} ${order.equipment.brand} ${order.equipment.model}`,
        reportedIssue: order.reportedIssue,
      },
      quote: {
        version: quote.version,
        status: quote.status,
        items: items.map((item) => ({
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.subtotalCents,
        })),
        totalCents: quote.totalCents,
        tokenExpiresAt: quote.tokenExpiresAt?.toISOString() ?? null,
        decidedAt: (quote.approvedAt ?? quote.rejectedAt)?.toISOString() ?? null,
        rejectionReason: quote.rejectionReason,
      },
    };
  }

  async approve(token: string) {
    return this.decide(token, OrderAction.APPROVE_QUOTE);
  }

  async reject(token: string, reason: string) {
    return this.decide(token, OrderAction.REJECT_QUOTE, reason);
  }

  private async decide(token: string, action: OrderAction, reason?: string) {
    const quote = await this.findByToken(token);
    await this.assertNotExpired(quote);
    if (quote.status !== QuoteStatus.SENT) {
      throw new UnprocessableEntityException('Este orçamento já foi decidido');
    }
    const newest = await this.prisma.unscoped.quote.findFirst({
      where: { serviceOrderId: quote.serviceOrderId },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (newest?.id !== quote.id) {
      // A newer version superseded this link.
      throw new GoneException('Há uma versão mais recente deste orçamento; use o novo link.');
    }

    const order = await this.prisma.unscoped.serviceOrder.findUniqueOrThrow({
      where: { id: quote.serviceOrderId },
    });

    // The decision runs inside the quote's tenant scope so the shared
    // transition machinery (RN-01/04/09) applies untouched (ADR-005/006).
    const updated = await runWithTenant(quote.tenantId, async () =>
      this.transitions.applyTransition(order, action, {
        reason,
        actor: { type: ActorType.CUSTOMER, id: null, method: 'public_token' },
      }),
    );
    return { orderStatus: updated.status };
  }

  /** RN-05: expired links are 410 Gone — lazily marked or already EXPIRED. */
  private async assertNotExpired(quote: Quote): Promise<void> {
    if (QuoteExpirationService.isExpired(quote)) {
      await this.expiration.resolve(quote);
    } else if (quote.status !== QuoteStatus.EXPIRED) {
      return;
    }
    throw new GoneException(
      'Este orçamento expirou. Entre em contato com a assistência para receber um novo link.',
    );
  }

  private async findByToken(token: string): Promise<Quote> {
    const quote = await this.prisma.unscoped.quote.findUnique({
      where: { publicToken: token },
    });
    // DRAFT tokens never circulated; reply the same generic 404 (no probing).
    if (!quote || quote.status === QuoteStatus.DRAFT) {
      throw new NotFoundException('Orçamento não encontrado');
    }
    return quote;
  }
}
