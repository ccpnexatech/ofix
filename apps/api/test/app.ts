import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PREFIX } from '@ofix/shared';
import cookieParser from 'cookie-parser';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { testDatabaseUrl } from './database';

export interface CreateTestAppOptions {
  /** Rate limiting is disabled by default so suites can hammer endpoints. */
  throttle?: boolean;
  /** Extra controllers (test-only routes used to exercise guards). */
  controllers?: NonNullable<ModuleMetadata['controllers']>;
}

/** Boots the real AppModule against the disposable test database. */
export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<INestApplication<App>> {
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.JWT_SECRET ??= 'integration-test-secret-with-32+-chars!!';
  process.env.THROTTLE_DISABLED = options.throttle === true ? 'false' : 'true';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  await app.init();
  return app;
}
