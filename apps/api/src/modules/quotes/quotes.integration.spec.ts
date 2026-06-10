import type { INestApplication } from '@nestjs/common';
import { ItemKind, OrderStatus, QuoteStatus, Role } from '@ofix/shared';
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

describe('quotes (integration)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;

  const newOrder = (options: Partial<CreateOrderOptions> = {}) =>
    createOrder({
      tenantId,
      branchId,
      createdById: admin.id,
      status: OrderStatus.IN_DIAGNOSIS,
      technicalDiagnosis: VALID_DIAGNOSIS,
      ...options,
    });

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    branchId = (await createBranch(tenantId)).id;
    admin = await createUser({ tenantId, role: Role.ADMIN });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders/:id/quotes', () => {
    it('creates version 1 as DRAFT with audit event', async () => {
      const order = await newOrder();
      const response = await asUser(app, admin).post(`/orders/${order.id}/quotes`);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        version: 1,
        status: QuoteStatus.DRAFT,
        totalCents: 0,
        items: [],
      });

      const events = await testDb().orderEvent.findMany({
        where: { serviceOrderId: order.id, type: 'QUOTE_VERSION_CREATED' },
      });
      expect(events).toHaveLength(1);
    });

    it('blocks a new version while a DRAFT or live SENT exists (422)', async () => {
      const order = await newOrder();
      await createQuote({ tenantId, serviceOrderId: order.id, status: QuoteStatus.DRAFT });
      const blockedByDraft = await asUser(app, admin).post(`/orders/${order.id}/quotes`);
      expect(blockedByDraft.status).toBe(422);

      const order2 = await newOrder({ status: OrderStatus.QUOTE_SENT });
      await createQuote({
        tenantId,
        serviceOrderId: order2.id,
        status: QuoteStatus.SENT,
        tokenExpiresAt: new Date(Date.now() + DAY_MS),
      });
      const blockedBySent = await asUser(app, admin).post(`/orders/${order2.id}/quotes`);
      expect(blockedBySent.status).toBe(422);
    });

    it('RN-05: an expired SENT quote stops blocking and is marked EXPIRED', async () => {
      const order = await newOrder({ status: OrderStatus.QUOTE_SENT });
      const stale = await createQuote({
        tenantId,
        serviceOrderId: order.id,
        status: QuoteStatus.SENT,
        tokenExpiresAt: new Date(Date.now() - DAY_MS),
      });

      const response = await asUser(app, admin).post(`/orders/${order.id}/quotes`);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ version: 2 });

      const expired = await testDb().quote.findUniqueOrThrow({ where: { id: stale.id } });
      expect(expired.status).toBe(QuoteStatus.EXPIRED);
      const events = await testDb().orderEvent.findMany({
        where: { serviceOrderId: order.id, type: 'QUOTE_EXPIRED' },
      });
      expect(events).toHaveLength(1);

      // The order itself stays QUOTE_SENT (RN-05).
      const reloaded = await testDb().serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(reloaded.status).toBe(OrderStatus.QUOTE_SENT);
    });

    it('RN-07: warranty reopen blocks labor recharge — child quote born with zeroed LABOR', async () => {
      const original = await newOrder({
        status: OrderStatus.DELIVERED,
        warrantyUntil: new Date(Date.now() + 30 * DAY_MS),
      });
      await createQuote({
        tenantId,
        serviceOrderId: original.id,
        status: QuoteStatus.APPROVED,
        items: [
          { description: 'Troca de fonte', quantity: 1, unitPriceCents: 12000 },
          { description: 'Limpeza interna', quantity: 1, unitPriceCents: 5000 },
        ],
      });
      // Factory items are PART by default; make one LABOR for the rule.
      await testDb().quoteItem.updateMany({
        where: { description: 'Troca de fonte' },
        data: { kind: ItemKind.LABOR },
      });

      const reopen = await asUser(app, admin).post(`/orders/${original.id}/warranty-reopen`, {});
      const childId = (reopen.body as { id: string }).id;

      const quote = await asUser(app, admin).post(`/orders/${childId}/quotes`);
      expect(quote.status).toBe(201);
      const body = quote.body as {
        totalCents: number;
        items: { kind: string; description: string; unitPriceCents: number }[];
      };
      expect(body.totalCents).toBe(0);
      expect(body.items).toHaveLength(1); // only the LABOR item, PART is not seeded
      expect(body.items[0]).toMatchObject({
        kind: ItemKind.LABOR,
        description: 'Garantia — Troca de fonte',
        unitPriceCents: 0,
      });
    });
  });

  describe('PATCH /quotes/:id', () => {
    it('replaces items in batch and recomputes totals server-side (ADR-003)', async () => {
      const order = await newOrder();
      const quote = await createQuote({
        tenantId,
        serviceOrderId: order.id,
        status: QuoteStatus.DRAFT,
        items: [],
      });

      const response = await asUser(app, admin).patch(`/quotes/${quote.id}`, {
        items: [
          { kind: 'PART', description: 'Tela 15.6 FHD', quantity: 1, unitPriceCents: 45000 },
          { kind: 'LABOR', description: 'Troca de tela', quantity: 2, unitPriceCents: 8000 },
        ],
      });
      expect(response.status).toBe(200);
      const body = response.body as { totalCents: number; items: { subtotalCents: number }[] };
      expect(body.totalCents).toBe(61000);
      expect(body.items.map((i) => i.subtotalCents).sort()).toEqual([16000, 45000]);
    });

    it('rejects edits when the quote is not DRAFT (422)', async () => {
      const order = await newOrder({ status: OrderStatus.QUOTE_SENT });
      const quote = await createQuote({
        tenantId,
        serviceOrderId: order.id,
        status: QuoteStatus.SENT,
        tokenExpiresAt: new Date(Date.now() + DAY_MS),
      });
      const response = await asUser(app, admin).patch(`/quotes/${quote.id}`, {
        items: [{ kind: 'PART', description: 'Item', quantity: 1, unitPriceCents: 100 }],
      });
      expect(response.status).toBe(422);
    });

    it('RN-11: tenant B cannot touch a quote of tenant A (404)', async () => {
      const order = await newOrder();
      const quote = await createQuote({ tenantId, serviceOrderId: order.id });
      const otherTenant = await createTenant();
      const intruder = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });

      const response = await asUser(app, intruder).patch(`/quotes/${quote.id}`, {
        items: [],
      });
      expect(response.status).toBe(404);
    });
  });

  describe('POST /quotes/:id/send', () => {
    it('RN-03: sends the latest draft through the transition machinery', async () => {
      const order = await newOrder();
      const quote = await createQuote({ tenantId, serviceOrderId: order.id });

      const response = await asUser(app, admin).post(`/quotes/${quote.id}/send`);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ status: OrderStatus.QUOTE_SENT });

      const sent = await testDb().quote.findUniqueOrThrow({ where: { id: quote.id } });
      expect(sent.status).toBe(QuoteStatus.SENT);
      expect(sent.tokenExpiresAt).not.toBeNull();
    });

    it('only the latest version can be sent (422)', async () => {
      const order = await newOrder({ status: OrderStatus.REJECTED });
      const v1 = await createQuote({
        tenantId,
        serviceOrderId: order.id,
        status: QuoteStatus.REJECTED,
      });
      await createQuote({ tenantId, serviceOrderId: order.id, version: 2 });

      const response = await asUser(app, admin).post(`/quotes/${v1.id}/send`);
      expect(response.status).toBe(422);
    });
  });

  describe('permissions (matrix: quote = ADMIN or assigned technician)', () => {
    it('ATTENDANT is blocked at the route; unassigned technician at the order', async () => {
      const order = await newOrder();
      const attendant = await createUser({ tenantId, role: Role.ATTENDANT });
      const stranger = await createUser({ tenantId, role: Role.TECHNICIAN });

      const byAttendant = await asUser(app, attendant).post(`/orders/${order.id}/quotes`);
      const byStranger = await asUser(app, stranger).post(`/orders/${order.id}/quotes`);
      expect(byAttendant.status).toBe(403);
      expect(byStranger.status).toBe(403);
    });

    it('assigned technician manages the quote end to end', async () => {
      const technician = await createUser({ tenantId, role: Role.TECHNICIAN, branchId });
      const order = await newOrder({ assignedTechnicianId: technician.id });

      const created = await asUser(app, technician).post(`/orders/${order.id}/quotes`);
      expect(created.status).toBe(201);
      const quoteId = (created.body as { id: string }).id;

      const updated = await asUser(app, technician).patch(`/quotes/${quoteId}`, {
        items: [{ kind: 'PART', description: 'Fonte 500W', quantity: 1, unitPriceCents: 20000 }],
      });
      expect(updated.status).toBe(200);

      const sent = await asUser(app, technician).post(`/quotes/${quoteId}/send`);
      expect(sent.status).toBe(201);
    });
  });
});
