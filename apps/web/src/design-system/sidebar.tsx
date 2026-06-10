import type { ReactNode } from 'react';

import { cn } from './cn';
import { Logo } from './logo';

export interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active?: boolean;
}

export function SidebarItem({ icon, label, href, active = false }: SidebarItemProps) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-500/12 text-brand-700 dark:text-brand-300'
          : 'text-text-muted hover:bg-surface-sunken hover:text-text',
      )}
    >
      <span aria-hidden className="[&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      {label}
    </a>
  );
}

export function Sidebar({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'flex h-full w-60 flex-col gap-4 border-r border-border bg-surface-raised p-4',
        className,
      )}
    >
      <div className="px-1 text-text">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-1">{children}</nav>
      {footer && <div className="border-t border-border pt-3">{footer}</div>}
    </aside>
  );
}
