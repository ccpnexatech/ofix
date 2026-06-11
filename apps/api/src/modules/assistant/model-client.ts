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
 * Injection token/contract of the assistant model. Two providers (ADR-012):
 * LocalAssistantModel (deterministic, default) and AnthropicModelClient
 * (spec 010 path, ASSISTANT_MODE=anthropic). Tests inject scripted fakes.
 */
@Injectable()
export abstract class AssistantModelClient {
  abstract available(): boolean;

  /** Streams one model turn; resolves with the final message (incl. tool_use). */
  abstract stream(
    params: ModelCallParams,
    handlers: ModelStreamHandlers,
  ): Promise<Anthropic.Message>;

  /** Single non-streaming call (insights). */
  abstract complete(params: ModelCallParams): Promise<Anthropic.Message>;
}

/** Spec 010 provider: the real Anthropic API. The key never leaves the server. */
@Injectable()
export class AnthropicModelClient extends AssistantModelClient {
  private client: Anthropic | undefined;
  private model = 'claude-sonnet-4-20250514';

  constructor() {
    super();
    const env = loadEnv();
    this.model = env.ASSISTANT_MODEL;
    if (env.ANTHROPIC_API_KEY !== undefined) {
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
  }

  available(): boolean {
    return this.client !== undefined;
  }

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
