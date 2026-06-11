import type { ReactNode } from 'react';

import { cn } from './cn';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: ReactNode;
}

/** Audit trail of an order (ADR-004): markers + connector line. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
          {index < items.length - 1 && (
            <span aria-hidden className="absolute top-7 left-[13px] h-full w-px bg-border" />
          )}
          <span
            className={cn(
              'z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              'border border-border bg-surface-raised text-brand-600',
            )}
          >
            {item.icon ?? <span className="h-2 w-2 rounded-full bg-brand-500" />}
          </span>
          <div className="flex flex-col gap-0.5 pt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-text">{item.title}</span>
              <time data-numeric className="text-xs text-text-faint">
                {item.timestamp}
              </time>
            </div>
            {item.description && <p className="text-sm text-text-muted">{item.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
