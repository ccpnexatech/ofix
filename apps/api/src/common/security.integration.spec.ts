import { Controller, Get, NotFoundException, Param, Query, UseGuards, type INestApplication } from '@nestjs/common';
import { Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath, expectTenantIsolation, tokenFor } from '../../test/api';
import { createTestApp } from '../../test/app';
import { createBranch, createTenant, createUser, testDb } from '../../test/factories';
import { PrismaService } from '../infra/prisma/prisma.service';
import { Roles } from './decorators/roles.decorator';
import { BranchScopeGuard } from './guards/branch-scope.guard';

// Test-only routes exercising the full pipeline (guards -> interceptor ->
// Prisma extension) ahead of the real domain endpoints of phase 3.
@Controller('test-security')
class TestSecurityController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Get('customers/:id')
  async customer(@Param('id') id: string) {
    const customer = await this.prisma.client.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException();
    }
    return customer;
  }

  @Roles(Role.ADMIN)
  @Get('admin-only')
  adminOnly(): { ok: boolean } {
    return { ok: true };
  }

  // Deliberately missing @Roles: RolesGuard must deny by default.
  @Get('forgotten-annotation')
  forgotten(): { ok: boolean } {
    return { ok: true };
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @UseGuards(BranchScopeGuard)
  @Get('branch-scoped')
  branchScoped(@Query('branchId') _branchId?: string): { ok: boolean } {
    return { ok: true };
  }
}

describe('request security pipeline (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestSecurityController] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('tenant A user gets 404 on a tenant B resource (expectTenantIsolation)', async () => {
    await expectTenantIsolation(app, {
      createResource: async ({ tenantId }) => {
        const customer = await testDb().customer.create({
          data: { tenantId, name: 'Cliente Isolado', phone: '85 90000-0000' },
        });
        return `/test-security/customers/${customer.id}`;
      },
    });
  });

  it('GET /branches only lists branches of the requesting tenant', async () => {
    const tenantA = await createTenant();
    const branchA = await createBranch(tenantA.id);
    const tenantB = await createTenant();
    await createBranch(tenantB.id);
    const userA = await createUser({ tenantId: tenantA.id });

    const response = await api(app)
      .get(apiPath('/branches'))
      .set('Authorization', `Bearer ${await tokenFor(app, userA)}`);

    expect(response.status).toBe(200);
    const branches = response.body as { id: string }[];
    expect(branches).toHaveLength(1);
    expect(branches[0]?.id).toBe(branchA.id);
  });

  it('denies by default a route without @Roles and without @Public', async () => {
    const tenant = await createTenant();
    const admin = await createUser({ tenantId: tenant.id, role: Role.ADMIN });

    const response = await api(app)
      .get(apiPath('/test-security/forgotten-annotation'))
      .set('Authorization', `Bearer ${await tokenFor(app, admin)}`);
    expect(response.status).toBe(403);
  });

  it('enforces RBAC: TECHNICIAN gets 403 on an ADMIN-only route', async () => {
    const tenant = await createTenant();
    const technician = await createUser({ tenantId: tenant.id, role: Role.TECHNICIAN });
    const admin = await createUser({ tenantId: tenant.id, role: Role.ADMIN });

    const denied = await api(app)
      .get(apiPath('/test-security/admin-only'))
      .set('Authorization', `Bearer ${await tokenFor(app, technician)}`);
    const allowed = await api(app)
      .get(apiPath('/test-security/admin-only'))
      .set('Authorization', `Bearer ${await tokenFor(app, admin)}`);

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
  });

  it('blocks a fixed-branch user from addressing another branch (403)', async () => {
    const tenant = await createTenant();
    const ownBranch = await createBranch(tenant.id);
    const otherBranch = await createBranch(tenant.id);
    const fixedUser = await createUser({
      tenantId: tenant.id,
      role: Role.ATTENDANT,
      branchId: ownBranch.id,
    });
    const tenantWideUser = await createUser({ tenantId: tenant.id, role: Role.ADMIN });

    const ownAllowed = await api(app)
      .get(apiPath(`/test-security/branch-scoped?branchId=${ownBranch.id}`))
      .set('Authorization', `Bearer ${await tokenFor(app, fixedUser)}`);
    const otherDenied = await api(app)
      .get(apiPath(`/test-security/branch-scoped?branchId=${otherBranch.id}`))
      .set('Authorization', `Bearer ${await tokenFor(app, fixedUser)}`);
    const wideAllowed = await api(app)
      .get(apiPath(`/test-security/branch-scoped?branchId=${otherBranch.id}`))
      .set('Authorization', `Bearer ${await tokenFor(app, tenantWideUser)}`);

    expect(ownAllowed.status).toBe(200);
    expect(otherDenied.status).toBe(403);
    expect(wideAllowed.status).toBe(200);
  });

  it('rejects unauthenticated access to protected routes but keeps health public', async () => {
    const protectedRoute = await api(app).get(apiPath('/branches'));
    const health = await api(app).get(apiPath('/health'));
    expect(protectedRoute.status).toBe(401);
    expect(health.status).toBe(200);
  });
});
