'use client';

import type { ChatMessage } from '@ofix/shared';
import { Bot, Loader2, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button, cn } from '../../design-system';
import { streamChat } from './api';
import { renderMarkdown } from './markdown';

const SUGGESTIONS = [
  'Como aprovo um orçamento presencialmente?',
  'Quais OS estão atrasadas?',
  'Como funciona a garantia?',
];

const TOOL_LABELS: Record<string, string> = {
  get_order_by_code: 'consultando a OS…',
  search_orders: 'consultando suas OS…',
  search_customer: 'consultando clientes…',
  get_dashboard_summary: 'consultando as métricas…',
  get_overdue_orders: 'consultando os atrasos…',
};

/**
 * Fia chat (spec 010): floating bubble bottom-right, side panel with session
 * history, token streaming and a visual note while a tool runs. History lives
 * only in this component's memory — privacy by default.
 */
export function FiaPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, toolNote]);

  async function send(content: string) {
    const text = content.trim();
    if (text === '' || streaming) {
      return;
    }
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setStreaming(true);

    const appendDelta = (delta: string) => {
      setMessages((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', content: last.content + delta };
        }
        return next;
      });
    };

    try {
      await streamChat(history, {
        onText: (delta) => {
          setToolNote(null);
          appendDelta(delta);
        },
        onTool: (name) => {
          setToolNote(TOOL_LABELS[name] ?? 'consultando seus dados…');
        },
        onError: (message) => {
          appendDelta(message);
        },
      });
    } finally {
      setToolNote(null);
      setStreaming(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Conversar com a Fia"
        title="Conversar com a Fia"
        onClick={() => {
          setOpen(true);
        }}
        className={cn(
          'fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full',
          'bg-brand-500 text-text-on-brand shadow-lg transition-transform hover:scale-105',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        )}
      >
        <Bot aria-hidden className="h-6 w-6" />
      </button>
    );
  }

  return (
    <aside
      aria-label="Chat com a Fia"
      className={cn(
        'fixed right-4 bottom-4 z-50 flex h-[34rem] w-[min(24rem,calc(100vw-2rem))] flex-col',
        'rounded-xl border border-border bg-surface-raised shadow-xl',
      )}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-text-on-brand">
            <Bot aria-hidden className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-text">Fia</p>
            <p className="text-xs text-text-faint">assistente da oficina</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Limpar conversa"
            title="Limpar conversa"
            onClick={() => {
              setMessages([]);
            }}
            className="rounded p-1.5 text-text-faint hover:bg-surface-sunken hover:text-text"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Fechar chat"
            onClick={() => {
              setOpen(false);
            }}
            className="rounded p-1.5 text-text-faint hover:bg-surface-sunken hover:text-text"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              Oi! Eu conheço o OFIX de ponta a ponta e enxergo os dados da sua empresa. O que
              você precisa?
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  void send(suggestion);
                }}
                className={cn(
                  'block w-full rounded-lg border border-border px-3 py-2 text-left text-sm',
                  'text-text-muted hover:border-brand-500 hover:text-text',
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 text-sm',
              message.role === 'user'
                ? 'ml-auto bg-brand-500 text-text-on-brand'
                : 'bg-surface-sunken text-text',
            )}
          >
            {message.role === 'assistant' ? (
              message.content === '' && streaming && toolNote === null ? (
                <Loader2 aria-label="Fia digitando" className="h-4 w-4 animate-spin" />
              ) : (
                renderMarkdown(message.content)
              )
            ) : (
              message.content
            )}
          </div>
        ))}
        {toolNote !== null && (
          <p aria-live="polite" className="flex items-center gap-2 text-xs text-text-faint italic">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" /> {toolNote}
          </p>
        )}
      </div>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Pergunte à Fia…"
          aria-label="Mensagem para a Fia"
          maxLength={4000}
          className={cn(
            'h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text',
            'placeholder:text-text-faint focus-visible:outline-2 focus-visible:outline-brand-500',
          )}
        />
        <Button type="submit" size="sm" disabled={streaming || draft.trim() === ''}>
          <Send aria-hidden className="h-4 w-4" />
          <span className="sr-only">Enviar</span>
        </Button>
      </form>
    </aside>
  );
}
