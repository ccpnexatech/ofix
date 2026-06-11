export interface TourStep {
  /** CSS selector, by convention `[data-tour="..."]`. */
  target: string;
  title: string;
  /** Short and direct, max 2 sentences (spec 009). */
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}

/** Identity helper that keeps tour files declarative and typed. */
export function defineTour(definition: TourDefinition): TourDefinition {
  return definition;
}
