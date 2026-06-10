import { existsSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_TEST_URL = 'postgresql://ofix:ofix@localhost:5433/ofix_test';

/**
 * URL of the disposable test database (docker compose service postgres_test,
 * mirrored by the CI service container). Resolution order: process env,
 * apps/api/.env, hardcoded local default.
 */
export function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST === undefined) {
    const envFile = join(__dirname, '..', '.env');
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
  return process.env.DATABASE_URL_TEST ?? FALLBACK_TEST_URL;
}
