import type { INestApplication } from '@nestjs/common';
import { Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import { createBranch, createOrder, createTenant, createUser } from '../../../test/factories';
import { LocalAssistantModel } from './local-model';
import { AssistantModelClient } from './model-client';

function streamedText(body: string): string {
  return body
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; delta?: string })
    .filter((event) => event.type === 'text')
    .map((event) => event.delta ?? '')
    .join('');
}

// ADR-012: the REAL local responder (no scripted fake) against the real DB.
describe('Fia local deterministic mode (ADR-012)', () => {
  let app: INestApplication<App>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let overdueCode: string;

  beforeAll(async () => {
    app = await createTestApp({
      overrides: [{ provide: AssistantModelClient, useValue: new LocalAssistantModel() }],
    });
    const tenant = await createTenant();
    admin = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
    const branch = await createBranch(tenant.id);
    const order = await createOrder({
      tenantId: tenant.id,
      branchId: branch.id,
      createdById: admin.id,
      promisedAt: new Date(Date.now() - 48 * 3_600_000),
    });
    overdueCode = order.code;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers "quais OS estão atrasadas?" with real data through the tool loop', async () => {
    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: 'Quais OS estão atrasadas?' }],
    });
    expect(response.status).toBe(200);
    const text = streamedText(response.text);
    expect(text).toContain('OS atrasada');
    expect(text).toContain(overdueCode);
    expect(response.text).toContain('"type":"tool"');
  });

  it('answers an order-code question with its real status', async () => {
    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: `qual o status da ${overdueCode}?` }],
    });
    const text = streamedText(response.text);
    expect(text).toContain(overdueCode);
    expect(text).toContain('Recebida');
  });

  it('answers usage questions by quoting the user guide', async () => {
    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: 'Como funciona a garantia?' }],
    });
    const text = streamedText(response.text);
    expect(text).toContain('90 dias');
    expect(text).toContain('guia de uso');
  });

  it('falls back honestly with suggestions when nothing matches', async () => {
    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: 'xyzqwerty blorp?' }],
    });
    const text = streamedText(response.text);
    expect(text).toContain('Não encontrei isso na documentação');
    expect(text).toContain('atrasadas');
  });

  it('generates deterministic dashboard insights citing the real numbers', async () => {
    const response = await asUser(app, admin).post('/assistant/dashboard-insights', {});
    expect(response.status).toBe(201);
    const body = response.body as { insights: string[]; cached: boolean };
    expect(body.insights.length).toBeGreaterThanOrEqual(3);
    expect(body.insights.join(' ')).toContain('1 OS atrasada');
  });
});
