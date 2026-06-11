'use client';

import type { MeResponse } from '@ofix/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { TourOverlay, type SpotlightRect } from './tour-overlay';
import { findTourForPath } from './tours';
import type { TourDefinition } from './types';

const AUTO_START_DELAY_MS = 800; // spec 009

interface ActiveTour {
  tour: TourDefinition;
  stepIndex: number;
}

interface TourContextValue {
  /** Starts (or restarts) a tour right away. */
  start: (tour: TourDefinition) => void;
  /** Tour mapped to the current route, if any. */
  currentRouteTour: TourDefinition | undefined;
  activeTourId: string | undefined;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used inside <TourProvider>');
  }
  return context;
}

const toursKey = ['tours', 'completed'] as const;

function measure(selector: string): SpotlightRect | null {
  const element = document.querySelector(selector);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [active, setActive] = useState<ActiveTour | null>(null);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const autoStarted = useRef(new Set<string>());

  const completed = useQuery({
    queryKey: toursKey,
    queryFn: async () => (await apiFetch<MeResponse>('/auth/me')).completedTours,
    staleTime: Infinity,
    enabled: status === 'authenticated', // never race the session bootstrap
  });

  const persist = useMutation({
    mutationFn: (tourId: string) =>
      apiFetch<{ completedTours: string[] }>('/users/me/tours', {
        method: 'PATCH',
        body: JSON.stringify({ tourId }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(toursKey, data.completedTours);
    },
  });

  /**
   * Activates a step; missing targets (conditional UI) are skipped silently
   * in the given direction, with a dev warning (spec 009 / ADR-010).
   */
  const activateStep = useCallback((tour: TourDefinition, index: number, direction: 1 | -1) => {
    let cursor = index;
    while (cursor >= 0 && cursor < tour.steps.length) {
      const step = tour.steps[cursor];
      if (step === undefined) {
        break;
      }
      const found = document.querySelector(step.target);
      if (found) {
        found.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setActive({ tour, stepIndex: cursor });
        setRect(measure(step.target));
        return true;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[tour:${tour.id}] alvo ausente, pulando passo: ${step.target}`);
      }
      cursor += direction;
    }
    return false;
  }, []);

  const finish = useCallback(
    (tourId: string) => {
      setActive(null);
      setRect(null);
      persist.mutate(tourId);
    },
    [persist],
  );

  const start = useCallback(
    (tour: TourDefinition) => {
      // Snapshot only the steps whose target exists NOW: hidden targets
      // (role-dependent buttons, future features) must not inflate the
      // "X de Y" count nor turn the last visible step into a silent close.
      const visibleSteps = tour.steps.filter((step) => {
        const found = document.querySelector(step.target) !== null;
        if (!found && process.env.NODE_ENV !== 'production') {
          console.warn(`[tour:${tour.id}] alvo ausente, passo fora do tour: ${step.target}`);
        }
        return found;
      });
      if (visibleSteps.length === 0) {
        setActive(null);
        return;
      }
      activateStep({ ...tour, steps: visibleSteps }, 0, 1);
    },
    [activateStep],
  );

  const next = useCallback(() => {
    if (!active) {
      return;
    }
    const moved = activateStep(active.tour, active.stepIndex + 1, 1);
    if (!moved) {
      finish(active.tour.id); // walked past the last step => completed
    }
  }, [active, activateStep, finish]);

  const prev = useCallback(() => {
    if (!active) {
      return;
    }
    activateStep(active.tour, active.stepIndex - 1, -1);
  }, [active, activateStep]);

  const skip = useCallback(() => {
    if (active) {
      finish(active.tour.id); // skipping also persists (spec 009)
    }
  }, [active, finish]);

  // Re-measure while active: resize, scroll and late layout shifts.
  useEffect(() => {
    if (!active) {
      return;
    }
    const step = active.tour.steps[active.stepIndex];
    if (step === undefined) {
      return;
    }
    const update = () => {
      setRect(measure(step.target));
    };
    const interval = window.setInterval(update, 150);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active]);

  const currentRouteTour = findTourForPath(pathname);

  // Auto-start on the first visit to a screen with an unfinished tour.
  useEffect(() => {
    if (
      currentRouteTour === undefined ||
      !completed.isSuccess ||
      completed.data.includes(currentRouteTour.id) ||
      autoStarted.current.has(currentRouteTour.id)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      autoStarted.current.add(currentRouteTour.id);
      start(currentRouteTour);
    }, AUTO_START_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [currentRouteTour, completed.isSuccess, completed.data, start]);

  const value = useMemo(
    () => ({ start, currentRouteTour, activeTourId: active?.tour.id }),
    [start, currentRouteTour, active],
  );

  const activeStep = active?.tour.steps[active.stepIndex];

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && activeStep !== undefined && rect !== null && (
        <TourOverlay
          step={activeStep}
          stepNumber={active.stepIndex + 1}
          totalSteps={active.tour.steps.length}
          rect={rect}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
        />
      )}
    </TourContext.Provider>
  );
}
