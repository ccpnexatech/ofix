import type { INestApplication } from '@nestjs/common';
import { Role, type BranchSummary } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import { createBranch, createTenant, createUser } from '../../../test/factories';

describe('branches management (integration, ADR-013)', () => {
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

  it('ADMIN creates a branch; it shows up in the tenant list with string coordinates', async () => {
    const response = await asUser(app, admin).post('/branches', {
      name: 'Filial Aldeota',
      address: 'Av. Santos Dumont, 1500',
      city: 'Fortaleza',
      state: 'ce',
      latitude: -3.7327,
      longitude: -38.4967,
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'Filial Aldeota',
      state: 'CE',
      phone: null,
      latitude: '-3.7327',
      longitude: '-38.4967',
    });

    const list = await asUser(app, admin).get('/branches');
    const names = (list.body as BranchSummary[]).map((branch) => branch.name);
    expect(names).toContain('Filial Aldeota');
  });

  it('rejects a duplicated name in the tenant with 409 — but allows it in another tenant', async () => {
    await createBranch(tenantId, { name: 'Filial Centro' });
    const duplicate = await asUser(app, admin).post('/branches', {
      name: 'Filial Centro',
      address: 'Rua Qualquer, 1',
      city: 'Fortaleza',
      state: 'CE',
    });
    expect(duplicate.status).toBe(409);

    const otherTenant = await createTenant();
    const otherAdmin = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });
    const sameNameElsewhere = await asUser(app, otherAdmin).post('/branches', {
      name: 'Filial Centro',
      address: 'Rua Qualquer, 1',
      city: 'Recife',
      state: 'PE',
    });
    expect(sameNameElsewhere.status).toBe(201);
  });

  it('rejects creation by non-ADMIN with 403 and an invalid body with 400', async () => {
    const attendant = await createUser({ tenantId, role: Role.ATTENDANT });
    const forbidden = await asUser(app, attendant).post('/branches', {
      name: 'Filial Bloqueada',
      address: 'Rua Sem Permissão, 10',
      city: 'Fortaleza',
      state: 'CE',
    });
    expect(forbidden.status).toBe(403);

    const invalid = await asUser(app, admin).post('/branches', {
      name: 'Filial Inválida',
      address: 'Rua Errada, 20',
      city: 'Fortaleza',
      state: 'Ceará',
    });
    expect(invalid.status).toBe(400);
  });

  it('updates branch fields, clears coordinates with null and 404s a missing branch', async () => {
    const branch = await createBranch(tenantId, { name: 'Filial Editável' });
    const updated = await asUser(app, admin).patch(`/branches/${branch.id}`, {
      phone: '(85) 99999-0000',
      latitude: null,
      longitude: null,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      phone: '(85) 99999-0000',
      latitude: null,
      longitude: null,
    });

    const missing = await asUser(app, admin).patch(
      '/branches/00000000-0000-4000-8000-000000000000',
      { name: 'Não Existe' },
    );
    expect(missing.status).toBe(404);
  });

  it('rejects renaming to an existing branch name with 409', async () => {
    await createBranch(tenantId, { name: 'Filial Alfa' });
    const beta = await createBranch(tenantId, { name: 'Filial Beta' });
    const response = await asUser(app, admin).patch(`/branches/${beta.id}`, {
      name: 'Filial Alfa',
    });
    expect(response.status).toBe(409);
  });

  it('RN-11: an admin of tenant B cannot update a branch of tenant A (404)', async () => {
    const branch = await createBranch(tenantId, { name: 'Filial Protegida' });
    const otherTenant = await createTenant();
    const intruder = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });

    const response = await asUser(app, intruder).patch(`/branches/${branch.id}`, {
      name: 'Invadida',
    });
    expect(response.status).toBe(404);
  });
});
