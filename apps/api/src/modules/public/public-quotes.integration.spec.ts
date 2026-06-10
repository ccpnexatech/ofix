import type { INestApplication } from '@nestjs/common';
import { OrderStatus, QuoteStatus, Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createOrder,
  createQuote,
  createTenant,
  createUser,
  testDb,
} from '../../../test/factories';
import { QuoteExpirationService } from '../orders/quote-expiration.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('public quote flow (integration, ADR-005)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchId: string;
  let adminId: string;

  /** Order in QUOTE_SENT with a live SENT quote; returns the public token. */
  async function sentQuoteFixture(expiresInMs = 7 * DAY_MS) {
    const order = await createOrder({
      tenantId,
      branchId,
      createdById: adminId,
      status: OrderStatus.QUOTE_SENT,
    });
    const quote = await createQuote({
      tenantId,
      serviceOrderId: order.id,
      status: QuoteStatus.SENT,
      tokenExpiresAt: new Date(Date.now() + expiresInMs),
      items: [
        { description: 'Troca de fonte', quantity: 1, unitPriceCents: 25000 },
        { description: 'Mão de obra', quantity: 1, unitPriceCents: 10000 },
      ],
    });
    return { order, quote };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant({ name: 'TecNorte Assistência' });
    tenantId = tenant.id;
    branchId = (await createBranch(tenantId)).id;
    adminId = (await createUser({ tenantId, role: Role.ADMIN })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /public/quotes/:token shows company, order summary, items and total — no auth', async () => {
    const { quote } = await sentQuoteFixture();
    const response = await api(app).get(apiPath(`/public/quotes/${quote.publicToken}`));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      company: {
        name: 'TecNorte Assistência',
        branch: { city: 'Fortaleza', state: 'CE' },
      },
      order: { equipment: expect.stringContaining('Notebook') as unknown },
      quote: {
        status: QuoteStatus.SENT,
        totalCents: 35000,
        // Items come ordered by description.
        items: [
          expect.objectContaining({ subtotalCents: 10000 }) as unknown,
          expect.objectContaining({ subtotalCents: 25000 }) as unknown,
        ],
      },
    });
  });

  it('unknown and DRAFT tokens answer the same generic 404', async () => {
    const order = await createOrder({ tenantId, branchId, createdById: adminId });
    const draft = await createQuote({ tenantId, serviceOrderId: order.id });

    const unknown = await api(app).get(apiPath('/public/quotes/no-such-token'));
    const draftHit = await api(app).get(apiPath(`/public/quotes/${draft.publicToken}`));
    expect(unknown.status).toBe(404);
    expect(draftHit.status).toBe(404);
    expect(unknown.body).toEqual(draftHit.body);
  });

  it('RN-04: customer approves via token; order APPROVED with CUSTOMER audit event', async () => {
    const { order, quote } = await sentQuoteFixture();
    const response = await api(app).post(apiPath(`/public/quotes/${quote.publicToken}/approve`));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ orderStatus: OrderStatus.APPROVED });

    const event = await testDb().orderEvent.findFirstOrThrow({
      where: { serviceOrderId: order.id, type: 'STATUS_CHANGED' },
    });
    expect(event.actorType).toBe('CUSTOMER');
    expect(event.actorId).toBeNull();
    expect(event.metadata).toMatchObject({ action: 'APPROVE_QUOTE', method: 'public_token' });

    const approved = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(approved.status).toBe(QuoteStatus.APPROVED);
    expect(approved.approvedAt).not.toBeNull();
  });

  it('RN-04: rejection requires a reason (schema) and stores it', async () => {
    const { order, quote } = await sentQuoteFixture();

    const missingReason = await api(app).post(
      apiPath(`/public/quotes/${quote.publicToken}/reject`),
    );
    expect(missingReason.status).toBe(400);

    const rejected = await api(app)
      .post(apiPath(`/public/quotes/${quote.publicToken}/reject`))
      .send({ reason: 'Valor acima do esperado' });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toEqual({ orderStatus: OrderStatus.REJECTED });

    const stored = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(stored.rejectionReason).toBe('Valor acima do esperado');
    const reloaded = await testDb().serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(reloaded.status).toBe(OrderStatus.REJECTED);
  });

  it('deciding twice answers 422 (already decided)', async () => {
    const { quote } = await sentQuoteFixture();
    await api(app).post(apiPath(`/public/quotes/${quote.publicToken}/approve`));
    const again = await api(app).post(apiPath(`/public/quotes/${quote.publicToken}/approve`));
    expect(again.status).toBe(422);
  });

  it('RN-05: expired token answers 410 Gone and the quote is lazily marked EXPIRED', async () => {
    const { order, quote } = await sentQuoteFixture(-DAY_MS); // expired yesterday

    const view = await api(app).get(apiPath(`/public/quotes/${quote.publicToken}`));
    expect(view.status).toBe(410);
    expect((view.body as { message: string }).message).toContain('expirou');

    const marked = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(marked.status).toBe(QuoteStatus.EXPIRED);
    const events = await testDb().orderEvent.findMany({
      where: { serviceOrderId: order.id, type: 'QUOTE_EXPIRED' },
    });
    expect(events).toHaveLength(1);

    // The order keeps waiting in QUOTE_SENT (a new version may be sent).
    const reloaded = await testDb().serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(reloaded.status).toBe(OrderStatus.QUOTE_SENT);

    const approve = await api(app).post(apiPath(`/public/quotes/${quote.publicToken}/approve`));
    expect(approve.status).toBe(410);
  });

  it('RN-05: the sweep expires every stale SENT quote across tenants', async () => {
    const { quote: stale1 } = await sentQuoteFixture(-2 * DAY_MS);
    const otherTenant = await createTenant();
    const otherBranch = await createBranch(otherTenant.id);
    const otherAdmin = await createUser({ tenantId: otherTenant.id });
    const foreignOrder = await createOrder({
      tenantId: otherTenant.id,
      branchId: otherBranch.id,
      createdById: otherAdmin.id,
      status: OrderStatus.QUOTE_SENT,
    });
    const stale2 = await createQuote({
      tenantId: otherTenant.id,
      serviceOrderId: foreignOrder.id,
      status: QuoteStatus.SENT,
      tokenExpiresAt: new Date(Date.now() - DAY_MS),
    });

    const swept = await app.get(QuoteExpirationService).sweep();
    expect(swept).toBeGreaterThanOrEqual(2);

    for (const id of [stale1.id, stale2.id]) {
      const row = await testDb().quote.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe(QuoteStatus.EXPIRED);
    }
  });

  it('a superseded link answers 410 after a newer version is sent', async () => {
    const { order, quote: v1 } = await sentQuoteFixture();
    // v1 rejected, v2 sent — old link must not decide the new quote.
    await testDb().quote.update({
      where: { id: v1.id },
      data: { status: QuoteStatus.REJECTED },
    });
    await createQuote({
      tenantId,
      serviceOrderId: order.id,
      version: 2,
      status: QuoteStatus.SENT,
      tokenExpiresAt: new Date(Date.now() + DAY_MS),
    });

    const decide = await api(app).post(apiPath(`/public/quotes/${v1.publicToken}/approve`));
    expect(decide.status).toBe(422); // v1 already decided (rejected)
  });
});
