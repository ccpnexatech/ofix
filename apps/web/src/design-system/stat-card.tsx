import { TrendingDown, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card } from './card';
import { cn } from './cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Variation vs. the previous period, e.g. "+12%" / "-3%". */
  delta?: { value: string; trend: 'up' | 'down' };
  icon?: ReactNode;
  className?: string;
}

/** Dashboard metric: value in tabular numbers + optional delta (spec 007). */
export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <Card className={cn('flex items-start justify-between gap-3 p-4', className)}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-wide text-text-faint uppercase">
          {label}
        </span>
        <span data-numeric className="text-xl font-semibold text-text">
          {value}
        </span>
        {delta && (
          <span
            data-numeric
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              delta.trend === 'up' ? 'text-success' : 'text-danger',
            )}
          >
            {delta.trend === 'up' ? (
              <TrendingUp aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown aria-hidden className="h-3.5 w-3.5" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {icon && <div className="rounded-md bg-surface-sunken p-2 text-text-faint">{icon}</div>}
    </Card>
  );
}
