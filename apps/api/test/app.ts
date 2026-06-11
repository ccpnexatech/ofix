import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { testDatabaseUrl } from './database';

export interface CreateTestAppOptions {
  /** Rate limiting is disabled by default so suites can hammer endpoints. */
  throttle?: boolean;
  /** Extra controllers (test-only routes used to exercise guards). */
  controllers?: NonNullable<ModuleMetadata['controllers']>;
  /** Provider overrides (e.g. the assistant model client mock). */
  overrides?: { provide: unknown; useValue: unknown }[];
}

/** Boots the real AppModule against the disposable test database. */
export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<INestApplication<App>> {
  process.env.DATABASE_URL = testDatabaseUrl();
  process.env.JWT_SECRET ??= 'integration-test-secret-with-32+-chars!!';
  process.env.THROTTLE_DISABLED = options.throttle === true ? 'false' : 'true';

  const builder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  for (const override of options.overrides ?? []) {
    builder.overrideProvider(override.provide).useValue(override.useValue);
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  // Same middleware as production (main.ts) — hardening tests assert it.
  configureApp(app, 'http://localhost:3000');
  // Listen on an ephemeral port: concurrent supertest requests against a
  // non-listening server race on listen() and reset connections.
  await app.listen(0);
  return app;
}
