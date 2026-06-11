import { expect, test } from '@playwright/test';

import { ADMIN, api, apiSession, DEMO_PASSWORD } from './helpers';

// Flow 6 (spec 008): theme persists across reload; the dashboard tour walks
// every step, completes, and never auto-reopens (spec 009 E2E).
test('fluxo 6 — tema persiste e tour conclui sem reaparecer', async ({ page }) => {
  // Fresh user => empty completedTours => the tour must auto-start.
  const admin = await apiSession(ADMIN);
  const email = `e2e-tour-${String(Date.now())}@tecnorte.dev`;
  const created = await admin.ctx.post(api('/users'), {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: { name: 'Tour E2E', email, password: DEMO_PASSWORD, role: 'ADMIN' },
  });
  expect(created.ok()).toBeTruthy();
  await admin.ctx.dispose();

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard');

  // Theme: toggle to dark and survive a reload (cookie + no-flash script).
  await page.getByRole('button', { name: 'Mudar para tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Mudar para tema claro' }).click();

  // Tour auto-starts (800ms) on the never-completed dashboard.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText(/1 de \d/)).toBeVisible();

  // Walk every step to the end.
  for (let guard = 0; guard < 10; guard += 1) {
    const concluir = dialog.getByRole('button', { name: 'Concluir' });
    if (await concluir.isVisible().catch(() => false)) {
      await concluir.click();
      break;
    }
    await dialog.getByRole('button', { name: 'Próximo' }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Completed: it must NOT reappear after a reload...
  await page.reload();
  await page.waitForTimeout(2_500);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // ...but the floating "?" replays it on demand.
  await page.getByRole('button', { name: 'Rever o tour desta tela' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
