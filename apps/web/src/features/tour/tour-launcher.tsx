'use client';

import { CircleHelp } from 'lucide-react';

import { cn } from '../../design-system';
import { useTour } from './tour-provider';

/**
 * Floating "?" (bottom-left, above the future AI bubble — spec 009): reopens
 * the tour of the current screen at any time. Hidden on routes without one.
 */
export function TourLauncher() {
  const { start, currentRouteTour, activeTourId } = useTour();

  if (currentRouteTour === undefined || activeTourId !== undefined) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Rever o tour desta tela"
      title="Rever o tour desta tela"
      onClick={() => {
        start(currentRouteTour);
      }}
      className={cn(
        'fixed bottom-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-full',
        'border border-border bg-surface-raised text-text-muted shadow-md transition-colors',
        'hover:bg-brand-500 hover:text-text-on-brand',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
      )}
    >
      <CircleHelp aria-hidden className="h-5 w-5" />
    </button>
  );
}
