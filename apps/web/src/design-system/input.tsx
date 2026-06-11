import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { cn } from './cn';

const fieldClasses = [
  'w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-text',
  'placeholder:text-text-faint transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
  'disabled:cursor-not-allowed disabled:opacity-55',
  'aria-invalid:border-danger aria-invalid:outline-danger',
].join(' ');

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid === true ? true : undefined}
      className={cn(fieldClasses, 'h-9', className)}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid === true ? true : undefined}
      className={cn(fieldClasses, 'min-h-20 py-2', className)}
      {...props}
    />
  );
}

/** Simple DatePicker (spec 007): styled native date input — no calendar lib. */
export function DatePicker({ className, invalid, ...props }: InputProps) {
  return (
    <input
      type="date"
      aria-invalid={invalid === true ? true : undefined}
      className={cn(fieldClasses, 'h-9 [color-scheme:light] dark:[color-scheme:dark]', className)}
      {...props}
    />
  );
}

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, htmlFor, hint, error, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-text-faint">{hint}</p>
      )}
    </div>
  );
}
