import type { INestApplication } from '@nestjs/common';
import { Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import { createBranch, createTenant, createUser } from '../../../test/factories';

describe('users (integration, ADMIN-only)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    admin = await createUser({ tenantId, role: Role.ADMIN });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a user without exposing the password hash', async () => {
    const branch = await createBranch(tenantId);
    const response = await asUser(app, admin).post('/users', {
      name: 'Novo Técnico',
      email: `tec-${String(Date.now())}@test.dev`,
      password: 'senha-segura-1',
      role: Role.TECHNICIAN,
      branchId: branch.id,
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ role: Role.TECHNICIAN, branchId: branch.id });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicated e-mail in the tenant with 409', async () => {
    const email = `dup-${String(Date.now())}@test.dev`;
    await createUser({ tenantId, email });
    const response = await asUser(app, admin).post('/users', {
      name: 'Duplicado',
      email,
      password: 'senha-segura-1',
      role: Role.ATTENDANT,
    });
    expect(response.status).toBe(409);
  });

  it('rejects an invalid branch with 422', async () => {
    const response = await asUser(app, admin).post('/users', {
      name: 'Sem Filial',
      email: `nofilial-${String(Date.now())}@test.dev`,
      password: 'senha-segura-1',
      role: Role.ATTENDANT,
      branchId: '00000000-0000-4000-8000-000000000000',
    });
    expect(response.status).toBe(422);
  });

  it('updates role/isActive and 404s a missing user', async () => {
    const target = await createUser({ tenantId, role: Role.ATTENDANT });
    const updated = await asUser(app, admin).patch(`/users/${target.id}`, {
      role: Role.TECHNICIAN,
      isActive: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ role: Role.TECHNICIAN, isActive: false });

    const missing = await asUser(app, admin).patch(
      '/users/00000000-0000-4000-8000-000000000000',
      { isActive: true },
    );
    expect(missing.status).toBe(404);
  });

  it('PATCH /users/me/tours records tours idempotently for any role (spec 009)', async () => {
    const technician = await createUser({ tenantId, role: Role.TECHNICIAN });

    const first = await asUser(app, technician).patch('/users/me/tours', {
      tourId: 'dashboard',
    });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ completedTours: ['dashboard'] });

    const again = await asUser(app, technician).patch('/users/me/tours', {
      tourId: 'dashboard',
    });
    expect(again.body).toEqual({ completedTours: ['dashboard'] });

    const second = await asUser(app, technician).patch('/users/me/tours', {
      tourId: 'orders-list',
    });
    expect(second.body).toEqual({ completedTours: ['dashboard', 'orders-list'] });

    const invalid = await asUser(app, technician).patch('/users/me/tours', {
      tourId: 'NOT VALID!',
    });
    expect(invalid.status).toBe(400);
  });

  it('RN-11: an admin of tenant B cannot update a user of tenant A (404)', async () => {
    const target = await createUser({ tenantId });
    const otherTenant = await createTenant();
    const intruder = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });

    const response = await asUser(app, intruder).patch(`/users/${target.id}`, {
      isActive: false,
    });
    expect(response.status).toBe(404);
  });

  it('RN-11: listing only shows users of the requesting tenant', async () => {
    const otherTenant = await createTenant();
    const foreign = await createUser({ tenantId: otherTenant.id });

    const response = await asUser(app, admin).get('/users?perPage=100');
    const ids = (response.body as { data: { id: string }[] }).data.map((u) => u.id);
    expect(ids).toContain(admin.id);
    expect(ids).not.toContain(foreign.id);
  });
});
