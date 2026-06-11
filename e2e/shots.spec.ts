import { mkdirSync } from 'node:fs';

import { test, type Page } from '@playwright/test';

import { ADMIN, completeAllTours, fabricateOrder, loginUI } from './helpers';

// `pnpm shots` (spec 008): captures the named screenshot pack consumed by the
// user guide (spec 012). Main screens in BOTH themes.

const OUT = 'docs/assets/screens';

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.context().addCookies([
    { name: 'ofix-theme', value: theme, domain: 'localhost', path: '/' },
  ]);
}

async function capture(page: Page, route: string, name: string, theme: 'light' | 'dark') {
  await setTheme(page, theme);
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_200); // charts/map settle
  mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.screenshot({ path: `${OUT}/${name}/${theme}.png`, fullPage: false });
}

test('captura o pacote de screenshots nos 2 temas', async ({ page }) => {
  test.setTimeout(300_000);
  await completeAllTours(ADMIN);
  const order = await fabricateOrder('QUOTE_SENT', { issue: 'Captura para o guia' });

  await loginUI(page, ADMIN);
  for (const theme of ['light', 'dark'] as const) {
    await capture(page, '/dashboard', 'dashboard', theme);
    await capture(page, '/orders', 'lista-os', theme);
    await capture(page, `/orders/${order.id}`, 'detalhe-os', theme);
    await capture(page, '/orders/new', 'wizard', theme);
    await capture(page, '/customers', 'clientes', theme);
    await capture(page, '/branches/map', 'mapa-filiais', theme);
    await capture(page, '/settings/users', 'usuarios', theme);
  }

  // Public pages (light only is enough — they follow the visitor's system).
  await capture(page, `/q/${order.publicToken ?? ''}`, 'orcamento-publico', 'light');
});
