import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { API_PREFIX, Role, loginBodySchema, type LoginBody, type LoginResponse, type MeResponse } from '@ofix/shared';
import type { Request, Response } from 'express';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService, REFRESH_TOKEN_TTL_MS } from './auth.service';

export const REFRESH_COOKIE = 'ofix_refresh';

function setRefreshCookie(response: Response, token: string): void {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // The browser only sends the cookie to auth routes (ADR-008).
    path: `/${API_PREFIX}/auth`,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // brute-force budget (spec 003)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const { accessToken, refreshToken, user } = await this.authService.login(body);
    setRefreshCookie(response, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const cookies = request.cookies as Record<string, string | undefined>;
    const { accessToken, refreshToken, user } = await this.authService.refresh(
      cookies[REFRESH_COOKIE],
    );
    setRefreshCookie(response, refreshToken);
    return { accessToken, user };
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const cookies = request.cookies as Record<string, string | undefined>;
    await this.authService.logout(cookies[REFRESH_COOKIE]);
    response.clearCookie(REFRESH_COOKIE, { path: `/${API_PREFIX}/auth` });
  }

  @Roles(Role.ADMIN, Role.TECHNICIAN, Role.ATTENDANT)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
    return this.authService.me(user);
  }
}
