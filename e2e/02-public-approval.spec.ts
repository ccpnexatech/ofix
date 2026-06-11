import { expect, test } from '@playwright/test';

import { ADMIN, api, apiSession, fabricateOrder, shot } from './helpers';

// Flow 2 (spec 008): mobile viewport — /q/[token] shows items/total, approval
// flips the order to APPROVED and lands in the audit timeline.
test('fluxo 2 — aprovação pública do orçamento no celular', async ({ page }) => {
  const order = await fabricateOrder('QUOTE_SENT');
  expect(order.publicToken).toBeDefined();

  await page.goto(`/q/${order.publicToken ?? ''}`);
  await expect(page.getByText('TecNorte Assistência')).toBeVisible();
  await expect(page.getByText(order.code)).toBeVisible();
  await expect(page.getByText('R$ 350,00')).toBeVisible(); // total destacado
  await shot(page, 'aprovacao-publica', '01-orcamento-mobile');

  await page.getByRole('button', { name: 'Aprovar orçamento' }).click();
  await expect(page.getByText('Orçamento aprovado')).toBeVisible();
  await shot(page, 'aprovacao-publica', '02-aprovado');

  // Order is APPROVED and the decision is in the timeline with actor CUSTOMER.
  const { ctx, token } = await apiSession(ADMIN);
  const detail = await ctx.get(api(`/orders/${order.id}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(((await detail.json()) as { status: string }).status).toBe('APPROVED');
  const events = await ctx.get(api(`/orders/${order.id}/events`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const trail = (await events.json()) as { type: string; actorType: string }[];
  expect(
    trail.some((event) => event.type === 'STATUS_CHANGED' && event.actorType === 'CUSTOMER'),
  ).toBeTruthy();
  await ctx.dispose();
});
