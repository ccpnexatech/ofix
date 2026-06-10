import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath, tokenFor } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  DEFAULT_TEST_PASSWORD,
  createBranch,
  createTenant,
  createUser,
  testDb,
} from '../../../test/factories';
import { REFRESH_COOKIE } from './auth.controller';

function refreshCookieOf(response: Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  const pair = cookie?.split(';')[0];
  if (pair === undefined) {
    throw new Error('refresh cookie not set in response');
  }
  return pair;
}

describe('auth (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('returns access token, user and httpOnly refresh cookie', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id });

      const response = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        accessToken: expect.any(String) as unknown,
        user: { id: user.id, tenantId: tenant.id, role: user.role },
      });
      const rawCookie = (response.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(`${REFRESH_COOKIE}=`),
      );
      expect(rawCookie).toContain('HttpOnly');
      expect(rawCookie).toContain('SameSite=Lax');
      expect(rawCookie).toContain('Path=/api/v1/auth');
    });

    it('answers the same 401 for wrong password and unknown e-mail (no enumeration)', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id });

      const wrongPassword = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: 'wrong-password-1' });
      const unknownEmail = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: 'ghost@test.dev', password: 'wrong-password-1' });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });

    it('rejects inactive users with the same generic 401', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id, isActive: false });

      const response = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });
      expect(response.status).toBe(401);
    });

    it('validates the body with the shared schema (password >= 8)', async () => {
      const response = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: 'user@test.dev', password: 'short' });
      expect(response.status).toBe(400);
    });

    it('asks for tenantSlug when the e-mail exists in two tenants, then logs into the right one', async () => {
      const tenantA = await createTenant();
      const tenantB = await createTenant();
      const email = `dup-${tenantA.slug}@test.dev`;
      await createUser({ tenantId: tenantA.id, email });
      await createUser({ tenantId: tenantB.id, email });

      const withoutSlug = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email, password: DEFAULT_TEST_PASSWORD });
      expect(withoutSlug.status).toBe(400);
      // Standard error envelope (spec 001): the code travels in details.
      expect(withoutSlug.body).toMatchObject({ details: { code: 'TENANT_SLUG_REQUIRED' } });

      const withSlug = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email, password: DEFAULT_TEST_PASSWORD, tenantSlug: tenantB.slug });
      expect(withSlug.status).toBe(200);
      expect(withSlug.body).toMatchObject({ user: { tenantId: tenantB.id } });
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates: a refresh yields a new pair and a different cookie', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id });
      const login = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });
      const firstCookie = refreshCookieOf(login);

      const refresh = await api(app).post(apiPath('/auth/refresh')).set('Cookie', firstCookie);
      expect(refresh.status).toBe(200);
      expect(refresh.body).toMatchObject({ accessToken: expect.any(String) as unknown });
      expect(refreshCookieOf(refresh)).not.toBe(firstCookie);
    });

    it('revokes the whole family on reuse of a rotated token (theft signal)', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id });
      const login = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });
      const firstCookie = refreshCookieOf(login);

      const rotated = await api(app).post(apiPath('/auth/refresh')).set('Cookie', firstCookie);
      const secondCookie = refreshCookieOf(rotated);

      // Reusing the first (already rotated) token must fail...
      const reuse = await api(app).post(apiPath('/auth/refresh')).set('Cookie', firstCookie);
      expect(reuse.status).toBe(401);

      // ...and must also have killed the still-valid second token (family revocation).
      const afterReuse = await api(app).post(apiPath('/auth/refresh')).set('Cookie', secondCookie);
      expect(afterReuse.status).toBe(401);

      const liveSessions = await testDb().refreshToken.count({
        where: { userId: user.id, revokedAt: null },
      });
      expect(liveSessions).toBe(0);
    });

    it('rejects a missing refresh cookie', async () => {
      const response = await api(app).post(apiPath('/auth/refresh'));
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const tenant = await createTenant();
      const user = await createUser({ tenantId: tenant.id });
      const login = await api(app)
        .post(apiPath('/auth/login'))
        .send({ email: user.email, password: DEFAULT_TEST_PASSWORD });
      const cookie = refreshCookieOf(login);
      const accessToken = (login.body as { accessToken: string }).accessToken;

      const logout = await api(app)
        .post(apiPath('/auth/logout'))
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookie);
      expect(logout.status).toBe(204);

      const afterLogout = await api(app).post(apiPath('/auth/refresh')).set('Cookie', cookie);
      expect(afterLogout.status).toBe(401);
    });

    it('requires authentication', async () => {
      const response = await api(app).post(apiPath('/auth/logout'));
      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns profile, branch and completed tours', async () => {
      const tenant = await createTenant();
      const branch = await createBranch(tenant.id);
      const user = await createUser({ tenantId: tenant.id, branchId: branch.id });

      const response = await api(app)
        .get(apiPath('/auth/me'))
        .set('Authorization', `Bearer ${await tokenFor(app, user)}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: { id: user.id, branchId: branch.id },
        branch: { id: branch.id, name: branch.name },
        completedTours: [],
      });
    });

    it('returns 401 without or with an invalid token', async () => {
      const missing = await api(app).get(apiPath('/auth/me'));
      const invalid = await api(app)
        .get(apiPath('/auth/me'))
        .set('Authorization', 'Bearer not-a-jwt');
      expect(missing.status).toBe(401);
      expect(invalid.status).toBe(401);
    });
  });
});
