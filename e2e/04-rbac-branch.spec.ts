import { expect, test } from '@playwright/test';

import {
  ATTENDANT,
  TECHNICIAN,
  apiSession,
  completeAllTours,
  fabricateOrder,
  loginUI,
  api,
} from './helpers';

// Flow 4 (spec 008): technician has no Cancel button and gets 403 forcing the
// API; fixed-branch attendant cannot see orders from another branch.
test('fluxo 4 — RBAC do técnico e isolamento de filial do atendente', async ({ page }) => {
  await completeAllTours(TECHNICIAN);
  await completeAllTours(ATTENDANT);
  const order = await fabricateOrder('QUOTE_SENT'); // Matriz, assigned to Carlos

  // Technician: panel shows only his actions — never CANCEL.
  await loginUI(page, TECHNICIAN);
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText('Orçamento enviado').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar orçamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar OS' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Aprovar (presencial)' })).toHaveCount(0);

  // Forcing the API directly must answer 403 (same shared matrix, server side).
  const tech = await apiSession(TECHNICIAN);
  const forced = await tech.ctx.post(api(`/orders/${order.id}/transitions`), {
    headers: { Authorization: `Bearer ${tech.token}` },
    data: { action: 'CANCEL', payload: { reason: 'tentativa indevida de cancelar' } },
  });
  expect(forced.status()).toBe(403);
  await tech.ctx.dispose();

  // Attendant pinned to Aldeota: the Matriz order does not exist for her.
  const attendant = await apiSession(ATTENDANT);
  const denied = await attendant.ctx.get(api(`/orders/${order.id}`), {
    headers: { Authorization: `Bearer ${attendant.token}` },
  });
  expect(denied.status()).toBe(403);
  const list = await attendant.ctx.get(api('/orders?perPage=100'), {
    headers: { Authorization: `Bearer ${attendant.token}` },
  });
  const codes = ((await list.json()) as { data: { code: string }[] }).data.map((o) => o.code);
  expect(codes).not.toContain(order.code);
  await attendant.ctx.dispose();

  // And in the UI the screen shows the not-found state, never the data.
  await page.getByRole('button', { name: 'Menu do usuário' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await page.waitForURL('**/login');
  await loginUI(page, ATTENDANT);
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText('OS não encontrada')).toBeVisible();
});
