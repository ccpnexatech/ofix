import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, AuthenticatedUser } from '../authenticated-user';

/** Injects the authenticated user (set by JwtAuthGuard) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Only reachable if a non-@Public route skipped the JwtAuthGuard — a wiring bug.
      throw new Error('CurrentUser used on a route without an authenticated user');
    }
    return request.user;
  },
);
