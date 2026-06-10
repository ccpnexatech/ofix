import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { currentTenantId } from './tenant-context';
import { createTenantExtension } from './tenant.extension';

export function extendWithTenant(base: PrismaClient) {
  return base.$extends(createTenantExtension(currentTenantId));
}

/**
 * Builds the tenant-scoped Prisma client used everywhere in the API.
 * `datasourceUrl` is overridable so integration tests run against the
 * disposable test database (port 5433).
 */
export function createPrismaClient(datasourceUrl?: string) {
  const base = datasourceUrl ? new PrismaClient({ datasourceUrl }) : new PrismaClient();
  return extendWithTenant(base);
}

export type TenantScopedPrismaClient = ReturnType<typeof createPrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /**
   * Unscoped base client. ONLY for paths where a tenant scope cannot exist
   * yet — login (user lookup by e-mail across tenants) and refresh (token
   * lookup by hash). These are the documented ADR-002 exceptions; domain
   * code always uses `client`.
   */
  readonly unscoped: PrismaClient = new PrismaClient();

  /** Tenant-scoped client (shares the connection pool with `unscoped`). */
  readonly client: TenantScopedPrismaClient = extendWithTenant(this.unscoped);

  async onModuleInit(): Promise<void> {
    await this.unscoped.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.unscoped.$disconnect();
  }
}
