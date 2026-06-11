import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { PublicMapResponse } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import { createBranch, createTenant, testDb } from '../../../test/factories';

describe('public map (integration, RN-15)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('RN-15: exposes ONLY active branches with coordinates — and nothing sensitive', async () => {
    const tenant = await createTenant({ name: 'Mapa Tenant' });
    await testDb().branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Com Coordenadas',
        address: 'Rua A, 1',
        city: 'Fortaleza',
        state: 'CE',
        phone: '(85) 3000-0000',
        latitude: '-3.731862',
        longitude: '-38.526670',
      },
    });
    await createBranch(tenant.id, { name: 'Sem Coordenadas' }); // no lat/lng
    await testDb().branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Inativa',
        address: 'Rua B, 2',
        city: 'Fortaleza',
        state: 'CE',
        latitude: '-3.7',
        longitude: '-38.5',
        isActive: false,
      },
    });

    const response = await api(app).get(apiPath(`/public/map/${tenant.publicMapToken}`));
    expect(response.status).toBe(200);
    const body = response.body as PublicMapResponse;
    expect(body.tenantName).toBe('Mapa Tenant');
    expect(body.branches).toHaveLength(1);
    expect(body.branches[0]).toEqual({
      name: 'Com Coordenadas',
      address: 'Rua A, 1',
      city: 'Fortaleza',
      state: 'CE',
      phone: '(85) 3000-0000',
      lat: -3.731862,
      lng: -38.52667,
    });
    // Never orders, customers or users (RN-15) — assert the payload shape is closed.
    expect(Object.keys(body).sort()).toEqual(['branches', 'tenantName']);
  });

  it('RN-15: unknown or rotated token answers a generic 404', async () => {
    const unknown = await api(app).get(apiPath(`/public/map/${randomUUID()}`));
    expect(unknown.status).toBe(404);

    const tenant = await createTenant();
    const oldToken = tenant.publicMapToken;
    await testDb().tenant.update({
      where: { id: tenant.id },
      data: { publicMapToken: randomUUID() }, // what rotate-map-token.ts does
    });
    const rotated = await api(app).get(apiPath(`/public/map/${oldToken}`));
    expect(rotated.status).toBe(404);
  });

  it('requires no authentication', async () => {
    const tenant = await createTenant();
    const response = await api(app).get(apiPath(`/public/map/${tenant.publicMapToken}`));
    expect(response.status).toBe(200);
  });
});
