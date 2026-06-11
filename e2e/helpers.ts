import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

export const API_HOST = 'http://localhost:3001';

/** baseURL with a path gets dropped by URL joining; prefix explicitly. */
export function api(path: string): string {
  return `/api/v1${path}`;
}
export const DEMO_PASSWORD = 'ofix-demo-123';
export const ADMIN = 'admin@tecnorte.dev';
export const TECHNICIAN = 'tecnico@tecnorte.dev';
export const ATTENDANT = 'atendente@tecnorte.dev';

export const ALL_TOUR_IDS = [
  'dashboard',
  'orders-list',
  'order-detail',
  'order-new',
  'customers',
  'branches-map',
  'settings-users',
];

/** Direct API session for fabricating prerequisites (fast, not under test). */
export async function apiSession(email: string): Promise<{
  ctx: APIRequestContext;
  token: string;
}> {
  const ctx = await request.newContext({ baseURL: API_HOST });
  const response = await ctx.post(api('/auth/login'), {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { accessToken: string };
  return { ctx, token: body.accessToken };
}

async function authed(
  ctx: APIRequestContext,
  token: string,
  method: 'get' | 'post' | 'patch',
  path: string,
  data?: unknown,
): Promise<unknown> {
  const response = await ctx[method](api(path), {
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()}`).toBeTruthy();
  return response.json().catch(() => undefined);
}

/** Marks every tour as done so popovers never interfere with the flows. */
export async function completeAllTours(email: string): Promise<void> {
  const { ctx, token } = await apiSession(email);
  for (const tourId of ALL_TOUR_IDS) {
    await authed(ctx, token, 'patch', '/users/me/tours', { tourId });
  }
  await ctx.dispose();
}

/** Logs into the web app through the real login form. */
export async function loginUI(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard');
}

export interface FabricatedOrder {
  id: string;
  code: string;
  publicToken?: string;
}

/**
 * Fabricates an order in a given stage via the API (prerequisite shortcut;
 * the UI path itself is covered by flow 1).
 */
export async function fabricateOrder(
  stage: 'QUOTE_SENT' | 'READY' | 'DELIVERED',
  options: { issue?: string } = {},
): Promise<FabricatedOrder> {
  const { ctx, token } = await apiSession(ADMIN);
  const branches = (await authed(ctx, token, 'get', '/branches')) as {
    id: string;
    name: string;
  }[];
  const matriz = branches.find((b) => b.name.includes('Matriz'));
  expect(matriz).toBeDefined();

  const customer = (await authed(ctx, token, 'post', '/customers', {
    name: `Cliente E2E ${Date.now()}`,
    phone: '(85) 90000-0000',
  })) as { id: string };
  const equipment = (await authed(ctx, token, 'post', `/customers/${customer.id}/equipments`, {
    type: 'Notebook',
    brand: 'Dell',
    model: 'Vostro',
  })) as { id: string };
  const order = (await authed(ctx, token, 'post', '/orders', {
    branchId: (matriz as { id: string }).id,
    customerId: customer.id,
    equipmentId: equipment.id,
    reportedIssue: options.issue ?? 'Equipamento reiniciando sozinho',
  })) as { id: string; code: string };

  const users = (await authed(ctx, token, 'get', '/users?perPage=100')) as {
    data: { id: string; role: string; email: string }[];
  };
  const technician = users.data.find((u) => u.email === TECHNICIAN);
  await authed(ctx, token, 'post', `/orders/${order.id}/assign`, {
    technicianId: (technician as { id: string }).id,
  });
  await authed(ctx, token, 'post', `/orders/${order.id}/transitions`, {
    action: 'START_DIAGNOSIS',
  });
  await authed(ctx, token, 'patch', `/orders/${order.id}`, {
    technicalDiagnosis: 'Fonte instável; substituição completa recomendada.',
  });
  const quote = (await authed(ctx, token, 'post', `/orders/${order.id}/quotes`)) as {
    id: string;
  };
  await authed(ctx, token, 'patch', `/quotes/${quote.id}`, {
    items: [
      { kind: 'PART', description: 'Fonte nova', quantity: 1, unitPriceCents: 25000 },
      { kind: 'LABOR', description: 'Substituição', quantity: 1, unitPriceCents: 10000 },
    ],
  });
  await authed(ctx, token, 'post', `/quotes/${quote.id}/send`);

  let publicToken: string | undefined;
  const detail = (await authed(ctx, token, 'get', `/orders/${order.id}`)) as {
    quotes: { publicToken: string }[];
  };
  publicToken = detail.quotes[0]?.publicToken;

  if (stage !== 'QUOTE_SENT') {
    await authed(ctx, token, 'post', `/orders/${order.id}/transitions`, {
      action: 'APPROVE_QUOTE',
    });
    await authed(ctx, token, 'post', `/orders/${order.id}/transitions`, {
      action: 'START_REPAIR',
    });
    await authed(ctx, token, 'post', `/orders/${order.id}/transitions`, {
      action: 'MARK_READY',
    });
  }
  if (stage === 'DELIVERED') {
    await authed(ctx, token, 'post', `/orders/${order.id}/transitions`, { action: 'DELIVER' });
  }

  await ctx.dispose();
  return { id: order.id, code: order.code, publicToken };
}

/** Named screenshot for the user guide (spec 008/012). */
export async function shot(page: Page, flow: string, step: string): Promise<void> {
  const path = join('docs', 'assets', 'screens', flow, `${step}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
}
