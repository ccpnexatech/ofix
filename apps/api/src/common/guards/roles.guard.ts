import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@ofix/shared';

import type { AuthenticatedRequest } from '../authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global guard enforcing RBAC with deny-by-default (spec 003): a route that is
 * neither @Public() nor annotated with @Roles() is always forbidden, so a
 * forgotten annotation fails loudly in the first manual or automated test.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) {
      throw new ForbiddenException(
        'Rota sem @Roles() nem @Public() — RBAC nega por padrão (spec 003)',
      );
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Acesso negado para o seu papel');
    }
    return true;
  }
}
