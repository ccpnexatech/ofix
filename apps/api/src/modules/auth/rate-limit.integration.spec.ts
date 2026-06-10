import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, apiPath } from '../../../test/api';
import { createTestApp } from '../../../test/app';

// Separate suite with throttling ON (every other suite disables it).
describe('rate limit on /auth/login (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ throttle: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after 5 attempts within a minute (spec 003)', async () => {
    const attempt = () =>
      api(app)
        .post(apiPath('/auth/login'))
        .send({ email: 'throttle@test.dev', password: 'wrong-password-1' });

    for (let i = 0; i < 5; i += 1) {
      const response = await attempt();
      expect(response.status).toBe(401); // wrong credentials, but not throttled yet
    }
    const sixth = await attempt();
    expect(sixth.status).toBe(429);
  });
});
