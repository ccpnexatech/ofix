import type { INestApplication } from '@nestjs/common';
import { Role } from '@ofix/shared';
import type Anthropic from '@anthropic-ai/sdk';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createOrder,
  createTenant,
  createUser,
} from '../../../test/factories';
import { AssistantModelClient } from './model-client';
import type { ModelCallParams, ModelStreamHandlers } from './model-client';

// Scripted fake of the Anthropic client (DoD: model calls mocked in tests).
type Turn =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; input: Record<string, unknown> };

class FakeModel implements Pick<AssistantModelClient, 'available' | 'stream' | 'complete'> {
  script: Turn[] = [];
  completions: string[] = [];
  isAvailable = true;
  calls: ModelCallParams[] = [];
  completeCalls = 0;
  /** tool_result contents the "model" received back. */
  toolResults: string[] = [];

  available(): boolean {
    return this.isAvailable;
  }

  async stream(params: ModelCallParams, handlers: ModelStreamHandlers): Promise<Anthropic.Message> {
    this.calls.push(params);
    const last = params.messages.at(-1);
    if (Array.isArray(last?.content)) {
      for (const block of last.content) {
        if (typeof block === 'object' && block.type === 'tool_result') {
          this.toolResults.push(typeof block.content === 'string' ? block.content : JSON.stringify(block.content));
        }
      }
    }
    const turn = this.script.shift() ?? { kind: 'text', text: 'fim do script' };
    if (turn.kind === 'tool') {
      return Promise.resolve({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: turn.name, input: turn.input }],
      } as unknown as Anthropic.Message);
    }
    for (const chunk of turn.text.match(/.{1,8}/g) ?? []) {
      handlers.onTextDelta(chunk);
    }
    return Promise.resolve({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: turn.text }],
    } as unknown as Anthropic.Message);
  }

  async complete(): Promise<Anthropic.Message> {
    this.completeCalls += 1;
    const text = this.completions.shift() ?? '{}';
    return Promise.resolve({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
    } as unknown as Anthropic.Message);
  }
}

function sseEvents(body: string): { type: string; delta?: string; name?: string }[] {
  return body
    .split('\n\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; delta?: string; name?: string });
}

describe('Fia assistant (integration, mocked model)', () => {
  let app: INestApplication<App>;
  let fake: FakeModel;
  let tenantId: string;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let orderCode: string;

  beforeAll(async () => {
    fake = new FakeModel();
    app = await createTestApp({
      overrides: [{ provide: AssistantModelClient, useValue: fake }],
    });
    const tenant = await createTenant();
    tenantId = tenant.id;
    admin = await createUser({ tenantId, role: Role.ADMIN });
    const branch = await createBranch(tenantId);
    const order = await createOrder({
      tenantId,
      branchId: branch.id,
      createdById: admin.id,
      code: 'OS-2026-7777',
    });
    orderCode = order.code;
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams text and runs the tool loop against real tenant data', async () => {
    fake.script = [
      { kind: 'tool', name: 'get_order_by_code', input: { code: orderCode } },
      { kind: 'text', text: 'A OS está Recebida, aguardando triagem.' },
    ];

    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: `qual o status da ${orderCode}?` }],
    });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = sseEvents(response.text);
    expect(events.find((e) => e.type === 'tool')?.name).toBe('get_order_by_code');
    const text = events.filter((e) => e.type === 'text').map((e) => e.delta).join('');
    expect(text).toContain('Recebida');
    expect(events.at(-1)?.type).toBe('done');

    // The tool really hit the database: the result carries the real code.
    expect(fake.toolResults.at(-1)).toContain(orderCode);
  });

  it('tools inherit tenant isolation: another tenant finds nothing (RN-11)', async () => {
    const otherTenant = await createTenant();
    const intruder = await createUser({ tenantId: otherTenant.id, role: Role.ADMIN });
    fake.script = [
      { kind: 'tool', name: 'get_order_by_code', input: { code: orderCode } },
      { kind: 'text', text: 'Não encontrei essa OS.' },
    ];

    const response = await asUser(app, intruder).post('/assistant/chat', {
      messages: [{ role: 'user', content: `status da ${orderCode}` }],
    });
    expect(response.status).toBe(200);
    expect(fake.toolResults.at(-1)).toContain('Nenhuma OS encontrada');
    expect(fake.toolResults.at(-1)).not.toContain(orderCode);
  });

  it('sends only the last 10 messages to the model (sliding window)', async () => {
    fake.script = [{ kind: 'text', text: 'ok' }];
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant'),
      content: `mensagem ${String(i + 1)}`,
    }));
    // ends on user message (15 = odd = user) — valid conversation shape
    await asUser(app, admin).post('/assistant/chat', { messages });

    const sent = fake.calls.at(-1)?.messages ?? [];
    expect(sent).toHaveLength(10);
    expect(sent[0]?.content).toBe('mensagem 6');
  });

  it('rate limits at 10 requests per minute per user (429 before the stream)', async () => {
    const heavyUser = await createUser({ tenantId, role: Role.ATTENDANT });
    fake.script = Array.from({ length: 20 }, () => ({ kind: 'text' as const, text: 'oi' }));
    for (let i = 0; i < 10; i += 1) {
      const ok = await asUser(app, heavyUser).post('/assistant/chat', {
        messages: [{ role: 'user', content: 'oi' }],
      });
      expect(ok.status).toBe(200);
    }
    const eleventh = await asUser(app, heavyUser).post('/assistant/chat', {
      messages: [{ role: 'user', content: 'oi' }],
    });
    expect(eleventh.status).toBe(429);
  });

  it('insights: strict JSON with one retry, then 15-minute cache', async () => {
    const user = await createUser({ tenantId, role: Role.ADMIN });
    fake.completeCalls = 0;
    fake.completions = [
      'não é json',
      '{"insights": ["A taxa de aprovação está em 100% — mantenha o padrão de orçamentos.", "Não há OS atrasadas no período, prazo prometido está saudável.", "Receita zerada no mês: priorize entregas das OS prontas."]}',
    ];

    const first = await asUser(app, user).post('/assistant/dashboard-insights', {});
    expect(first.status).toBe(201);
    const firstBody = first.body as { insights: string[]; cached: boolean };
    expect(firstBody.insights).toHaveLength(3);
    expect(firstBody.cached).toBe(false);
    expect(fake.completeCalls).toBe(2); // bad JSON + retry

    const second = await asUser(app, user).post('/assistant/dashboard-insights', {});
    expect((second.body as { cached: boolean }).cached).toBe(true);
    expect(fake.completeCalls).toBe(2); // cache hit: no extra model calls
  });

  it('insights: double parse failure answers a friendly 503', async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id, role: Role.ADMIN });
    fake.completions = ['lixo', 'mais lixo'];

    const response = await asUser(app, user).post('/assistant/dashboard-insights', {});
    expect(response.status).toBe(503);
    expect((response.body as { message: string }).message).toContain('indisponível');
  });

  it('answers a friendly 503 when no API key is configured', async () => {
    fake.isAvailable = false;
    const response = await asUser(app, admin).post('/assistant/chat', {
      messages: [{ role: 'user', content: 'oi' }],
    });
    expect(response.status).toBe(503);
    fake.isAvailable = true;
  });
});
