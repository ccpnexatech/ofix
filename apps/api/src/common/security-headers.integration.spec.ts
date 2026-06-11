import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath } from '../../test/api';
import { createTestApp } from '../../test/app';

/**
 * Hardening (spec 008): helmet must be active in the real bootstrap. The test
 * app mirrors main.ts middleware, so these headers are asserted per test run.
 */
describe('security headers (helmet)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('every response carries the helmet protection headers', async () => {
    const response = await api(app).get(apiPath('/health'));
    expect(response.status).toBe(200);
    const headers = response.headers;
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['referrer-policy']).toBe('no-referrer');
    // Express advertising disabled
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
