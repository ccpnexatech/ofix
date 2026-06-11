import { z } from 'zod';

// Fia assistant contracts (spec 010).

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4_000),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const assistantChatBodySchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
});
export type AssistantChatBody = z.infer<typeof assistantChatBodySchema>;

/** SSE events streamed by POST /assistant/chat. */
export type AssistantStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export const dashboardInsightsBodySchema = z.object({
  branchId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type DashboardInsightsBody = z.infer<typeof dashboardInsightsBodySchema>;

/** Strict shape demanded from the model (validated, retried once). */
export const insightsResponseSchema = z.object({
  insights: z.array(z.string().trim().min(10)).min(3).max(5),
});
export type InsightsResponse = z.infer<typeof insightsResponseSchema>;

export const dashboardInsightsResultSchema = z.object({
  insights: z.array(z.string()),
  generatedAt: z.iso.datetime(),
  /** True when served from the 15-minute cache. */
  cached: z.boolean(),
});
export type DashboardInsightsResult = z.infer<typeof dashboardInsightsResultSchema>;
