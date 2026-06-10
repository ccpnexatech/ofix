/**
 * Thrown by the Prisma tenant extension when a query against a tenant-scoped
 * model runs without a tenant in the request context (ADR-002). This is a
 * programming error, never a user error: there is no legitimate code path
 * that reaches a domain model outside a tenant scope.
 */
export class TenantIsolationError extends Error {
  constructor(
    readonly model: string,
    readonly operation: string,
  ) {
    super(
      `Operation "${operation}" on tenant-scoped model "${model}" was attempted without a tenant in context`,
    );
    this.name = 'TenantIsolationError';
  }
}
