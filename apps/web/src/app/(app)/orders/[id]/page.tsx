'use client';

import type {
  QuoteStatus} from '@ofix/shared';
import {
  ItemKind,
  OrderStatus,
  Role,
  calculateQuoteTotals,
  canRoleExecuteAction,
  type OrderAction,
  type QuoteItemInput,
} from '@ofix/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Copy, Link2, Pencil, Plus, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PriorityBadge,
  Skeleton,
  StatusBadge,
  Textarea,
  Timeline,
  useToast,
} from '../../../../design-system';
import {
  assignTechnician,
  createQuoteVersion,
  getOrder,
  getOrderEvents,
  orderKeys,
  reopenWarranty,
  sendQuote,
  transitionOrder,
  updateOrder,
  updateQuoteItems,
} from '../../../../features/orders/queries';
import { TransitionPanel } from '../../../../features/orders/transition-panel';
import type { OrderDetail, OrderEventView, QuoteView } from '../../../../features/orders/types';
import { ApiError, apiFetch } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';
import { formatCents, formatDate, formatRelative } from '../../../../lib/format';

const EVENT_LABELS: Record<string, string> = {
  ORDER_CREATED: 'OS criada',
  TECHNICIAN_ASSIGNED: 'Técnico atribuído',
  STATUS_CHANGED: 'Status alterado',
  QUOTE_VERSION_CREATED: 'Orçamento criado',
  QUOTE_EXPIRED: 'Orçamento expirado',
  WARRANTY_REOPENED: 'Reaberta em garantia',
};

const ACTOR_LABELS = { USER: 'equipe', CUSTOMER: 'cliente', SYSTEM: 'sistema' } as const;

function eventDescription(event: OrderEventView): string | undefined {
  const meta = event.metadata ?? {};
  const parts: string[] = [];
  if (event.type === 'STATUS_CHANGED' && event.toStatus) {
    parts.push(`→ ${event.toStatus}`);
  }
  if (typeof meta.technicianName === 'string') {
    parts.push(meta.technicianName);
  }
  if (typeof meta.reason === 'string') {
    parts.push(`Motivo: ${meta.reason}`);
  }
  if (meta.method === 'public_token') {
    parts.push('Via link público');
  }
  if (meta.method === 'in_person') {
    parts.push('Presencial');
  }
  parts.push(`por ${ACTOR_LABELS[event.actorType]}`);
  return parts.join(' · ');
}

interface TechnicianOption {
  id: string;
  name: string;
  role: Role;
  branchId: string | null;
}

