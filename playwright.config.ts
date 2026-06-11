import { defineConfig, devices } from '@playwright/test';

// E2E suite (spec 008): real api + web in production mode, chromium desktop
// plus a mobile viewport project for the public flows.

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ofix:ofix@localhost:5432/ofix';
const JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-secret-with-at-least-32-characters!!';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Flows share one database; serial keeps them deterministic.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Sandboxed environments (CI containers, restricted hosts) need this.
    launchOptions: { args: ['--no-sandbox'] },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [
        '**/02-public-approval.spec.ts',
        '**/05-public-map.spec.ts',
        '**/shots.spec.ts',
      ],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: ['**/02-public-approval.spec.ts', '**/05-public-map.spec.ts'],
    },
    // `pnpm shots` only — the screenshot pack for the user guide (spec 012).
    {
      name: 'shots',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/shots.spec.ts'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @ofix/api start',
      url: 'http://localhost:3001/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        JWT_SECRET,
        NODE_ENV: 'production',
        // E2E hammers the UI fast; budgets are validated by integration tests.
        THROTTLE_DISABLED: 'true',
      },
    },
    {
      command: 'pnpm --filter @ofix/web start',
      url: 'http://localhost:3000/login',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_ORIGIN: 'http://localhost:3001' },
    },
  ],
});
