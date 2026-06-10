import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { currentTenantId } from './tenant-context';
import { createTenantExtension } from './tenant.extension';

/**
 * Builds the tenant-scoped Prisma client used everywhere in the API.
 * `datasourceUrl` is overridable so integration tests run against the
 * disposable test database (port 5433).
 */
export function createPrismaClient(datasourceUrl?: string) {
  const base = datasourceUrl ? new PrismaClient({ datasourceUrl }) : new PrismaClient();
  return base.$extends(createTenantExtension(currentTenantId));
}

export type TenantScopedPrismaClient = ReturnType<typeof createPrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: TenantScopedPrismaClient = createPrismaClient();

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
