import type { INestApplication } from '@nestjs/common';
import { OrderAction, OrderStatus, Priority, QuoteStatus, Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createOrder,
  createQuote,
  createTenant,
  createUser,
  testDb,
  type CreateOrderOptions,
} from '../../../test/factories';

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_DIAGNOSIS = 'Fonte queimada por surto elétrico; substituição da PSU necessária.';

describe('order transitions (integration)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let technician: Awaited<ReturnType<typeof createUser>>;

  const newOrder = (options: Partial<CreateOrderOptions> = {}) =>
    createOrder({ tenantId, branchId, createdById: admin.id, ...options });

  const transition = (orderId: string, action: OrderAction, reason?: string) =>
    asUser(app, admin).post(`/orders/${orderId}/transitions`, {
      action,
      ...(reason === undefined ? {} : { payload: { reason } }),
    });

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    branchId = (await createBranch(tenantId)).id;
    admin = await createUser({ tenantId, role: Role.ADMIN });
    technician = await createUser({ tenantId, role: Role.TECHNICIAN, branchId });
  });

  afterAll(async () => {
    await app.close();
  });

  it('RN-01: invalid transition returns 422 with the rule code', async () => {
    const order = await newOrder({ status: OrderStatus.RECEIVED });
    const response = await transition(order.id, OrderAction.DELIVER);
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      statusCode: 422,
      details: { code: 'RN-01' },
    });
  });

  it('RN-02: START_DIAGNOSIS requires an assigned technician', async () => {
    const unassigned = await newOrder({ status: OrderStatus.RECEIVED });
    const denied = await transition(unassigned.id, OrderAction.START_DIAGNOSIS);
    expect(denied.status).toBe(422);
    expect(denied.body).toMatchObject({ details: { code: 'RN-02' } });

    const assigned = await newOrder({
      status: OrderStatus.RECEIVED,
      assignedTechnicianId: technician.id,
    });
    const allowed = await transition(assigned.id, OrderAction.START_DIAGNOSIS);
    expect(allowed.status).toBe(201);
    expect(allowed.body).toMatchObject({ status: OrderStatus.IN_DIAGNOSIS });
  });

  describe('RN-03: SEND_QUOTE preconditions and effects', () => {
    it('RN-03: requires diagnosis >= 20 chars and a non-empty DRAFT quote', async () => {
      const noDiagnosis = await newOrder({
        status: OrderStatus.IN_DIAGNOSIS,
        assignedTechnicianId: technician.id,
        technicalDiagnosis: 'curto',
      });
      await createQuote({ tenantId, serviceOrderId: noDiagnosis.id });
      const shortDiagnosis = await transition(noDiagnosis.id, OrderAction.SEND_QUOTE);
      expect(shortDiagnosis.status).toBe(422);
      expect(shortDiagnosis.body).toMatchObject({ details: { code: 'RN-03' } });

      const noQuote = await newOrder({
        status: OrderStatus.IN_DIAGNOSIS,
        assignedTechnicianId: technician.id,
        technicalDiagnosis: VALID_DIAGNOSIS,
      });
      const missingQuote = await transition(noQuote.id, OrderAction.SEND_QUOTE);
      expect(missingQuote.status).toBe(422);
      expect(missingQuote.body).toMatchObject({ details: { code: 'RN-03' } });
    });

    it('RN-03: sending marks the quote SENT with a 7-day public token', async () => {
      const order = await newOrder({
        status: OrderStatus.IN_DIAGNOSIS,
        assignedTechnicianId: technician.id,
        technicalDiagnosis: VALID_DIAGNOSIS,
      });
      const quote = await createQuote({ tenantId, serviceOrderId: order.id });

      const before = Date.now();
      const response = await transition(order.id, OrderAction.SEND_QUOTE);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ status: OrderStatus.QUOTE_SENT });

      const sent = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(sent.status).toBe(QuoteStatus.SENT);
      expect(sent.publicToken).not.toBe(quote.publicToken); // fresh token per send
      const expiry = sent.tokenExpiresAt?.getTime() ?? 0;
      expect(expiry).toBeGreaterThanOrEqual(before + 7 * DAY_MS - 5000);
      expect(expiry).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS + 5000);
    });
  });

  describe('RN-04: in-person quote decision', () => {
    async function orderWithSentQuote() {
      const order = await newOrder({
        status: OrderStatus.QUOTE_SENT,
        assignedTechnicianId: technician.id,
        technicalDiagnosis: VALID_DIAGNOSIS,
      });
      const quote = await createQuote({
        tenantId,
        serviceOrderId: order.id,
        status: QuoteStatus.SENT,
      });
      return { order, quote };
    }

    it('RN-04: admin approves in person; event carries method=in_person', async () => {
      const { order, quote } = await orderWithSentQuote();
      const response = await transition(order.id, OrderAction.APPROVE_QUOTE);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ status: OrderStatus.APPROVED });

      const approved = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(approved.status).toBe(QuoteStatus.APPROVED);
      expect(approved.approvedAt).not.toBeNull();

      const event = await testDb().orderEvent.findFirstOrThrow({
        where: { serviceOrderId: order.id, type: 'STATUS_CHANGED' },
      });
      expect(event.metadata).toMatchObject({ action: 'APPROVE_QUOTE', method: 'in_person' });
    });

    it('RN-04: rejection requires a reason with at least 5 chars', async () => {
      const { order, quote } = await orderWithSentQuote();
      const tooShort = await transition(order.id, OrderAction.REJECT_QUOTE, 'caro');
      expect(tooShort.status).toBe(422);
      expect(tooShort.body).toMatchObject({ details: { code: 'RN-04' } });

      const ok = await transition(order.id, OrderAction.REJECT_QUOTE, 'muito caro para mim');
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ status: OrderStatus.REJECTED });
      const rejected = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(rejected.rejectionReason).toBe('muito caro para mim');
    });

    it('RN-04: deciding without a SENT quote fails with 422', async () => {
      const order = await newOrder({ status: OrderStatus.QUOTE_SENT });
      const response = await transition(order.id, OrderAction.APPROVE_QUOTE);
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ details: { code: 'RN-04' } });
    });
  });

  it('RN-06: DELIVER stamps deliveredAt and warrantyUntil = +90 days', async () => {
    const order = await newOrder({ status: OrderStatus.READY });
    const before = Date.now();
    const response = await transition(order.id, OrderAction.DELIVER);
    expect(response.status).toBe(201);

    const delivered = response.body as { deliveredAt: string; warrantyUntil: string };
    const deliveredAt = new Date(delivered.deliveredAt).getTime();
    const warrantyUntil = new Date(delivered.warrantyUntil).getTime();
    expect(deliveredAt).toBeGreaterThanOrEqual(before - 1000);
    expect(warrantyUntil - deliveredAt).toBe(90 * DAY_MS);
  });

  it('RN-08: CANCEL requires reason >= 10 chars, stores it, and DELIVERED cannot cancel', async () => {
    const order = await newOrder({ status: OrderStatus.IN_REPAIR });
    const tooShort = await transition(order.id, OrderAction.CANCEL, 'desistiu');
    expect(tooShort.status).toBe(422);
    expect(tooShort.body).toMatchObject({ details: { code: 'RN-08' } });

    const ok = await transition(order.id, OrderAction.CANCEL, 'cliente desistiu do conserto');
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      status: OrderStatus.CANCELED,
      canceledReason: 'cliente desistiu do conserto',
    });

    const delivered = await newOrder({ status: OrderStatus.DELIVERED });
    const denied = await transition(delivered.id, OrderAction.CANCEL, 'motivo longo o bastante');
    expect(denied.status).toBe(422);
    expect(denied.body).toMatchObject({ details: { code: 'RN-01' } });
  });

  it('RN-09: every transition writes a STATUS_CHANGED event in the same transaction', async () => {
    const order = await newOrder({
      status: OrderStatus.RECEIVED,
      assignedTechnicianId: technician.id,
    });
    await transition(order.id, OrderAction.START_DIAGNOSIS);

    const events = await testDb().orderEvent.findMany({
      where: { serviceOrderId: order.id, type: 'STATUS_CHANGED' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      fromStatus: OrderStatus.RECEIVED,
      toStatus: OrderStatus.IN_DIAGNOSIS,
      actorId: admin.id,
    });
  });

  describe('RN-07: warranty reopen', () => {
    it('RN-07: creates the child order with parent link and priority >= HIGH', async () => {
      const original = await newOrder({
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(),
        warrantyUntil: new Date(Date.now() + 30 * DAY_MS),
        priority: Priority.LOW,
      });
      const response = await asUser(app, admin).post(`/orders/${original.id}/warranty-reopen`, {});
      expect(response.status).toBe(201);
      const child = response.body as {
        id: string;
        status: string;
        priority: string;
        warrantyParentId: string;
        customerId: string;
        branchId: string;
      };
      expect(child).toMatchObject({
        status: OrderStatus.RECEIVED,
        priority: Priority.HIGH,
        warrantyParentId: original.id,
        customerId: original.customerId,
        branchId: original.branchId,
      });

      const parentEvents = await testDb().orderEvent.findMany({
        where: { serviceOrderId: original.id, type: 'WARRANTY_REOPENED' },
      });
      expect(parentEvents).toHaveLength(1);

      // Original stays DELIVERED (terminal — ADR-006).
      const parent = await testDb().serviceOrder.findUniqueOrThrow({
        where: { id: original.id },
      });
      expect(parent.status).toBe(OrderStatus.DELIVERED);
    });

    it('RN-07: warranty reopen blocks after expiry, citing the date', async () => {
      const expiredAt = new Date(Date.now() - 5 * DAY_MS);
      const original = await newOrder({
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(Date.now() - 100 * DAY_MS),
        warrantyUntil: expiredAt,
      });
      const response = await asUser(app, admin).post(`/orders/${original.id}/warranty-reopen`, {});
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({ details: { code: 'RN-07' } });
      expect((response.body as { message: string }).message).toContain(
        expiredAt.toISOString().slice(0, 10),
      );
    });

    it('RN-07: URGENT priority is preserved on the child', async () => {
      const original = await newOrder({
        status: OrderStatus.DELIVERED,
        warrantyUntil: new Date(Date.now() + DAY_MS),
        priority: Priority.URGENT,
      });
      const response = await asUser(app, admin).post(`/orders/${original.id}/warranty-reopen`, {});
      expect((response.body as { priority: string }).priority).toBe(Priority.URGENT);
    });
  });

  it('walks the full happy path RECEIVED -> ... -> DELIVERED', async () => {
    const order = await newOrder({
      status: OrderStatus.RECEIVED,
      assignedTechnicianId: technician.id,
      technicalDiagnosis: VALID_DIAGNOSIS,
    });
    await createQuote({ tenantId, serviceOrderId: order.id });

    const steps: [OrderAction, OrderStatus][] = [
      [OrderAction.START_DIAGNOSIS, OrderStatus.IN_DIAGNOSIS],
      [OrderAction.SEND_QUOTE, OrderStatus.QUOTE_SENT],
      [OrderAction.APPROVE_QUOTE, OrderStatus.APPROVED],
      [OrderAction.START_REPAIR, OrderStatus.IN_REPAIR],
      [OrderAction.MARK_READY, OrderStatus.READY],
      [OrderAction.DELIVER, OrderStatus.DELIVERED],
    ];
    for (const [action, expected] of steps) {
      const response = await transition(order.id, action);
      expect(response.status).toBe(201);
      expect((response.body as { status: string }).status).toBe(expected);
    }

    const trail = await testDb().orderEvent.findMany({
      where: { serviceOrderId: order.id, type: 'STATUS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });
    expect(trail).toHaveLength(steps.length);
  });
});
