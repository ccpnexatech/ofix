import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { accessTokenPayloadSchema } from '@ofix/shared';

import type { AuthenticatedRequest } from '../authenticated-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard: every route requires a valid Bearer access token unless
 * marked with @Public(). Populates request.user from the token claims.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token =
      typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token === undefined) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    let claims: unknown;
    try {
      claims = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }

    const payload = accessTokenPayloadSchema.safeParse(claims);
    if (!payload.success) {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }

    request.user = {
      id: payload.data.sub,
      tenantId: payload.data.tenantId,
      branchId: payload.data.branchId,
      role: payload.data.role,
      name: payload.data.name,
    };
    return true;
  }
}
