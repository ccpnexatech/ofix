import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { testDatabaseUrl } from './database';

/**
 * Vitest global setup: brings the disposable test database (port 5433) to the
 * current migration state before any integration test runs.
 * Requires `docker compose up -d` locally; CI provides a service container.
 */
export default function setup(): void {
  const url = testDatabaseUrl();
  try {
    execSync('pnpm exec prisma migrate deploy', {
      cwd: join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: url, DISABLE_ERD: 'true' },
      stdio: 'pipe',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not migrate the test database at ${url}. ` +
        `Is it running? Locally: docker compose up -d\n${detail}`,
    );
  }
}
