import type { ReactNode } from 'react';

import { cn } from './cn';

/** Simple own illustration (spec 007): wrench over a dashed circle. */
function EmptyIllustration() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className="h-24 w-24">
      <circle
        cx="48"
        cy="48"
        r="40"
        fill="none"
        strokeDasharray="6 6"
        className="stroke-border-strong"
        strokeWidth="2"
      />
      <circle cx="48" cy="48" r="28" className="fill-surface-sunken" />
      <path
        d="M58 36a10 10 0 0 0-13.6 12.1L33 59.5a4 4 0 1 0 5.6 5.6l11.4-11.4A10 10 0 0 0 62 40.2l-6 6-4.2-4.2 6-6a10 10 0 0 0 .2 0Z"
        className="fill-brand-500"
      />
    </svg>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <EmptyIllustration />
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
