import { expect, test } from '@playwright/test';

import { ADMIN, api, apiSession, shot } from './helpers';

// Flow 5 (spec 008): /m/[mapToken] renders pins and branch cards without login.
test('fluxo 5 — mapa público das filiais sem login', async ({ page }) => {
  const { ctx, token } = await apiSession(ADMIN);
  const response = await ctx.get(api('/branches/map-token'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { publicMapToken } = (await response.json()) as { publicMapToken: string };
  await ctx.dispose();

  await page.goto(`/m/${publicMapToken}`);
  await expect(page.getByText('TecNorte Assistência')).toBeVisible();

  // Branch cards (SEO/a11y list) with phone and directions.
  await expect(page.getByText('Matriz Fortaleza')).toBeVisible();
  await expect(page.getByText('Filial Aldeota')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Como chegar' }).first()).toBeVisible();

  // Interactive map mounts after idle (facade) with one pin per branch.
  await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2, { timeout: 15_000 });
  await shot(page, 'mapa-publico', '01-mapa-mobile');
});
