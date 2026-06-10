import { randomUUID } from 'node:crypto';

import {
  OrderStatus,
  PrismaClient,
  Priority,
  QuoteStatus,
  Role,
  type Branch,
  type Customer,
  type Equipment,
  type Quote,
  type ServiceOrder,
  type Tenant,
  type User,
} from '@prisma/client';
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

export async function createCustomer(
  tenantId: string,
  overrides: Partial<Customer> = {},
): Promise<Customer> {
  const suffix = randomUUID().slice(0, 8);
  return testDb().customer.create({
    data: {
      tenantId,
      name: overrides.name ?? `Cliente ${suffix}`,
      phone: overrides.phone ?? '85 99999-0000',
      email: overrides.email ?? null,
    },
  });
}

export async function createEquipment(
  tenantId: string,
  customerId: string,
  overrides: Partial<Equipment> = {},
): Promise<Equipment> {
  return testDb().equipment.create({
    data: {
      tenantId,
      customerId,
      type: overrides.type ?? 'Notebook',
      brand: overrides.brand ?? 'Dell',
      model: overrides.model ?? 'Inspiron 15',
      serialNumber: overrides.serialNumber ?? null,
    },
  });
}

export interface CreateOrderOptions {
  tenantId: string;
  branchId: string;
  createdById: string;
  customerId?: string;
  equipmentId?: string;
  status?: OrderStatus;
  priority?: Priority;
  assignedTechnicianId?: string | null;
  technicalDiagnosis?: string | null;
  deliveredAt?: Date | null;
  warrantyUntil?: Date | null;
  promisedAt?: Date | null;
  code?: string;
}

/** Composable order factory (spec 008): realistic defaults, any status. */
export async function createOrder(options: CreateOrderOptions): Promise<ServiceOrder> {
  const customerId =
    options.customerId ?? (await createCustomer(options.tenantId)).id;
  const equipmentId =
    options.equipmentId ?? (await createEquipment(options.tenantId, customerId)).id;
  return testDb().serviceOrder.create({
    data: {
      tenantId: options.tenantId,
      branchId: options.branchId,
      customerId,
      equipmentId,
      code: options.code ?? `OS-TEST-${randomUUID().slice(0, 8)}`,
      status: options.status ?? OrderStatus.RECEIVED,
      priority: options.priority ?? Priority.NORMAL,
      reportedIssue: 'Equipamento não liga após queda de energia',
      technicalDiagnosis: options.technicalDiagnosis ?? null,
      assignedTechnicianId: options.assignedTechnicianId ?? null,
      deliveredAt: options.deliveredAt ?? null,
      warrantyUntil: options.warrantyUntil ?? null,
      promisedAt: options.promisedAt ?? null,
      createdById: options.createdById,
    },
  });
}

export interface CreateQuoteOptions {
  tenantId: string;
  serviceOrderId: string;
  status?: QuoteStatus;
  version?: number;
  items?: { description: string; quantity: number; unitPriceCents: number }[];
  tokenExpiresAt?: Date | null;
}

/** Quote factory with items; totalCents derived from the items (ADR-003). */
export async function createQuote(options: CreateQuoteOptions): Promise<Quote> {
  const items = options.items ?? [
    { description: 'Troca de fonte', quantity: 1, unitPriceCents: 25000 },
  ];
  const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  return testDb().quote.create({
    data: {
      tenantId: options.tenantId,
      serviceOrderId: options.serviceOrderId,
      version: options.version ?? 1,
      status: options.status ?? QuoteStatus.DRAFT,
      totalCents,
      tokenExpiresAt: options.tokenExpiresAt ?? null,
      items: {
        create: items.map((item) => ({
          kind: 'PART',
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.quantity * item.unitPriceCents,
        })),
      },
    },
  });
}
