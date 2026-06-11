import { expect, test } from '@playwright/test';

import { ADMIN, completeAllTours, fabricateOrder, loginUI, shot } from './helpers';

// Flow 3 (spec 008): deliver -> visible warranty with date -> reopen ->
// child order with HIGH priority and reference to the parent.
test('fluxo 3 — entrega, garantia e reabertura', async ({ page }) => {
  await completeAllTours(ADMIN);
  const order = await fabricateOrder('READY');

  await loginUI(page, ADMIN);
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText('Pronta').first()).toBeVisible();

  await page.getByRole('button', { name: 'Entregar' }).click();
  await expect(page.getByText('Entregue').first()).toBeVisible();
  await expect(page.getByText(/Garantia válida até/)).toBeVisible();
  await shot(page, 'entrega-garantia', '01-entregue-com-garantia');

  await page.getByRole('button', { name: 'Reabrir em garantia' }).click();
  await page.waitForURL((url) => /\/orders\/[0-9a-f-]+$/.test(url.pathname) && !url.pathname.includes(order.id));

  // Child order: RECEIVED, priority >= HIGH, linked to the parent.
  await expect(page.getByText('Recebida').first()).toBeVisible();
  await expect(page.getByText('Alta').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /ver OS original/ })).toBeVisible();
  await shot(page, 'entrega-garantia', '02-os-filha-garantia');
});
