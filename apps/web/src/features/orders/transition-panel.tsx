'use client';

import type {
  OrderAction} from '@ofix/shared';
import {
  ORDER_ACTIONS,
  canRoleExecuteAction,
  nextStatus,
  type AuthUser,
  type OrderStatus,
} from '@ofix/shared';
import {
  Ban,
  CheckCircle2,
  PackageCheck,
  Search,
  Send,
  ThumbsDown,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Textarea,
} from '../../design-system';

const ACTION_META: Record<
  OrderAction,
  { label: string; icon: LucideIcon; destructive?: boolean; reasonMin?: number }
> = {
  START_DIAGNOSIS: { label: 'Iniciar diagnóstico', icon: Search },
  SEND_QUOTE: { label: 'Enviar orçamento', icon: Send },
  APPROVE_QUOTE: { label: 'Aprovar (presencial)', icon: CheckCircle2 },
  REJECT_QUOTE: {
    label: 'Recusar (presencial)',
    icon: ThumbsDown,
    destructive: true,
    reasonMin: 5, // RN-04
  },
  START_REPAIR: { label: 'Iniciar reparo', icon: Wrench },
  MARK_READY: { label: 'Marcar como pronta', icon: PackageCheck },
  DELIVER: { label: 'Entregar', icon: Truck },
  CANCEL: { label: 'Cancelar OS', icon: Ban, destructive: true, reasonMin: 10 }, // RN-08
};

export interface TransitionPanelProps {
  status: OrderStatus;
  user: Pick<AuthUser, 'id' | 'role'>;
  assignedTechnicianId: string | null;
  onTransition: (action: OrderAction, reason?: string) => Promise<void>;
}

/**
 * THE transition panel (spec 006): buttons come from the SAME shared state
 * machine (nextStatus) filtered by the SAME shared role matrix — zero
 * transition logic duplicated in the front. Destructive actions collect the
 * mandatory reason in a dialog; the API revalidates everything (ADR-006).
 */
export function TransitionPanel({
  status,
  user,
  assignedTechnicianId,
  onTransition,
}: TransitionPanelProps) {
  const [pendingAction, setPendingAction] = useState<OrderAction | undefined>(undefined);
  const [reasonFor, setReasonFor] = useState<OrderAction | undefined>(undefined);
  const [reason, setReason] = useState('');

  const actor = {
    role: user.role,
    isAssignedTechnician: assignedTechnicianId === user.id,
  };
  const available = ORDER_ACTIONS.filter(
    (action) => nextStatus(status, action) !== undefined && canRoleExecuteAction(actor, action),
  );

  async function run(action: OrderAction, reasonValue?: string) {
    setPendingAction(action);
    try {
      await onTransition(action, reasonValue);
      setReasonFor(undefined);
      setReason('');
    } finally {
      setPendingAction(undefined);
    }
  }

  const dialogMeta = reasonFor ? ACTION_META[reasonFor] : undefined;
  const reasonTooShort = reason.trim().length < (dialogMeta?.reasonMin ?? 0);

  return (
    <Card data-tour="transition-panel">
      <CardHeader>
        <CardTitle>Ações</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {available.length === 0 && (
          <p className="text-sm text-text-faint">
            Nenhuma ação disponível neste status para o seu papel.
          </p>
        )}
        {available.map((action) => {
          const meta = ACTION_META[action];
          const Icon = meta.icon;
          return (
            <Button
              key={action}
              variant={meta.destructive ? 'danger' : 'secondary'}
              className="justify-start"
              data-action={action}
              loading={pendingAction === action}
              onClick={() => {
                if (meta.reasonMin !== undefined) {
                  setReasonFor(action);
                } else {
                  void run(action);
                }
              }}
            >
              <Icon aria-hidden className="h-4 w-4" /> {meta.label}
            </Button>
          );
        })}
      </CardContent>

      <Dialog
        open={reasonFor !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setReasonFor(undefined);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{dialogMeta?.label}</DialogTitle>
          <DialogDescription>
            Informe o motivo (mínimo {dialogMeta?.reasonMin} caracteres). Esta ação fica registrada
            na linha do tempo.
          </DialogDescription>
          <FormField label="Motivo" htmlFor="transition-reason" className="mt-3">
            <Textarea
              id="transition-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              autoFocus
            />
          </FormField>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setReasonFor(undefined);
                setReason('');
              }}
            >
              Voltar
            </Button>
            <Button
              variant="danger"
              disabled={reasonTooShort}
              loading={pendingAction !== undefined}
              onClick={() => {
                if (reasonFor) {
                  void run(reasonFor, reason.trim());
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