function QuoteItemsEditor({
  quote,
  onSaved,
}: {
  quote: QuoteView;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [items, setItems] = useState<QuoteItemInput[]>(
    quote.items.map(({ kind, description, quantity, unitPriceCents }) => ({
      kind,
      description,
      quantity,
      unitPriceCents,
    })),
  );
  const totals = calculateQuoteTotals(items);

  const save = useMutation({
    mutationFn: () => updateQuoteItems(quote.id, { items }),
    onSuccess: () => {
      toast({ title: 'Itens salvos', tone: 'success' });
      onSaved();
    },
    onError: (error) => {
      toast({
        title: 'Falha ao salvar itens',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  function patch(index: number, partial: Partial<QuoteItemInput>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...partial } : item)),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[5.5rem_1fr_4rem_6.5rem_2rem] items-end gap-2">
          <FormField label={index === 0 ? 'Tipo' : ''} htmlFor={`item-kind-${String(index)}`}>
            <select
              id={`item-kind-${String(index)}`}
              value={item.kind}
              onChange={(event) => {
                patch(index, { kind: event.target.value as ItemKind });
              }}
              className="h-9 w-full rounded-md border border-border bg-surface-raised px-2 text-sm text-text"
            >
              <option value="PART">Peça</option>
              <option value="LABOR">M. de obra</option>
            </select>
          </FormField>
          <FormField label={index === 0 ? 'Descrição' : ''} htmlFor={`item-desc-${String(index)}`}>
            <Input
              id={`item-desc-${String(index)}`}
              value={item.description}
              onChange={(event) => {
                patch(index, { description: event.target.value });
              }}
            />
          </FormField>
          <FormField label={index === 0 ? 'Qtd.' : ''} htmlFor={`item-qty-${String(index)}`}>
            <Input
              id={`item-qty-${String(index)}`}
              type="number"
              min={1}
              value={item.quantity}
              onChange={(event) => {
                patch(index, { quantity: Math.max(1, Number(event.target.value)) });
              }}
            />
          </FormField>
          <FormField label={index === 0 ? 'Unitário (R$)' : ''} htmlFor={`item-price-${String(index)}`}>
            <Input
              id={`item-price-${String(index)}`}
              type="number"
              min={0}
              step="0.01"
              value={(item.unitPriceCents / 100).toFixed(2)}
              onChange={(event) => {
                patch(index, {
                  unitPriceCents: Math.max(0, Math.round(Number(event.target.value) * 100)),
                });
              }}
            />
          </FormField>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Remover item"
            onClick={() => {
              setItems((current) => current.filter((_, i) => i !== index));
            }}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setItems((current) => [
              ...current,
              { kind: ItemKind.PART, description: '', quantity: 1, unitPriceCents: 0 },
            ]);
          }}
        >
          <Plus aria-hidden className="h-4 w-4" /> Adicionar item
        </Button>
        <div className="flex items-center gap-3">
          <span data-numeric className="text-sm font-semibold text-text">
            Total: {formatCents(totals.totalCents)}
          </span>
          <Button size="sm" loading={save.isPending} onClick={() => { save.mutate(); }}>
            Salvar itens
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({ order, refresh }: { order: OrderDetail; refresh: () => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showVersions, setShowVersions] = useState(false);

  const active = order.quotes[0];
  const previous = order.quotes.slice(1);
  const canManageQuote =
    user !== undefined &&
    canRoleExecuteAction(
      { role: user.role, isAssignedTechnician: order.assignedTechnician?.id === user.id },
      'SEND_QUOTE',
    );

  const createVersion = useMutation({
    mutationFn: () => createQuoteVersion(order.id),
    onSuccess: () => {
      toast({ title: 'Novo rascunho de orçamento criado', tone: 'success' });
      refresh();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível criar o orçamento',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const send = useMutation({
    mutationFn: () => sendQuote(active?.id ?? ''),
    onSuccess: () => {
      toast({ title: 'Orçamento enviado ao cliente', tone: 'success' });
      refresh();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível enviar',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  function copyPublicLink(quote: QuoteView) {
    const url = `${window.location.origin}/q/${quote.publicToken}`;
    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link público copiado', description: url, tone: 'info' });
    });
  }

  const QUOTE_STATUS_TONE: Record<QuoteStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
    DRAFT: 'neutral',
    SENT: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
    EXPIRED: 'warning',
  };

  return (
    <Card data-tour="quote-card">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Orçamento</CardTitle>
        {canManageQuote && !active?.items && null}
        {canManageQuote &&
          (active === undefined ||
            active.status === 'REJECTED' ||
            active.status === 'EXPIRED') && (
            <Button
              size="sm"
              variant="secondary"
              loading={createVersion.isPending}
              onClick={() => { createVersion.mutate(); }}
            >
              <Plus aria-hidden className="h-4 w-4" /> Nova versão
            </Button>
          )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {active === undefined && (
          <p className="text-sm text-text-faint">
            Nenhum orçamento ainda. Crie um rascunho após o diagnóstico.
          </p>
        )}
        {active && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={QUOTE_STATUS_TONE[active.status]}>
                v{active.version} · {active.status}
              </Badge>
              {active.tokenExpiresAt && active.status === 'SENT' && (
                <span className="text-text-faint">
                  válido até {formatDate(active.tokenExpiresAt)}
                </span>
              )}
              {active.status !== 'DRAFT' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    copyPublicLink(active);
                  }}
                >
                  <Copy aria-hidden className="h-4 w-4" /> Copiar link público
                </Button>
              )}
            </div>

            {active.status === 'DRAFT' && canManageQuote ? (
              <>
                <QuoteItemsEditor key={active.id} quote={active} onSaved={refresh} />
                <div className="flex justify-end">
                  <Button size="sm" loading={send.isPending} onClick={() => { send.mutate(); }}>
                    Enviar ao cliente
                  </Button>
                </div>
              </>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {active.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-1.5">
                    <span>
                      {item.description}
                      <span className="text-text-faint">
                        {' '}
                        · {item.kind === 'LABOR' ? 'mão de obra' : 'peça'} × {item.quantity}
                      </span>
                    </span>
                    <span data-numeric>{formatCents(item.subtotalCents)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between py-2 font-semibold">
                  Total <span data-numeric>{formatCents(active.totalCents)}</span>
                </li>
              </ul>
            )}
          </>
        )}

        {previous.length > 0 && (
          <div className="border-t border-border pt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-text-muted"
              aria-expanded={showVersions}
              onClick={() => {
                setShowVersions((value) => !value);
              }}
            >
              <ChevronDown
                aria-hidden
                className={`h-3.5 w-3.5 transition-transform ${showVersions ? 'rotate-180' : ''}`}
              />
              Versões anteriores ({previous.length})
            </button>
            {showVersions && (
              <ul className="mt-2 flex flex-col gap-1 text-sm text-text-muted">
                {previous.map((quote) => (
                  <li key={quote.id} className="flex items-center justify-between">
                    <span>
                      v{quote.version} · {quote.status}
                      {quote.rejectionReason && ` — "${quote.rejectionReason}"`}
                    </span>
                    <span data-numeric>{formatCents(quote.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [assignOpen, setAssignOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [editingDiagnosis, setEditingDiagnosis] = useState(false);
  const [diagnosisDraft, setDiagnosisDraft] = useState('');

  const order = useQuery({ queryKey: orderKeys.detail(orderId), queryFn: () => getOrder(orderId) });
  const events = useQuery({
    queryKey: orderKeys.events(orderId),
    queryFn: () => getOrderEvents(orderId),
  });
  const technicians = useQuery({
    queryKey: ['users', 'technicians'],
    queryFn: () => apiFetch<{ data: TechnicianOption[] }>('/users?perPage=100'),
    enabled: assignOpen && user?.role !== Role.TECHNICIAN,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    void queryClient.invalidateQueries({ queryKey: orderKeys.events(orderId) });
    void queryClient.invalidateQueries({ queryKey: orderKeys.all });
  }

  const transition = useMutation({
    mutationFn: ({ action, reason }: { action: OrderAction; reason?: string }) =>
      transitionOrder(orderId, action, reason),
    onSuccess: (updated) => {
      toast({ title: `Status: ${updated.status}`, tone: 'success' });
      refresh();
    },
    onError: (error) => {
      toast({
        title: 'Transição não permitida',
        description: error instanceof ApiError ? error.message : 'Tente novamente.',
        tone: 'danger',
      });
      throw error;
    },
  });

  const assign = useMutation({
    mutationFn: () => assignTechnician(orderId, { technicianId: technicianId ?? '' }),
    onSuccess: () => {
      toast({ title: 'Técnico atribuído', tone: 'success' });
      setAssignOpen(false);
      refresh();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível atribuir',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const saveDiagnosis = useMutation({
    mutationFn: () => updateOrder(orderId, { technicalDiagnosis: diagnosisDraft }),
    onSuccess: () => {
      toast({ title: 'Diagnóstico salvo', tone: 'success' });
      setEditingDiagnosis(false);
      refresh();
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível salvar',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const reopen = useMutation({
    mutationFn: () => reopenWarranty(orderId),
    onSuccess: (child) => {
      toast({ title: `OS de garantia ${child.code} criada`, tone: 'success' });
      window.location.href = `/orders/${child.id}`;
    },
    onError: (error) => {
      toast({
        title: 'Reabertura bloqueada',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  if (order.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (order.isError) {
    return (
      <EmptyState
        title="OS não encontrada"
        description="Ela pode ter sido removida ou você não tem acesso."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void order.refetch();
            }}
          >
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const data = order.data;
  const overdue =
    data.promisedAt !== null &&
    new Date(data.promisedAt).getTime() < Date.now() &&
    !['DELIVERED', 'CANCELED'].includes(data.status);
  const diagnosisEditable =
    ([OrderStatus.RECEIVED, OrderStatus.IN_DIAGNOSIS] as OrderStatus[]).includes(data.status) &&
    user !== undefined &&
    (user.role === Role.ADMIN ||
      (user.role === Role.TECHNICIAN && data.assignedTechnician?.id === user.id));
  const canAssign = user?.role === Role.ADMIN || user?.role === Role.ATTENDANT;
  const canReopen =
    data.status === OrderStatus.DELIVERED &&
    (user?.role === Role.ADMIN || user?.role === Role.ATTENDANT);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" data-tour="order-detail">
      <div className="flex flex-col gap-4">
        <header data-tour="order-header" className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold text-text">{data.code}</h1>
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          <Badge>{data.branch.name}</Badge>
          {data.promisedAt && (
            <span className={`text-sm ${overdue ? 'font-medium text-danger' : 'text-text-muted'}`}>
              prazo {formatDate(data.promisedAt)}
              {overdue && ' — atrasada ⚠'}
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Cliente</CardTitle>
              <Link
                href={`/customers/${data.customer.id}`}
                className="text-xs text-brand-600 hover:underline"
              >
                ver perfil
              </Link>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium text-text">{data.customer.name}</p>
              <p className="text-text-muted">{data.customer.phone}</p>
              {data.customer.email && <p className="text-text-muted">{data.customer.email}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Equipamento</CardTitle>
              {canAssign && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAssignOpen(true);
                  }}
                  data-tour="assign-technician"
                >
                  <UserPlus aria-hidden className="h-4 w-4" />
                  {data.assignedTechnician ? 'Trocar técnico' : 'Atribuir técnico'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium text-text">
                {data.equipment.type} {data.equipment.brand} {data.equipment.model}
              </p>
              <p className="text-text-muted">
                Técnico: {data.assignedTechnician?.name ?? 'não atribuído'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Problema e diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs font-medium tracking-wide text-text-faint uppercase">
                Defeito relatado
              </p>
              <p className="text-text">{data.reportedIssue}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium tracking-wide text-text-faint uppercase">
                  Diagnóstico técnico
                </p>
                {diagnosisEditable && !editingDiagnosis && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Editar diagnóstico"
                    onClick={() => {
                      setDiagnosisDraft(data.technicalDiagnosis ?? '');
                      setEditingDiagnosis(true);
                    }}
                  >
                    <Pencil aria-hidden className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {editingDiagnosis ? (
                <div className="mt-1 flex flex-col gap-2">
                  <Textarea
                    value={diagnosisDraft}
                    onChange={(event) => {
                      setDiagnosisDraft(event.target.value);
                    }}
                    placeholder="Mínimo de 20 caracteres para enviar orçamento (RN-03)"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingDiagnosis(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      loading={saveDiagnosis.isPending}
                      onClick={() => { saveDiagnosis.mutate(); }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-text">
                  {data.technicalDiagnosis ?? (
                    <span className="text-text-faint">ainda sem diagnóstico</span>
                  )}
                </p>
              )}
            </div>
            {data.canceledReason && (
              <p className="rounded-md bg-danger-bg px-3 py-2 text-danger">
                Cancelada: {data.canceledReason}
              </p>
            )}
          </CardContent>
        </Card>

        <QuoteCard order={data} refresh={refresh} />

        {(data.status === OrderStatus.DELIVERED || data.warrantyParentId !== null) && (
          <Card data-tour="warranty-card">
            <CardHeader>
              <CardTitle>Garantia</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {data.warrantyParentId !== null && (
                <p>
                  OS de garantia —{' '}
                  <Link
                    href={`/orders/${data.warrantyParentId}`}
                    className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                  >
                    <Link2 aria-hidden className="h-3.5 w-3.5" /> ver OS original
                  </Link>
                </p>
              )}
              {data.status === OrderStatus.DELIVERED && data.warrantyUntil && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    Garantia válida até{' '}
                    <strong data-numeric>{formatDate(data.warrantyUntil)}</strong> (90 dias após a
                    entrega — RN-06)
                  </p>
                  {canReopen && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={reopen.isPending}
                      onClick={() => { reopen.mutate(); }}
                    >
                      <RotateCcw aria-hidden className="h-4 w-4" /> Reabrir em garantia
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {user && (
          <TransitionPanel
            status={data.status}
            user={user}
            assignedTechnicianId={data.assignedTechnician?.id ?? null}
            onTransition={async (action, reason) => {
              await transition.mutateAsync({ action, reason }).catch(() => undefined);
            }}
          />
        )}

        <Card data-tour="order-timeline">
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {events.isPending && <Skeleton className="h-32 w-full" />}
            {events.isError && (
              <p className="text-sm text-text-faint">Não foi possível carregar os eventos.</p>
            )}
            {events.isSuccess && (
              <Timeline
                items={events.data.map((event) => ({
                  id: event.id,
                  title: EVENT_LABELS[event.type] ?? event.type,
                  description: eventDescription(event),
                  timestamp: formatRelative(event.createdAt),
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogTitle>Atribuir técnico</DialogTitle>
          <FormField label="Técnico" htmlFor="assign-technician" className="mt-3">
            <Combobox
              id="assign-technician"
              value={technicianId}
              onChange={setTechnicianId}
              placeholder="Selecionar técnico…"
              options={(technicians.data?.data ?? [])
                .filter((candidate) => candidate.role === Role.TECHNICIAN)
                .map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            />
          </FormField>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAssignOpen(false);
              }}
            >
              Voltar
            </Button>
            <Button
              disabled={technicianId === null}
              loading={assign.isPending}
              onClick={() => { assign.mutate(); }}
            >
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
