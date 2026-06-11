import { API_PREFIX, type AssistantStreamEvent, type ChatMessage, type DashboardInsightsResult } from '@ofix/shared';

import { apiFetch, getAccessToken } from '../../lib/api';

export interface StreamHandlers {
  onText: (delta: string) => void;
  onTool: (name: string) => void;
  onError: (message: string) => void;
}

/** Consumes the SSE stream of POST /assistant/chat. */
export async function streamChat(
  messages: ChatMessage[],
  handlers: StreamHandlers,
): Promise<void> {
  const response = await fetch(`/${API_PREFIX}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    credentials: 'include',
    body: JSON.stringify({ messages }),
  });

  if (!response.ok || response.body === null) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    handlers.onError(
      body.message ?? 'A Fia está indisponível agora. Tente novamente em instantes.',
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      if (!frame.startsWith('data: ')) {
        continue;
      }
      const event = JSON.parse(frame.slice(6)) as AssistantStreamEvent;
      if (event.type === 'text') {
        handlers.onText(event.delta);
      } else if (event.type === 'tool') {
        handlers.onTool(event.name);
      } else if (event.type === 'error') {
        handlers.onError(event.message);
      }
    }
  }
}

export async function getInsights(branchId: string | null): Promise<DashboardInsightsResult> {
  return apiFetch('/assistant/dashboard-insights', {
    method: 'POST',
    body: JSON.stringify(branchId === null ? {} : { branchId }),
  });
}
