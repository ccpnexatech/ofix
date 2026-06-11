'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from './cn';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra line shown under the label (e.g. customer phone). */
  description?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  id?: string;
  className?: string;
}

/**
 * Searchable single-select (customer lookup — spec 007). Radix Popover +
 * plain filtered list: no command palette dependency.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Selecionar…',
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'Nenhum resultado',
  id,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
        }
      }}
    >
      <PopoverPrimitive.Trigger
        id={id}
        role="combobox"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border',
          'bg-surface-raised px-3 text-sm',
          selected ? 'text-text' : 'text-text-faint',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500',
          className,
        )}
      >
        {selected?.label ?? placeholder}
        <ChevronsUpDown aria-hidden className="h-4 w-4 shrink-0 text-text-faint" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-border bg-surface-raised shadow-md"
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={searchPlaceholder}
            className="w-full border-b border-border bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-faint"
          />
          <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="flex items-center gap-2 px-2 py-3 text-sm text-text-faint">
                <SearchX aria-hidden className="h-4 w-4" />
                {emptyMessage}
              </li>
            )}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value === value ? null : option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    'text-text hover:bg-surface-sunken',
                  )}
                >
                  <span className="flex flex-col">
                    {option.label}
                    {option.description && (
                      <span className="text-xs text-text-faint">{option.description}</span>
                    )}
                  </span>
                  {option.value === value && (
                    <Check aria-hidden className="h-4 w-4 text-brand-600" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
