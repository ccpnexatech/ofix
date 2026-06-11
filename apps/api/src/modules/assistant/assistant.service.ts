import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  insightsResponseSchema,
  type AssistantChatBody,
  type AssistantStreamEvent,
  type DashboardInsightsBody,
  type DashboardInsightsResult,
} from '@ofix/shared';
import type Anthropic from '@anthropic-ai/sdk';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { DashboardService } from '../dashboard/dashboard.service';
import { ASSISTANT_TOOLS, AssistantToolsService } from './assistant-tools.service';
import { AssistantModelClient } from './model-client';

/** Sliding window sent to the model (spec 010). */
export const MESSAGE_WINDOW = 10;
/** Per-user rate limit: 10 requests/minute (spec 010). */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
/** Insights cache TTL (spec 010). */
const INSIGHTS_CACHE_MS = 15 * 60_000;
/** Hard ceiling for tool-use loops in one turn. */
const MAX_TOOL_ROUNDS = 5;

interface CachedInsights {
  at: number;
  insights: string[];
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly context: string;
  private readonly rate = new Map<string, number[]>();
  private readonly insightsCache = new Map<string, CachedInsights>();

  constructor(
    private readonly model: AssistantModelClient,
    private readonly tools: AssistantToolsService,
    private readonly dashboard: DashboardService,
  ) {
    // Generated from the docs by `pnpm assistant:context` (ADR-011); the CI
    // guarantees it is in sync. Copied to dist via nest-cli assets.
    this.context = readFileSync(join(__dirname, 'context.generated.md'), 'utf8');
  }

  private systemPrompt(user: AuthenticatedUser): string {
    return [
      'Você é a Fia, a assistente da oficina dentro do OFIX (sistema de gestão de ordens de serviço para assistências técnicas).',
      `Quem conversa com você: ${user.name} (papel ${user.role}${user.branchId ? ', com acesso restrito à filial dele' : ', com acesso a todas as filiais'}).`,
      'Escopo: dúvidas de USO do OFIX e consultas aos dados da empresa do usuário via ferramentas. Fora disso, recuse com educação e redirecione para o que você sabe fazer.',
      'Estilo: português do Brasil, respostas curtas e diretas. Quando explicar uma ação, cite a TELA e o BOTÃO onde ela acontece (ex.: "na tela da OS, painel Ações, clique em Entregar").',
      'Use as ferramentas sempre que a pergunta envolver dados reais (OS, clientes, métricas). Nunca invente números.',
      '',
      '=== DOCUMENTAÇÃO DO PRODUTO ===',
      this.context,
    ].join('\n');
  }

  /** Sliding-window rate limit per user; throws 429 when exceeded. */
  private assertRate(userId: string): void {
    const now = Date.now();
    const hits = (this.rate.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (hits.length >= RATE_LIMIT) {
      throw new HttpException('Muitas mensagens — aguarde um minuto.', 429);
    }
    hits.push(now);
    this.rate.set(userId, hits);
  }

  private assertAvailable(): void {
    if (!this.model.available()) {
      throw new ServiceUnavailableException(
        'A assistente não está configurada neste ambiente (ANTHROPIC_API_KEY ausente).',
      );
    }
  }

  /**
   * Chat turn with the tool-use agent loop (spec 010). Emits SSE events via
   * `write`; provider failures become a friendly message, never a stack.
   */
  /** Run BEFORE opening the SSE stream so 429/503 keep JSON semantics. */
  precheck(user: AuthenticatedUser): void {
    this.assertAvailable();
    this.assertRate(user.id);
  }

  async chat(
    user: AuthenticatedUser,
    body: AssistantChatBody,
    write: (event: AssistantStreamEvent) => void,
  ): Promise<void> {
    const windowed = body.messages.slice(-MESSAGE_WINDOW);
    const messages: Anthropic.MessageParam[] = windowed.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const final = await this.model.stream(
          { system: this.systemPrompt(user), messages, tools: ASSISTANT_TOOLS },
          {
            onTextDelta: (delta) => {
              write({ type: 'text', delta });
            },
          },
        );

        const toolUses = final.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
        );
        if (final.stop_reason !== 'tool_use' || toolUses.length === 0) {
          break;
        }

        messages.push({ role: 'assistant', content: final.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUses) {
          write({ type: 'tool', name: toolUse.name });
          const output = await this.tools.execute(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            user,
          );
          results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: output });
        }
        messages.push({ role: 'user', content: results });
      }
      write({ type: 'done' });
    } catch (error) {
      this.logger.error('assistant chat failed', error instanceof Error ? error.stack : error);
      write({
        type: 'error',
        message: 'A Fia teve um problema para responder agora. Tente novamente em instantes.',
      });
    }
  }

  /** Dashboard insights: strict JSON, one retry, 15-minute cache (spec 010). */
  async insights(
    user: AuthenticatedUser,
    body: DashboardInsightsBody,
  ): Promise<DashboardInsightsResult> {
    this.assertAvailable();
    this.assertRate(user.id);

    const cacheKey = [
      user.tenantId,
      user.role === 'TECHNICIAN' ? user.id : '',
      body.branchId ?? 'all',
      body.from?.toISOString() ?? '',
      body.to?.toISOString() ?? '',
    ].join('|');
    const cached = this.insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.at < INSIGHTS_CACHE_MS) {
      return {
        insights: cached.insights,
        generatedAt: new Date(cached.at).toISOString(),
        cached: true,
      };
    }

    const [summary, byStatus] = await Promise.all([
      this.dashboard.summary(user, body),
      this.dashboard.ordersByStatus(user, body.branchId),
    ]);
    const numbers = JSON.stringify({ resumo: summary, porStatus: byStatus });
    const prompt = [
      'Analise as métricas desta assistência técnica e produza de 3 a 5 insights ACIONÁVEIS em português do Brasil.',
      'Cada insight: uma frase concreta, citando números, com uma sugestão prática.',
      'Responda SOMENTE com JSON válido no formato {"insights": ["...", "..."]} — sem markdown, sem texto fora do JSON.',
      '',
      `Métricas: ${numbers}`,
    ].join('\n');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.model.complete({
        system: 'Você é uma analista de operações de assistência técnica. Responda apenas JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 700,
      });
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');
      try {
        const parsed = insightsResponseSchema.parse(JSON.parse(text));
        const at = Date.now();
        this.insightsCache.set(cacheKey, { at, insights: parsed.insights });
        return { insights: parsed.insights, generatedAt: new Date(at).toISOString(), cached: false };
      } catch {
        this.logger.warn(`insights parse failed (attempt ${String(attempt + 1)})`);
      }
    }
    throw new ServiceUnavailableException('Análise indisponível no momento.');
  }
}
