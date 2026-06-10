import { Prisma } from '@prisma/client';

import { TenantIsolationError } from '../../common/errors/tenant-isolation.error';

/**
 * Models that carry a `tenantId` column and MUST always be queried inside a
 * tenant scope (ADR-002). Deliberate exceptions:
 * - Tenant: the boundary itself (managed by operational scripts).
 * - OrderCodeSequence: addressed by composite key ([tenantId, year]) in code.
 * - RefreshToken: looked up by token hash/user during auth, before a tenant
 *   scope exists.
 * - QuoteItem: has no tenantId; only reachable through its Quote, which is
 *   scoped.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<Prisma.ModelName> = new Set<Prisma.ModelName>([
  'Branch',
  'User',
  'Customer',
  'Equipment',
  'ServiceOrder',
  'Quote',
  'OrderEvent',
]);

const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

interface ScopableArgs {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
}

function withTenant(
  target: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  // Spreading first makes the injected tenantId win over anything the caller
  // passed — a spoofed tenantId can never widen the scope.
  return { ...target, tenantId };
}

/**
 * Prisma Client Extension that enforces tenant isolation: injects the ambient
 * tenantId into every read/write against tenant-scoped models and throws
 * TenantIsolationError when there is no tenant in context.
 *
 * Known limits (documented in docs/database.md): raw SQL ($queryRaw) and
 * nested relation writes bypass the extension — both are forbidden in domain
 * code by convention and review.
 */
export function createTenantExtension(getTenantId: () => string | undefined) {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }
          const tenantId = getTenantId();
          if (tenantId === undefined) {
            throw new TenantIsolationError(model, operation);
          }

          // The per-operation args union collapses to the structural shape we
          // mutate; every branch below only touches fields that exist for the
          // operations it guards.
          const scoped = args as ScopableArgs;

          if (WHERE_OPERATIONS.has(operation)) {
            scoped.where = withTenant(scoped.where, tenantId);
          }
          if (operation === 'create' && !Array.isArray(scoped.data)) {
            scoped.data = withTenant(scoped.data, tenantId);
          }
          if (operation === 'createMany' || operation === 'createManyAndReturn') {
            scoped.data = Array.isArray(scoped.data)
              ? scoped.data.map((row) => withTenant(row, tenantId))
              : withTenant(scoped.data, tenantId);
          }
          if (operation === 'upsert') {
            scoped.where = withTenant(scoped.where, tenantId);
            scoped.create = withTenant(scoped.create, tenantId);
          }

          return query(args);
        },
      },
    },
  });
}
