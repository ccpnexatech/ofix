'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useRef } from 'react';

import { Button } from '../../design-system';
import type { TourStep } from './types';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 6;

export interface TourOverlayProps {
  step: TourStep;
  stepNumber: number;
  totalSteps: number;
  rect: SpotlightRect;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

/**
 * Spotlight + anchored popover (ADR-010). The dimming is four rectangles
 * around the target (perfect browser support, no clip-path quirks); the
 * popover anchors to a virtual element placed over the target and lets Radix
 * handle placement fallbacks.
 */
export function TourOverlay({
  step,
  stepNumber,
  totalSteps,
  rect,
  onNext,
  onPrev,
  onSkip,
}: TourOverlayProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Focus lands on the popover when the step changes (a11y — spec 009).
  useEffect(() => {
    contentRef.current?.focus();
  }, [stepNumber]);

  const top = Math.max(rect.top - PADDING, 0);
  const left = Math.max(rect.left - PADDING, 0);
  const width = rect.width + PADDING * 2;
  const height = rect.height + PADDING * 2;
  const isLast = stepNumber === totalSteps;

  const shade = 'fixed bg-black/55 z-[70]';

  return (
    <div data-tour-overlay>
      {/* dimming around the spotlight */}
      <div aria-hidden className={shade} style={{ top: 0, left: 0, right: 0, height: top }} />
      <div
        aria-hidden
        className={shade}
        style={{ top, left: 0, width: left, height }}
      />
      <div
        aria-hidden
        className={shade}
        style={{ top, left: left + width, right: 0, height }}
      />
      <div
        aria-hidden
        className={shade}
        style={{ top: top + height, left: 0, right: 0, bottom: 0 }}
      />
      {/* amber focus ring around the target */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[70] animate-pulse rounded-md border-2 border-brand-500"
        style={{ top, left, width, height }}
      />

      {/* status for screen readers */}
      <span aria-live="polite" className="sr-only">
        Passo {stepNumber} de {totalSteps}: {step.title}
      </span>

      <PopoverPrimitive.Root open>
        <PopoverPrimitive.Anchor asChild>
          <div
            aria-hidden
            className="pointer-events-none fixed z-[70]"
            style={{ top, left, width, height }}
          />
        </PopoverPrimitive.Anchor>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={contentRef}
            side={step.placement ?? 'bottom'}
            sideOffset={10}
            collisionPadding={12}
            role="dialog"
            aria-label={`Tour: ${step.title}`}
            tabIndex={-1}
            onEscapeKeyDown={onSkip}
            onInteractOutside={(event) => {
              event.preventDefault(); // focus stays in the tour
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                onNext();
              }
              if (event.key === 'ArrowLeft' && stepNumber > 1) {
                event.preventDefault();
                onPrev();
              }
            }}
            className="z-[80] w-80 rounded-lg border border-border bg-surface-raised p-4 shadow-lg outline-none"
          >
            <p className="text-xs font-medium tracking-wide text-text-faint uppercase">
              {stepNumber} de {totalSteps}
            </p>
            <h2 className="mt-1 font-display text-base font-semibold text-text">{step.title}</h2>
            <p className="mt-1 text-sm text-text-muted">{step.body}</p>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Pular
              </Button>
              <div className="flex gap-2">
                {stepNumber > 1 && (
                  <Button variant="secondary" size="sm" onClick={onPrev}>
                    Voltar
                  </Button>
                )}
                <Button size="sm" onClick={onNext} data-tour-next>
                  {isLast ? 'Concluir' : 'Próximo'}
                </Button>
              </div>
            </div>
            <PopoverPrimitive.Arrow className="fill-surface-raised" />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
