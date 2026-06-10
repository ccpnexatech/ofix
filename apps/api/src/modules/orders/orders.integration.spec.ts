import type { INestApplication } from '@nestjs/common';
import { OrderStatus, Priority, Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser, expectTenantIsolation } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createCustomer,
  createEquipment,
  createOrder,
  createTenant,
  createUser,
  testDb,
} from '../../../test/factories';

describe('orders (integration)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;

  async function validCreateBody() {
    const customer = await createCustomer(tenantId);
    const equipment = await createEquipment(tenantId, customer.id);
    return {
      branchId,
      customerId: customer.id,
      equipmentId: equipment.id,
      reportedIssue: 'Não liga depois de queda de energia',
    };
  }

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

  describe('POST /orders', () => {
    it('creates an order with sequential code and ORDER_CREATED event (RN-09/RN-10)', async () => {
      const response = await asUser(app, admin).post('/orders', await validCreateBody());
      expect(response.status).toBe(201);
      const order = response.body as { id: string; code: string; status: string };
      expect(order.code).toMatch(/^OS-\d{4}-\d{4}$/);
      expect(order.status).toBe(OrderStatus.RECEIVED);

      const events = await testDb().orderEvent.findMany({
        where: { serviceOrderId: order.id },
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'ORDER_CREATED', toStatus: 'RECEIVED' });
    });

    it('RN-10: 20 parallel creations produce 20 unique sequential codes', async () => {
      const tenant = await createTenant();
      const branch = await createBranch(tenant.id);
      const localAdmin = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
      const customer = await createCustomer(tenant.id);
      const equipment = await createEquipment(tenant.id, customer.id);

      const responses = await Promise.all(
        Array.from({ length: 20 }, () =>
          asUser(app, localAdmin).post('/orders', {
            branchId: branch.id,
            customerId: customer.id,
            equipmentId: equipment.id,
            reportedIssue: 'Teste de concorrência de código',
          }),
        ),
      );
      const codes = responses.map((r) => (r.body as { code: string }).code);
      expect(responses.every((r) => r.status === 201)).toBe(true);
      expect(new Set(codes).size).toBe(20);
    });

    it('RN-13: different tenants can both have sequence 0001', async () => {
      const make = async () => {
        const tenant = await createTenant();
        const branch = await createBranch(tenant.id);
        const user = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
        const customer = await createCustomer(tenant.id);
        const equipment = await createEquipment(tenant.id, customer.id);
        const response = await asUser(app, user).post('/orders', {
          branchId: branch.id,
          customerId: customer.id,
          equipmentId: equipment.id,
          reportedIssue: 'Primeira OS do tenant',
        });
        return (response.body as { code: string }).code;
      };
      const [codeA, codeB] = await Promise.all([make(), make()]);
      expect(codeA).toBe(codeB); // both OS-{year}-0001
      expect(codeA).toMatch(/-0001$/);
    });

    it('rejects mismatched references with 422', async () => {
      const body = await validCreateBody();
      const otherCustomer = await createCustomer(tenantId);
      const mismatched = await asUser(app, admin).post('/orders', {
        ...body,
        customerId: otherCustomer.id, // equipment belongs to someone else
      });
      expect(mismatched.status).toBe(422);
    });

    it('RN-12: fixed-branch attendant cannot create an order in another branch', async () => {
      const otherBranch = await createBranch(tenantId);
      const attendant = await createUser({
        tenantId,
        role: Role.ATTENDANT,
        branchId: otherBranch.id,
      });
      const response = await asUser(app, attendant).post('/orders', await validCreateBody());
      expect(response.status).toBe(403);
    });
  });

  describe('GET /orders', () => {
    it('filters by status/priority and paginates', async () => {
      const tenant = await createTenant();
      const branch = await createBranch(tenant.id);
      const user = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
      await createOrder({
        tenantId: tenant.id,
        branchId: branch.id,
        createdById: user.id,
        status: OrderStatus.READY,
        priority: Priority.URGENT,
      });
      await createOrder({
        tenantId: tenant.id,
        branchId: branch.id,
        createdById: user.id,
        status: OrderStatus.RECEIVED,
      });

      const filtered = await asUser(app, user).get('/orders?status=READY&priority=URGENT');
      const body = filtered.body as { data: { status: string }[]; meta: { total: number } };
      expect(filtered.status).toBe(200);
      expect(body.meta.total).toBe(1);
      expect(body.data[0]?.status).toBe('READY');
    });

    it('searches by code and by customer name', async () => {
      const tenant = await createTenant();
      const branch = await createBranch(tenant.id);
      const user = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
      const customer = await createCustomer(tenant.id, { name: 'Zuleide Procurável' });
      const order = await createOrder({
        tenantId: tenant.id,
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        code: 'OS-2026-9876',
      });

      const byCode = await asUser(app, user).get('/orders?search=9876');
      expect((byCode.body as { meta: { total: number } }).meta.total).toBe(1);
      const byCustomer = await asUser(app, user).get('/orders?search=Zuleide');
      expect(
        (byCustomer.body as { data: { id: string }[] }).data.map((o) => o.id),
      ).toContain(order.id);
    });

    it('RN-12: forces the branch of fixed-branch users and 403s other branches', async () => {
      const tenant = await createTenant();
      const branchA = await createBranch(tenant.id);
      const branchB = await createBranch(tenant.id);
      const adminLocal = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
      await createOrder({ tenantId: tenant.id, branchId: branchA.id, createdById: adminLocal.id });
      await createOrder({ tenantId: tenant.id, branchId: branchB.id, createdById: adminLocal.id });

      const fixed = await createUser({
        tenantId: tenant.id,
        role: Role.TECHNICIAN,
        branchId: branchA.id,
      });
      const forced = await asUser(app, fixed).get('/orders');
      expect((forced.body as { data: { branchId: string }[] }).data).toEqual([
        expect.objectContaining({ branchId: branchA.id }),
      ]);

      const denied = await asUser(app, fixed).get(`/orders?branchId=${branchB.id}`);
      expect(denied.status).toBe(403);

      const adminSees = await asUser(app, adminLocal).get('/orders');
      expect((adminSees.body as { meta: { total: number } }).meta.total).toBe(2);
    });
  });

  describe('GET /orders/:id and /events', () => {
    it('returns detail with relations and the audit trail ascending', async () => {
      const created = await asUser(app, admin).post('/orders', await validCreateBody());
      const orderId = (created.body as { id: string }).id;

      const detail = await asUser(app, admin).get(`/orders/${orderId}`);
      expect(detail.status).toBe(200);
      expect(detail.body).toMatchObject({
        customer: expect.objectContaining({ name: expect.any(String) as unknown }) as unknown,
        equipment: expect.objectContaining({ brand: expect.any(String) as unknown }) as unknown,
        branch: expect.objectContaining({ id: branchId }) as unknown,
      });

      const events = await asUser(app, admin).get(`/orders/${orderId}/events`);
      expect(events.status).toBe(200);
      expect((events.body as { type: string }[])[0]?.type).toBe('ORDER_CREATED');
    });

    it('RN-11: tenant isolation on order detail', async () => {
      await expectTenantIsolation(app, {
        createResource: async ({ tenantId: otherTenant, branchId: otherBranch }) => {
          const owner = await createUser({ tenantId: otherTenant });
          const order = await createOrder({
            tenantId: otherTenant,
            branchId: otherBranch,
            createdById: owner.id,
          });
          return `/orders/${order.id}`;
        },
      });
    });
  });

  describe('PATCH /orders/:id', () => {
    it('blocks diagnosis edits after the quote is sent (editable per state)', async () => {
      const order = await createOrder({
        tenantId,
        branchId,
        createdById: admin.id,
        status: OrderStatus.QUOTE_SENT,
      });
      const response = await asUser(app, admin).patch(`/orders/${order.id}`, {
        technicalDiagnosis: 'Diagnóstico tardio que não deveria entrar',
      });
      expect(response.status).toBe(422);

      const stillEditable = await asUser(app, admin).patch(`/orders/${order.id}`, {
        priority: Priority.HIGH,
      });
      expect(stillEditable.status).toBe(200);
    });

    it('technician edits only own-order diagnosis; attendant never edits diagnosis', async () => {
      const technician = await createUser({ tenantId, role: Role.TECHNICIAN });
      const attendant = await createUser({ tenantId, role: Role.ATTENDANT });
      const mine = await createOrder({
        tenantId,
        branchId,
        createdById: admin.id,
        status: OrderStatus.IN_DIAGNOSIS,
        assignedTechnicianId: technician.id,
      });
      const notMine = await createOrder({
        tenantId,
        branchId,
        createdById: admin.id,
        status: OrderStatus.IN_DIAGNOSIS,
      });

      const ok = await asUser(app, technician).patch(`/orders/${mine.id}`, {
        technicalDiagnosis: 'Fonte queimada, precisa de substituição completa.',
      });
      expect(ok.status).toBe(200);

      const otherOrder = await asUser(app, technician).patch(`/orders/${notMine.id}`, {
        technicalDiagnosis: 'Não deveria conseguir.',
      });
      expect(otherOrder.status).toBe(403);

      const otherField = await asUser(app, technician).patch(`/orders/${mine.id}`, {
        priority: Priority.LOW,
      });
      expect(otherField.status).toBe(403);

      const attendantDiagnosis = await asUser(app, attendant).patch(`/orders/${mine.id}`, {
        technicalDiagnosis: 'Atendente não diagnostica.',
      });
      expect(attendantDiagnosis.status).toBe(403);
    });
  });

  describe('POST /orders/:id/assign', () => {
    it('assigns a technician and records the event', async () => {
      const order = await createOrder({ tenantId, branchId, createdById: admin.id });
      const technician = await createUser({ tenantId, role: Role.TECHNICIAN, branchId });

      const response = await asUser(app, admin).post(`/orders/${order.id}/assign`, {
        technicianId: technician.id,
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ assignedTechnicianId: technician.id });

      const events = await testDb().orderEvent.findMany({
        where: { serviceOrderId: order.id, type: 'TECHNICIAN_ASSIGNED' },
      });
      expect(events).toHaveLength(1);
    });

    it('rejects non-technicians and cross-branch technicians with 422', async () => {
      const order = await createOrder({ tenantId, branchId, createdById: admin.id });
      const attendant = await createUser({ tenantId, role: Role.ATTENDANT });
      const otherBranch = await createBranch(tenantId);
      const farTechnician = await createUser({
        tenantId,
        role: Role.TECHNICIAN,
        branchId: otherBranch.id,
      });

      const wrongRole = await asUser(app, admin).post(`/orders/${order.id}/assign`, {
        technicianId: attendant.id,
      });
      const wrongBranch = await asUser(app, admin).post(`/orders/${order.id}/assign`, {
        technicianId: farTechnician.id,
      });
      expect(wrongRole.status).toBe(422);
      expect(wrongBranch.status).toBe(422);
    });
  });
});
