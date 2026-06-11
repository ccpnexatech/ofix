import Anthropic from '@anthropic-ai/sdk';
import { Injectable } from '@nestjs/common';

import { loadEnv } from '../../infra/config/env';

export interface ModelStreamHandlers {
  onTextDelta: (delta: string) => void;
}

export interface ModelCallParams {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  maxTokens?: number;
}

/**
 * Thin injectable wrapper around the Anthropic SDK so tests can replace the
 * model entirely (DoD: model calls mocked in tests). The key never leaves the
 * server; without one the assistant is simply unavailable (503 upstream).
 */
@Injectable()
export class AssistantModelClient {
  private client: Anthropic | undefined;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    const env = loadEnv();
    this.model = env.ASSISTANT_MODEL;
    if (env.ANTHROPIC_API_KEY !== undefined) {
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
  }

  available(): boolean {
    return this.client !== undefined;
  }

  /** Streams one model turn; resolves with the final message (incl. tool_use). */
  async stream(params: ModelCallParams, handlers: ModelStreamHandlers): Promise<Anthropic.Message> {
    if (!this.client) {
      throw new Error('assistant model not configured');
    }
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens ?? 1_024,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools } : {}),
    });
    stream.on('text', (delta) => {
      handlers.onTextDelta(delta);
    });
    return stream.finalMessage();
  }

  /** Single non-streaming call (insights). */
  async complete(params: ModelCallParams): Promise<Anthropic.Message> {
    if (!this.client) {
      throw new Error('assistant model not configured');
    }
    return this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 1_024,
      system: params.system,
      messages: params.messages,
      ...(params.tools ? { tools: params.tools } : {}),
    });
  }
}
