import { createHash, randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthUser, LoginBody, MeResponse } from '@ofix/shared';
import * as argon2 from 'argon2';
import type { User } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { PrismaService } from '../../infra/prisma/prisma.service';

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (ADR-008)

/**
 * Argon2id parameters (spec 003). OWASP-recommended baseline: 19 MiB memory,
 * 2 iterations, parallelism 1 — interactive-login budget (~50ms) while making
 * GPU cracking of a leaked database impractical.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Refresh tokens have 256 bits of entropy; SHA-256 at rest is enough (ADR-008). */
function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    branchId: user.branchId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(body: LoginBody): Promise<IssuedTokens> {
    // Unscoped on purpose: there is no tenant context before login (ADR-002 exception).
    const candidates = await this.prisma.unscoped.user.findMany({
      where: { email: body.email, isActive: true },
      include: { tenant: { select: { slug: true, isActive: true } } },
    });
    const active = candidates.filter((candidate) => candidate.tenant.isActive);

    let user: (typeof active)[number] | undefined;
    if (active.length > 1) {
      // Same e-mail in more than one tenant: ask for the slug (spec 003).
      if (body.tenantSlug === undefined) {
        throw new BadRequestException({
          message: 'Informe o tenant para este e-mail',
          code: 'TENANT_SLUG_REQUIRED',
        });
      }
      user = active.find((candidate) => candidate.tenant.slug === body.tenantSlug);
    } else {
      user = active[0];
      if (user && body.tenantSlug !== undefined && user.tenant.slug !== body.tenantSlug) {
        user = undefined;
      }
    }

    // Generic failure (no e-mail enumeration); verify against a dummy hash to
    // keep "unknown user" and "wrong password" in the same time ballpark.
    if (!user) {
      await argon2.verify(await this.dummyHash(), body.password).catch(() => false);
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const passwordOk = await argon2.verify(user.passwordHash, body.password).catch(() => false);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens(user);
  }

  /** Rotation (ADR-008): each refresh revokes the used token and issues a new pair. */
  async refresh(rawToken: string | undefined): Promise<IssuedTokens> {
    if (rawToken === undefined || rawToken === '') {
      throw new UnauthorizedException('Refresh token ausente');
    }
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await this.prisma.unscoped.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored?.user.isActive) {
      throw new UnauthorizedException('Sessão inválida');
    }

    if (stored.revokedAt !== null) {
      // Reuse of a revoked token = theft signal: kill the whole family (all
      // sessions of this user) and log it (spec 003).
      await this.prisma.unscoped.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId} — all sessions revoked`,
      );
      throw new UnauthorizedException('Sessão inválida');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada');
    }

    await this.prisma.unscoped.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user);
  }

  /** Idempotent: revokes the session of the given refresh token, if any. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken === undefined || rawToken === '') {
      return;
    }
    await this.prisma.unscoped.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Runs inside the tenant scope (TenantContextInterceptor). */
  async me(authenticated: AuthenticatedUser): Promise<MeResponse> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: authenticated.id },
      include: { branch: { select: { id: true, name: true, city: true, state: true } } },
    });
    return {
      user: toAuthUser(user),
      branch: user.branch,
      completedTours: user.completedTours,
    };
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role: user.role,
      name: user.name,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(32).toString('base64url'); // 256 bits
    await this.prisma.unscoped.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken, user: toAuthUser(user) };
  }

  private dummyHashValue: string | undefined;

  private async dummyHash(): Promise<string> {
    this.dummyHashValue ??= await argon2.hash('dummy-password-for-timing', ARGON2_OPTIONS);
    return this.dummyHashValue;
  }
}
