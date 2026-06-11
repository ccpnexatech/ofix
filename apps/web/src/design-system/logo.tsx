import { cn } from './cn';

export interface LogoProps {
  /** full = wordmark "ofix"; icon = square mark for tight spaces. */
  variant?: 'full' | 'icon';
  className?: string;
}

/**
 * Typographic logo (spec 007): "ofix" lowercase, weight 700, with the dot of
 * the "i" in brand amber. Inherits the current text color, so it adapts to
 * both themes; the dot is always brand-500.
 */
export function Logo({ variant = 'full', className }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 32 32"
        role="img"
        aria-label="OFIX"
        className={cn('h-8 w-8', className)}
      >
        <rect width="32" height="32" rx="8" className="fill-brand-500" />
        <text
          x="16"
          y="23"
          textAnchor="middle"
          fontWeight="700"
          fontSize="18"
          fontFamily="var(--font-display)"
          className="fill-brand-950"
        >
          o
        </text>
        <circle cx="24" cy="9" r="2.5" className="fill-brand-950" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 92 32"
      role="img"
      aria-label="OFIX"
      className={cn('h-8 w-auto', className)}
    >
      {/* dotless ı keeps the slot for the brand-colored dot */}
      <text
        x="0"
        y="25"
        fontWeight="700"
        fontSize="26"
        fontFamily="var(--font-display)"
        fill="currentColor"
      >
        of{'ı'}x
      </text>
      <circle cx="47.5" cy="7.5" r="3" className="fill-brand-500" />
    </svg>
  );
}
