import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  // 32+ chars: HS256 secret must not be guessable (ADR-008).
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  // Escape hatch for integration tests that hammer endpoints; never set in prod.
  THROTTLE_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) {
    // Nest does not load .env by itself; cwd is apps/api under turbo/pnpm.
    const envFile = join(process.cwd(), '.env');
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Fail fast at boot: a half-configured API is worse than no API.
    throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
