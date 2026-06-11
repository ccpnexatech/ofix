import type { INestApplication } from '@nestjs/common';
import { OrderStatus, QuoteStatus, Role, type DashboardSummary } from '@ofix/shared';
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
} from '../../../test/factories';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('dashboard (integration)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchA: string;
  let branchB: string;
  let admin: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    admin = await createUser({ tenantId, role: Role.ADMIN });
    branchA = (await createBranch(tenantId, { name: 'Filial A' })).id;
    branchB = (await createBranch(tenantId, { name: 'Filial B' })).id;

    // Branch A: 1 open overdue, 1 delivered this month with approved quote of R$ 500.
    await createOrder({
      tenantId,
      branchId: branchA,
      createdById: admin.id,
      status: OrderStatus.IN_REPAIR,
      promisedAt: new Date(Date.now() - DAY_MS),
    });
    const deliveredA = await createOrder({
      tenantId,
      branchId: branchA,
      createdById: admin.id,
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });
    await createQuote({
      tenantId,
      serviceOrderId: deliveredA.id,
      status: QuoteStatus.APPROVED,
      items: [{ description: 'Serviço A', quantity: 1, unitPriceCents: 50000 }],
    });
    // A draft on the same order must NOT count as revenue.
    await createQuote({ tenantId, serviceOrderId: deliveredA.id, version: 2 });

    // Branch B: 1 open, 1 delivered WITHOUT approved quote (no revenue),
    // 1 canceled (never counts as open).
    await createOrder({
      tenantId,
      branchId: branchB,
      createdById: admin.id,
      status: OrderStatus.RECEIVED,
    });
    await createOrder({
      tenantId,
      branchId: branchB,
      createdById: admin.id,
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
    });
    await createOrder({
      tenantId,
      branchId: branchB,
      createdById: admin.id,
      status: OrderStatus.CANCELED,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('summary aggregates the whole tenant by default (RN-14) with the revenue definition', async () => {
    const response = await asUser(app, admin).get('/dashboard/summary');
    expect(response.status).toBe(200);
    const body = response.body as DashboardSummary;
    expect(body.openOrders).toBe(2); // canceled/delivered never count
    expect(body.overdueOrders).toBe(1);
    // Revenue = ONLY approved quotes of delivered orders (one of the two).
    expect(body.revenueCents).toBe(50000);
    expect(body.deliveredCount).toBe(2);
    expect(body.avgTicketCents).toBe(25000);
  });

  it('?branchId= filters the aggregate', async () => {
    const response = await asUser(app, admin).get(`/dashboard/summary?branchId=${branchA}`);
    const body = response.body as DashboardSummary;
    expect(body.openOrders).toBe(1);
    expect(body.revenueCents).toBe(50000);
    expect(body.deliveredCount).toBe(1);
  });

  it('RN-14: fixed-branch attendant cannot query another branch aggregate (403)', async () => {
    const attendant = await createUser({ tenantId, role: Role.ATTENDANT, branchId: branchA });
    const denied = await asUser(app, attendant).get(`/dashboard/summary?branchId=${branchB}`);
    expect(denied.status).toBe(403);

    // And without a branchId they are pinned to their own branch.
    const pinned = await asUser(app, attendant).get('/dashboard/summary');
    expect((pinned.body as DashboardSummary).openOrders).toBe(1);
  });

  it('RN-14: technician dashboard is restricted to their own orders', async () => {
    const technician = await createUser({ tenantId, role: Role.TECHNICIAN, branchId: branchA });
    const before = await asUser(app, technician).get('/dashboard/summary');
    expect((before.body as DashboardSummary).openOrders).toBe(0);

    await createOrder({
      tenantId,
      branchId: branchA,
      createdById: admin.id,
      status: OrderStatus.IN_DIAGNOSIS,
      assignedTechnicianId: technician.id,
    });
    const after = await asUser(app, technician).get('/dashboard/summary');
    expect((after.body as DashboardSummary).openOrders).toBe(1);
  });

  it('orders-by-status returns every status with counts', async () => {
    const response = await asUser(app, admin).get(
      `/dashboard/orders-by-status?branchId=${branchB}`,
    );
    const body = response.body as { status: string; count: number }[];
    expect(body).toHaveLength(9);
    expect(body.find((s) => s.status === 'RECEIVED')?.count).toBe(1);
    expect(body.find((s) => s.status === 'CANCELED')?.count).toBe(1);
  });

  it('revenue-by-month buckets the current month and fills empty ones', async () => {
    const response = await asUser(app, admin).get('/dashboard/revenue-by-month?months=3');
    const body = response.body as { month: string; revenueCents: number }[];
    expect(body).toHaveLength(3);
    expect(body[2]?.revenueCents).toBe(50000); // current month is the last bucket
    expect(body[0]?.revenueCents).toBe(0);
  });

  it('branches-comparison is ADMIN-only and compares branches', async () => {
    const attendant = await createUser({ tenantId, role: Role.ATTENDANT });
    const denied = await asUser(app, attendant).get('/dashboard/branches-comparison');
    expect(denied.status).toBe(403);

    const response = await asUser(app, admin).get('/dashboard/branches-comparison');
    expect(response.status).toBe(200);
    const body = response.body as { branchName: string; revenueCents: number }[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.find((b) => b.branchName === 'Filial A')?.revenueCents).toBe(50000);
  });

  it('RN-11: another tenant sees zeros, never this tenant data', async () => {
    const otherTenant = await createTenant();
    const intruder = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });
    const response = await asUser(app, intruder).get('/dashboard/summary');
    const body = response.body as DashboardSummary;
    expect(body.openOrders).toBe(0);
    expect(body.revenueCents).toBe(0);
  });
});
