import { expect, test } from '@playwright/test';

import { ADMIN, completeAllTours, loginUI, shot } from './helpers';

// Flow 1 (spec 008): login -> wizard with inline customer+equipment ->
// order created -> assign technician -> diagnosis -> 2-item quote -> send.
test('fluxo 1 — ciclo completo da OS pela interface', async ({ page }) => {
  await completeAllTours(ADMIN);
  await loginUI(page, ADMIN);
  await shot(page, 'ciclo-completo', '01-dashboard');

  // Wizard — step 1: brand new customer, inline.
  await page.goto('/orders/new');
  const customerName = `Cliente Fluxo1 ${Date.now()}`;
  await page.getByLabel('Nome', { exact: true }).fill(customerName);
  await page.getByLabel('Telefone').fill('(85) 98888-0001');
  await shot(page, 'ciclo-completo', '02-wizard-cliente');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 2: new equipment.
  await page.getByLabel('Tipo').fill('Notebook');
  await page.getByLabel('Marca').fill('Lenovo');
  await page.getByLabel('Modelo').fill('ThinkPad E14');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Step 3: issue + branch.
  await page.getByLabel('Defeito relatado').fill('Tela pisca e desliga sob carga');
  await page.getByLabel('Filial').click();
  await page.getByRole('option', { name: 'Matriz Fortaleza' }).click();
  await shot(page, 'ciclo-completo', '03-wizard-detalhes');
  await page.getByRole('button', { name: 'Revisar' }).click();

  // Step 4: review + create.
  await expect(page.getByText(customerName)).toBeVisible();
  await page.getByRole('button', { name: 'Criar OS' }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByText('Recebida')).toBeVisible();
  await shot(page, 'ciclo-completo', '04-os-criada');

  // Assign the technician.
  await page.getByRole('button', { name: 'Atribuir técnico' }).click();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Carlos Lima' }).click();
  await page.getByRole('button', { name: 'Atribuir', exact: true }).click();
  await expect(page.getByText('Técnico: Carlos Lima')).toBeVisible();

  // Diagnosis via the transition panel + inline editor.
  await page.getByRole('button', { name: 'Iniciar diagnóstico' }).click();
  await expect(page.getByText('Em diagnóstico').first()).toBeVisible();
  await page.getByRole('button', { name: 'Editar diagnóstico' }).click();
  await page
    .getByPlaceholder(/Mínimo de 20 caracteres/)
    .fill('Conector de vídeo com mau contato; reflow e troca do flat necessários.');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();

  // Quote with two items, then send.
  await page.getByRole('button', { name: 'Nova versão' }).click();
  await expect(page.getByText('v1 · DRAFT')).toBeVisible();
  await page.getByLabel('Descrição').fill('Flat de vídeo');
  await page.getByLabel('Unitário (R$)').fill('180.00');
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  const descriptions = page.locator('input[id^="item-desc-"]');
  await descriptions.nth(1).fill('Mão de obra especializada');
  const prices = page.locator('input[id^="item-price-"]');
  await prices.nth(1).fill('120.00');
  await page.getByRole('button', { name: 'Salvar itens' }).click();
  await expect(page.getByText('Total: R$ 300,00')).toBeVisible();
  await shot(page, 'ciclo-completo', '05-orcamento');

  await page.getByRole('button', { name: 'Enviar ao cliente' }).click();
  await expect(page.getByText('Orçamento enviado').first()).toBeVisible();
  await shot(page, 'ciclo-completo', '06-enviado');
});
