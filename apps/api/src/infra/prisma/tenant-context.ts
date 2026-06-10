import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantContext {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with `tenantId` as the ambient tenant. Every Prisma query against
 * a tenant-scoped model inside `fn` (sync or async) is automatically scoped.
 * From phase 2 on, the auth guard wraps each request in this.
 *
 * PrismaPromise is lazy: the query only executes when awaited. Always await
 * queries INSIDE the callback — returning a bare PrismaPromise and awaiting
 * it outside loses the context and throws TenantIsolationError.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

export function currentTenantId(): string | undefined {
  return storage.getStore()?.tenantId;
}
