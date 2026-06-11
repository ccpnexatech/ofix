import type { OrderStatus, Priority } from '@ofix/shared';
import {
  AlertTriangle,
  ArrowDown,
  Ban,
  CheckCircle2,
  Inbox,
  Minus,
  PackageCheck,
  Search,
  Send,
  Truck,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { cn } from './cn';

/**
 * Status is ALWAYS communicated by color + icon + text, never color alone
 * (spec 007). One semantic token per status feeds badge and dashboard donut.
 */
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  RECEIVED: {
    label: 'Recebida',
    icon: Inbox,
    className: 'text-status-received bg-status-received-bg',
  },
  IN_DIAGNOSIS: {
    label: 'Em diagnóstico',
    icon: Search,
    className: 'text-status-in-diagnosis bg-status-in-diagnosis-bg',
  },
  QUOTE_SENT: {
    label: 'Orçamento enviado',
    icon: Send,
    className: 'text-status-quote-sent bg-status-quote-sent-bg',
  },
  APPROVED: {
    label: 'Aprovada',
    icon: CheckCircle2,
    className: 'text-status-approved bg-status-approved-bg',
  },
  REJECTED: {
    label: 'Recusada',
    icon: XCircle,
    className: 'text-status-rejected bg-status-rejected-bg',
  },
  IN_REPAIR: {
    label: 'Em reparo',
    icon: Wrench,
    className: 'text-status-in-repair bg-status-in-repair-bg',
  },
  READY: {
    label: 'Pronta',
    icon: PackageCheck,
    className: 'text-status-ready bg-status-ready-bg',
  },
  DELIVERED: {
    label: 'Entregue',
    icon: Truck,
    className: 'text-status-delivered bg-status-delivered-bg',
  },
  CANCELED: {
    label: 'Cancelada',
    icon: Ban,
    className: 'text-status-canceled bg-status-canceled-bg',
  },
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium',
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export const PRIORITY_META: Record<
  Priority,
  { label: string; icon: LucideIcon; className: string }
> = {
  LOW: { label: 'Baixa', icon: ArrowDown, className: 'bg-surface-sunken text-text-faint' },
  NORMAL: { label: 'Normal', icon: Minus, className: 'bg-surface-sunken text-text-muted' },
  HIGH: { label: 'Alta', icon: AlertTriangle, className: 'bg-warning-bg text-warning' },
  URGENT: { label: 'Urgente', icon: AlertTriangle, className: 'bg-danger-bg text-danger' },
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      data-priority={priority}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium',
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}
