import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Loads apps/api/.env (the single source of DATABASE_URL) without overriding
 * variables already present in the environment.
 */
export function loadDatabaseEnv(): void {
  if (process.env.DATABASE_URL !== undefined) {
    return;
  }
  const envFile = join(import.meta.dirname, '..', '..', 'apps', 'api', '.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}
