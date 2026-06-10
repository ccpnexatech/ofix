import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

import { assertBranchAccess } from '../branch-scope';
import type { AuthenticatedRequest } from '../authenticated-user';

/**
 * Route-level branch scope (spec 003): when the route addresses a branch
 * explicitly (`:branchId` param or `branchId` query), a user with a fixed
 * branch gets 403 on any other branch. List queries are additionally filtered
 * in services via branchScopeWhere().
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      return true; // public route: nothing to scope
    }
    const fromParams = request.params?.branchId;
    const fromQuery = request.query?.branchId;
    const requested = fromParams ?? (typeof fromQuery === 'string' ? fromQuery : undefined);
    if (requested !== undefined) {
      assertBranchAccess(user, requested);
    }
    return true;
  }
}
