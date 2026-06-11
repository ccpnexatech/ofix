import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@ofix/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Middleware shared by the real bootstrap (main.ts) and the integration test
 * app — what the hardening tests assert is exactly what production runs.
 */
export function configureApp(app: INestApplication, corsOrigin: string): void {
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix(API_PREFIX);
}
