import { Injectable, Logger } from '@nestjs/common';
import { QuoteStatus } from '@ofix/shared';
import { ActorType, type Quote } from '@prisma/client';

import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * RN-05: a SENT quote whose public token expired is treated as EXPIRED.
 * Lazy evaluation on access plus a daily sweep (and one at boot). The order
 * stays QUOTE_SENT — a new version (N+1) may be created and sent.
 */
@Injectable()
export class QuoteExpirationService {
  private readonly logger = new Logger(QuoteExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  static isExpired(quote: Pick<Quote, 'status' | 'tokenExpiresAt'>, now = new Date()): boolean {
    return (
      quote.status === QuoteStatus.SENT &&
      quote.tokenExpiresAt !== null &&
      quote.tokenExpiresAt.getTime() < now.getTime()
    );
  }

  /**
   * Marks the quote EXPIRED (with a SYSTEM audit event) if its token expired;
   * returns the up-to-date row. Uses the unscoped client because the public
   * route runs without tenant context — the write is keyed by the id of a row
   * we already hold, so no scope can be widened.
   */
  async resolve<T extends Quote>(quote: T): Promise<T> {
    if (!QuoteExpirationService.isExpired(quote)) {
      return quote;
    }
    await this.expire([quote]);
    return { ...quote, status: QuoteStatus.EXPIRED };
  }

  /** Daily/boot sweep across all tenants (RN-05). Returns how many expired. */
  async sweep(now = new Date()): Promise<number> {
    const stale = await this.prisma.unscoped.quote.findMany({
      where: { status: QuoteStatus.SENT, tokenExpiresAt: { lt: now } },
    });
    if (stale.length > 0) {
      await this.expire(stale);
      this.logger.log(`Quote expiration sweep: ${String(stale.length)} quote(s) expired`);
    }
    return stale.length;
  }

  private async expire(quotes: Quote[]): Promise<void> {
    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.quote.updateMany({
        where: { id: { in: quotes.map((q) => q.id) }, status: QuoteStatus.SENT },
        data: { status: QuoteStatus.EXPIRED },
      }),
      this.prisma.unscoped.orderEvent.createMany({
        data: quotes.map((quote) => ({
          tenantId: quote.tenantId,
          serviceOrderId: quote.serviceOrderId,
          actorType: ActorType.SYSTEM,
          type: 'QUOTE_EXPIRED',
          metadata: { quoteId: quote.id, version: quote.version },
        })),
      }),
    ]);
  }
}
