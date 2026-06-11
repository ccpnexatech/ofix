'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { cn } from './cn';

// Radix Toast restyled with OFIX tokens (ADR-009), with a minimal hook API:
// const { toast } = useToast(); toast({ title, tone })

export interface ToastInput {
  title: string;
  description?: string;
  tone?: 'success' | 'danger' | 'info';
}

interface ToastRecord extends Required<Omit<ToastInput, 'description'>> {
  id: number;
  description?: string;
}

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return context;
}

const TONE_META = {
  success: { icon: CheckCircle2, className: 'text-success' },
  danger: { icon: XCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-info' },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((input: ToastInput) => {
    setToasts((current) => [
      ...current,
      { id: Date.now() + Math.random(), tone: 'info', ...input },
    ]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((item) => {
          const meta = TONE_META[item.tone];
          const Icon = meta.icon;
          return (
            <ToastPrimitive.Root
              key={item.id}
              onOpenChange={(open) => {
                if (!open) {
                  setToasts((current) => current.filter((t) => t.id !== item.id));
                }
              }}
              className={cn(
                'flex items-start gap-3 rounded-md border border-border bg-surface-raised p-3 shadow-lg',
                'data-[state=closed]:animate-out data-[state=closed]:fade-out',
              )}
            >
              <Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', meta.className)} />
              <div className="flex flex-col gap-0.5">
                <ToastPrimitive.Title className="text-sm font-medium text-text">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description && (
                  <ToastPrimitive.Description className="text-xs text-text-muted">
                    {item.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close aria-label="Fechar" className="ml-auto text-text-faint hover:text-text">
                <X aria-hidden className="h-4 w-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
