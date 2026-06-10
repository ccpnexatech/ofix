import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import { runWithTenant } from '../../infra/prisma/tenant-context';
import type { AuthenticatedRequest } from '../authenticated-user';

/**
 * Heart of the multi-tenant request (spec 003): wraps the handler execution in
 * the tenant AsyncLocalStorage scope, so every Prisma query in services is
 * already scoped — no service ever passes tenantId by hand. Public routes have
 * no user and run unscoped (they must use explicitly unscoped queries).
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      return next.handle();
    }
    // Subscribing inside runWithTenant propagates the ALS context through the
    // whole async chain of the handler.
    return new Observable((subscriber) => {
      runWithTenant(user.tenantId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
