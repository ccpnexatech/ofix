import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { API_PREFIX, type AccessTokenPayload } from '@ofix/shared';
import type { User } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';
import { expect } from 'vitest';

import { createBranch, createTenant, createUser } from './factories';

/** Prefixes a route with the API global prefix. */
export function apiPath(path: string): string {
  return `/${API_PREFIX}${path}`;
}

/** Supertest agent for the app under test. */
export function api(app: INestApplication<App>) {
  return request(app.getHttpServer());
}

/** Signs a real access token for `user` (spec 008 helper: api.as(user)). */
export async function tokenFor(app: INestApplication<App>, user: User): Promise<string> {
  const payload: AccessTokenPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    role: user.role,
    name: user.name,
  };
  return app.get(JwtService).signAsync(payload);
}

export interface TenantIsolationTarget {
  /**
   * Creates a resource in the given tenant/branch and returns the path of the
   * endpoint that exposes it (e.g. `/customers/{id}`).
   */
  createResource: (ctx: { tenantId: string; branchId: string }) => Promise<string>;
}

/**
 * Spec 008 mandatory helper: creates the resource in tenant A and proves a
 * tenant B user gets 404/403 on it (while a tenant A user can read it).
 * Every authenticated resource endpoint must be covered by this.
 */
export async function expectTenantIsolation(
  app: INestApplication<App>,
  target: TenantIsolationTarget,
): Promise<void> {
  const tenantA = await createTenant();
  const branchA = await createBranch(tenantA.id);
  const userA = await createUser({ tenantId: tenantA.id });
  const tenantB = await createTenant();
  const userB = await createUser({ tenantId: tenantB.id });

  const path = await target.createResource({ tenantId: tenantA.id, branchId: branchA.id });

  const asA = await api(app)
    .get(apiPath(path))
    .set('Authorization', `Bearer ${await tokenFor(app, userA)}`);
  expect(asA.status).toBe(200);

  const asB = await api(app)
    .get(apiPath(path))
    .set('Authorization', `Bearer ${await tokenFor(app, userB)}`);
  expect([403, 404]).toContain(asB.status);
}
