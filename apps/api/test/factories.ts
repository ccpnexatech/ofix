import { randomUUID } from 'node:crypto';

import { PrismaClient, Role, type Branch, type Tenant, type User } from '@prisma/client';
import * as argon2 from 'argon2';

import { ARGON2_OPTIONS } from '../src/modules/auth/auth.service';
import { testDatabaseUrl } from './database';

/**
 * Typed factories (spec 008): composable builders with realistic defaults.
 * Every record gets unique identifiers so suites never collide.
 */

export const DEFAULT_TEST_PASSWORD = 'correct-horse-9!';

let client: PrismaClient | undefined;

/** Raw client against the test database, for fixtures and assertions. */
export function testDb(): PrismaClient {
  client ??= new PrismaClient({ datasourceUrl: testDatabaseUrl() });
  return client;
}

// Argon2id is deliberately slow; hash the shared default password once.
let defaultPasswordHash: string | undefined;
async function passwordHash(password: string): Promise<string> {
  if (password === DEFAULT_TEST_PASSWORD) {
    defaultPasswordHash ??= await argon2.hash(DEFAULT_TEST_PASSWORD, ARGON2_OPTIONS);
    return defaultPasswordHash;
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function createTenant(overrides: Partial<Tenant> = {}): Promise<Tenant> {
  const suffix = randomUUID().slice(0, 8);
  return testDb().tenant.create({
    data: {
      name: overrides.name ?? `Tenant ${suffix}`,
      slug: overrides.slug ?? `tenant-${suffix}`,
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function createBranch(
  tenantId: string,
  overrides: Partial<Branch> = {},
): Promise<Branch> {
  const suffix = randomUUID().slice(0, 8);
  return testDb().branch.create({
    data: {
      tenantId,
      name: overrides.name ?? `Filial ${suffix}`,
      address: overrides.address ?? 'Rua de Teste, 100',
      city: overrides.city ?? 'Fortaleza',
      state: overrides.state ?? 'CE',
      isActive: overrides.isActive ?? true,
    },
  });
}

export interface CreateUserOptions {
  tenantId: string;
  role?: Role;
  branchId?: string | null;
  email?: string;
  password?: string;
  isActive?: boolean;
}

export async function createUser(options: CreateUserOptions): Promise<User> {
  const suffix = randomUUID().slice(0, 8);
  return testDb().user.create({
    data: {
      tenantId: options.tenantId,
      branchId: options.branchId ?? null,
      name: `User ${suffix}`,
      email: options.email ?? `user-${suffix}@test.dev`,
      passwordHash: await passwordHash(options.password ?? DEFAULT_TEST_PASSWORD),
      role: options.role ?? Role.ADMIN,
      isActive: options.isActive ?? true,
    },
  });
}
