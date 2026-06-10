import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { testDatabaseUrl } from '../../../test/database';
import { TenantIsolationError } from '../../common/errors/tenant-isolation.error';
import { runWithTenant } from './tenant-context';
import { createPrismaClient, type TenantScopedPrismaClient } from './prisma.service';

// Integration tests against the disposable test database (port 5433).
// They prove the two guarantees of ADR-002: (a) no tenant in context => error,
// (b) tenant A can never see or touch tenant B data.
describe('tenant isolation extension', () => {
  // Raw client = operator path (scripts); scoped client = domain path (API).
  let raw: PrismaClient;
  let scoped: TenantScopedPrismaClient;
  let tenantA: string;
  let tenantB: string;
  let customerOfB: string;

  beforeAll(async () => {
    const url = testDatabaseUrl();
    raw = new PrismaClient({ datasourceUrl: url });
    scoped = createPrismaClient(url);

    await raw.customer.deleteMany();
    await raw.user.deleteMany();
    await raw.branch.deleteMany();
    await raw.tenant.deleteMany();

    const a = await raw.tenant.create({
      data: {
        name: 'Tenant A',
        slug: 'tenant-a',
        customers: { create: { name: 'Alice of A', phone: '85 90000-0001' } },
      },
    });
    const b = await raw.tenant.create({
      data: {
        name: 'Tenant B',
        slug: 'tenant-b',
        customers: { create: { name: 'Bob of B', phone: '81 90000-0002' } },
      },
    });
    tenantA = a.id;
    tenantB = b.id;
    const bob = await raw.customer.findFirstOrThrow({ where: { tenantId: tenantB } });
    customerOfB = bob.id;
  });

  afterAll(async () => {
    await raw.$disconnect();
    await scoped.$disconnect();
  });

  it('throws TenantIsolationError when a tenant-scoped model is queried without context', async () => {
    await expect(scoped.customer.findMany()).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(
      scoped.serviceOrder.count(),
    ).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it('allows non-scoped models (Tenant) without context', async () => {
    const tenants = await scoped.tenant.findMany();
    expect(tenants).toHaveLength(2);
  });

  it('tenant A only sees its own rows', async () => {
    const customers = await runWithTenant(tenantA, async () => scoped.customer.findMany());
    expect(customers).toHaveLength(1);
    expect(customers[0]?.name).toBe('Alice of A');
    expect(customers.every((c) => c.tenantId === tenantA)).toBe(true);
  });

  it('tenant A cannot fetch a tenant B row by id', async () => {
    const fromA = await runWithTenant(tenantA, async () =>
      scoped.customer.findUnique({ where: { id: customerOfB } }),
    );
    expect(fromA).toBeNull();
    const fromB = await runWithTenant(tenantB, async () =>
      scoped.customer.findUnique({ where: { id: customerOfB } }),
    );
    expect(fromB?.name).toBe('Bob of B');
  });

  it('create injects the ambient tenantId, overriding a spoofed one', async () => {
    const created = await runWithTenant(tenantA, async () =>
      scoped.customer.create({
        // Deliberate spoof attempt: the extension must win.
        data: { tenantId: tenantB, name: 'Mallory', phone: '85 90000-0003' },
      }),
    );
    expect(created.tenantId).toBe(tenantA);
    await raw.customer.delete({ where: { id: created.id } });
  });

  it('tenant A cannot update or delete tenant B rows', async () => {
    const updated = await runWithTenant(tenantA, async () =>
      scoped.customer.updateMany({
        where: { id: customerOfB },
        data: { name: 'hacked' },
      }),
    );
    expect(updated.count).toBe(0);

    const deleted = await runWithTenant(tenantA, async () =>
      scoped.customer.deleteMany({ where: { id: customerOfB } }),
    );
    expect(deleted.count).toBe(0);

    const stillThere = await raw.customer.findUnique({ where: { id: customerOfB } });
    expect(stillThere?.name).toBe('Bob of B');
  });
});
