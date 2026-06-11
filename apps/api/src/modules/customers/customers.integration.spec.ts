import type { INestApplication } from '@nestjs/common';
import { Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath, asUser, expectTenantIsolation } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createCustomer,
  createEquipment,
  createOrder,
  createTenant,
  createUser,
  type CreateUserOptions,
} from '../../../test/factories';

describe('customers & equipments (integration)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;

  const newUser = (options: Partial<CreateUserOptions> = {}) =>
    createUser({ tenantId, ...options });

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    admin = await newUser({ role: Role.ADMIN });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, reads and updates a customer (happy path)', async () => {
    const created = await asUser(app, admin).post('/customers', {
      name: 'Maria Silva',
      phone: '85 98888-7777',
      email: 'Maria@Gmail.com',
    });
    expect(created.status).toBe(201);
    const body = created.body as { id: string; email: string; tenantId: string };
    expect(body.email).toBe('maria@gmail.com'); // normalized by the shared schema
    expect(body.tenantId).toBe(tenantId);

    const fetched = await asUser(app, admin).get(`/customers/${body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({ name: 'Maria Silva', equipments: [] });

    const updated = await asUser(app, admin).patch(`/customers/${body.id}`, {
      notes: 'Cliente preferencial',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ notes: 'Cliente preferencial' });
  });

  it('validates the body with the shared schema (422-style 400)', async () => {
    const response = await asUser(app, admin).post('/customers', { name: 'X', phone: '1' });
    expect(response.status).toBe(400);
  });

  it('searches by name and paginates with meta', async () => {
    const needle = `Busca-${String(Date.now())}`;
    await createCustomer(tenantId, { name: `${needle} Um` });
    await createCustomer(tenantId, { name: `${needle} Dois` });
    await createCustomer(tenantId, { name: 'Outro Cliente' });

    const response = await asUser(app, admin).get(
      `/customers?search=${needle}&page=1&perPage=1`,
    );
    expect(response.status).toBe(200);
    const body = response.body as { data: unknown[]; meta: Record<string, number> };
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ page: 1, perPage: 1, total: 2, totalPages: 2 });
  });

  it('returns 404 for a missing customer and 401 without a token', async () => {
    const missing = await asUser(app, admin).get(
      '/customers/00000000-0000-4000-8000-000000000000',
    );
    expect(missing.status).toBe(404);
    const unauthenticated = await api(app).get(apiPath('/customers'));
    expect(unauthenticated.status).toBe(401);
  });

  it('RN-11: tenant B cannot read a customer of tenant A', async () => {
    await expectTenantIsolation(app, {
      createResource: async ({ tenantId: otherTenant }) => {
        const customer = await createCustomer(otherTenant);
        return `/customers/${customer.id}`;
      },
    });
  });

  it('TECHNICIAN cannot create or update customers (matrix)', async () => {
    const technician = await newUser({ role: Role.TECHNICIAN });
    const customer = await createCustomer(tenantId);

    const create = await asUser(app, technician).post('/customers', {
      name: 'Novo',
      phone: '85 90000-0000',
    });
    const update = await asUser(app, technician).patch(`/customers/${customer.id}`, {
      name: 'Editado',
    });
    expect(create.status).toBe(403);
    expect(update.status).toBe(403);
  });

  it('adds and edits equipments of a customer', async () => {
    const customer = await createCustomer(tenantId);
    const created = await asUser(app, admin).post(`/customers/${customer.id}/equipments`, {
      type: 'Smartphone',
      brand: 'Samsung',
      model: 'Galaxy S24',
    });
    expect(created.status).toBe(201);
    const equipment = created.body as { id: string };

    const updated = await asUser(app, admin).patch(`/equipments/${equipment.id}`, {
      notes: 'Tela trincada na entrada',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ notes: 'Tela trincada na entrada' });
  });

  it('RN-11: tenant B cannot update an equipment of tenant A (404)', async () => {
    const customer = await createCustomer(tenantId);
    const equipment = await createEquipment(tenantId, customer.id);
    const otherTenant = await createTenant();
    const intruder = await createUser({ tenantId: otherTenant.id });

    const response = await asUser(app, intruder).patch(`/equipments/${equipment.id}`, {
      notes: 'invasão',
    });
    expect(response.status).toBe(404);
  });

  it('RN-12: customer order history is branch-scoped for fixed-branch users', async () => {
    const branchA = await createBranch(tenantId);
    const branchB = await createBranch(tenantId);
    const customer = await createCustomer(tenantId);
    await createOrder({
      tenantId,
      branchId: branchA.id,
      customerId: customer.id,
      createdById: admin.id,
    });
    await createOrder({
      tenantId,
      branchId: branchB.id,
      customerId: customer.id,
      createdById: admin.id,
    });

    const fixedUser = await newUser({ role: Role.ATTENDANT, branchId: branchA.id });
    const scoped = await asUser(app, fixedUser).get(`/customers/${customer.id}/orders`);
    expect(scoped.status).toBe(200);
    expect((scoped.body as { data: { branchId: string }[] }).data).toHaveLength(1);

    const full = await asUser(app, admin).get(`/customers/${customer.id}/orders`);
    expect((full.body as { data: unknown[] }).data).toHaveLength(2);
  });
});
