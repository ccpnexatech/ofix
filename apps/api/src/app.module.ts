import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { loadEnv } from './infra/config/env';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Global rate limit: 100 req/min/IP (spec 003). Stricter route budgets
    // (login 5/min, /public/* 20/min) are set with @Throttle at the route.
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const env = loadEnv();
        return {
          throttlers: [{ ttl: 60_000, limit: 100 }],
          skipIf: () => env.THROTTLE_DISABLED,
        };
      },
    }),
    PrismaModule,
    AuthModule,
    BranchesModule,
    HealthModule,
  ],
  providers: [
    // Order matters: throttle before any work, then authn, then authz.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
