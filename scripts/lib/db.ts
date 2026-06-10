import { PrismaClient } from '@prisma/client';

import { loadDatabaseEnv } from './env';

/**
 * Raw (non tenant-scoped) Prisma client: operational scripts work across
 * tenants on purpose — they are the operator path described in ADR-007.
 */
export function createDb(): PrismaClient {
  loadDatabaseEnv();
  if (process.env.DATABASE_URL === undefined) {
    console.error(
      'DATABASE_URL não definida. Copie apps/api/.env.example para apps/api/.env e rode: docker compose up -d',
    );
    process.exit(1);
  }
  return new PrismaClient();
}
