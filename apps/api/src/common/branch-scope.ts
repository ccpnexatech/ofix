import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from './authenticated-user';

/**
 * Branch scoping helpers (spec 003): a user with a fixed branchId only sees
 * that branch; branchId null means the whole tenant.
 */

/** Prisma `where` fragment services spread into branch-scoped queries (orders, dashboard). */
export function branchScopeWhere(user: AuthenticatedUser): { branchId?: string } {
  return user.branchId === null ? {} : { branchId: user.branchId };
}

/** Throws 403 when a branch-restricted user touches a resource of another branch. */
export function assertBranchAccess(user: AuthenticatedUser, resourceBranchId: string): void {
  if (user.branchId !== null && user.branchId !== resourceBranchId) {
    throw new ForbiddenException('Acesso negado a recurso de outra filial');
  }
}
