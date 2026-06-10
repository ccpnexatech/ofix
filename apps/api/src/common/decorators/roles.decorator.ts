import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ofix/shared';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles may call a route. Mandatory on every non-@Public()
 * route: the RolesGuard denies by default when the metadata is missing.
 */
export const Roles = (...roles: [Role, ...Role[]]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
