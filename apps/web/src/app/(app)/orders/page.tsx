'use client';

import { OrderStatus, Priority, Role } from '@ofix/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback } from 'react';

import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  PriorityBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../design-system';
import { ORDER_STATUS_META, PRIORITY_META } from '../../../design-system/status-badge';
import { branchKeys, listBranches, listOrders, orderKeys } from '../../../features/orders/queries';
import { useAuth } from '../../../lib/auth';
import { formatDate } from '../../../lib/format';

const FILTERABLE = ['status', 'branchId', 'priority', 'search'] as const;
type FilterKey = (typeof FILTERABLE)[number];

function OrdersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const apiParams = new URLSearchParams(searchParams);
  if (!apiParams.has('page')) {
    apiParams.set('page', '1');
  }
  const queryString = apiParams.toString();

  const orders = useQuery({
    queryKey: orderKeys.list(queryString),
    queryFn: () => listOrders(queryString),
  });
  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });

  const setParam = useCallback(
    (key: FilterKey | 'page', value: string | undefined) => {
      const next = new URLSearchParams(searchParams);
      if (value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      if (key !== 'page') {
        next.delete('page'); // filters reset pagination
      }
      router.replace(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const page = Number(searchParams.get('page') ?? '1');
  const activeFilters = FILTERABLE.filter((key) => searchParams.get(key) !== null);
  const branchLocked = user !== undefined && user.branchId !== null; // RN-12

  function filterLabel(key: FilterKey, value: string): string {
    if (key === 'status') {
      return ORDER_STATUS_META[value as OrderStatus].label;
    }
    if (key === 'priority') {
      return PRIORITY_META[value as Priority].label;
    }
    if (key === 'branchId') {
      return branches.data?.find((b) => b.id === value)?.name ?? 'Filial';
    }
    return `"${value}"`;
  }

  return (
    <div className="flex flex-col gap-4" data-tour="orders-page">
      <PageHeader
        title="Ordens de serviço"
        description="Acompanhe todas as OS do tenant — filtros combinam entre si."
        actions={
          user?.role !== Role.TECHNICIAN && (
            <Button
              data-tour="new-order"
              onClick={() => {
                router.push('/orders/new');
              }}
            >
              <Plus aria-hidden className="h-4 w-4" /> Nova OS
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2" data-tour="orders-filters">
        <Select
          value={searchParams.get('status') ?? 'ALL'}
          onValueChange={(value) => {
            setParam('status', value === 'ALL' ? undefined : value);
          }}
        >
          <SelectTrigger aria-label="Filtrar por status" className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.values(OrderStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {ORDER_STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('priority') ?? 'ALL'}
          onValueChange={(value) => {
            setParam('priority', value === 'ALL' ? undefined : value);
          }}
        >
          <SelectTrigger aria-label="Filtrar por prioridade" className="w-40">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toda prioridade</SelectItem>
            {Object.values(Priority).map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_META[priority].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={branchLocked ? (user.branchId ?? '') : (searchParams.get('branchId') ?? 'ALL')}
          onValueChange={(value) => {
            setParam('branchId', value === 'ALL' ? undefined : value);
          }}
          disabled={branchLocked}
        >
          <SelectTrigger aria-label="Filtrar por filial" className="w-44">
            <SelectValue placeholder="Filial" />
          </SelectTrigger>
          <SelectContent>
            {!branchLocked && <SelectItem value="ALL">Todas as filiais</SelectItem>}
            {(branches.data ?? []).map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilters.map((key) => (
              <Badge key={key} tone="brand" className="gap-1">
                {filterLabel(key, searchParams.get(key) ?? '')}
                <button
                  type="button"
                  aria-label={`Remover filtro ${key}`}
                  onClick={() => {
                    setParam(key, undefined);
                  }}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {orders.isPending && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {orders.isError && (
        <EmptyState
          title="Não foi possível carregar as OS"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void orders.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      )}

      {orders.isSuccess && orders.data.data.length === 0 && (
        <EmptyState
          title="Nenhuma OS encontrada"
          description={
            activeFilters.length > 0
              ? 'Nenhum resultado com os filtros atuais.'
              : 'Crie a primeira ordem de serviço para começar.'
          }
          action={
            activeFilters.length > 0 ? (
              <Button
                variant="secondary"
                onClick={() => {
                  router.replace(pathname);
                }}
              >
                Limpar filtros
              </Button>
            ) : (
              <Button
                onClick={() => {
                  router.push('/orders/new');
                }}
              >
                Nova OS
              </Button>
            )
          }
        />
      )}

      {orders.isSuccess && orders.data.data.length > 0 && (
        <>
          <div className="max-h-[34rem]">
            <Table data-tour="orders-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.data.data.map((order) => {
                  const overdue =
                    order.promisedAt !== null &&
                    new Date(order.promisedAt).getTime() < Date.now() &&
                    !['DELIVERED', 'CANCELED'].includes(order.status);
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => {
                        router.push(`/orders/${order.id}`);
                      }}
                    >
                      <TableCell className="font-mono text-xs">
                        <Link href={`/orders/${order.id}`} className="hover:underline">
                          {order.code}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customer.name}</TableCell>
                      <TableCell className="text-text-muted">
                        {order.equipment.brand} {order.equipment.model}
                      </TableCell>
                      <TableCell className="text-text-muted">{order.branch.name}</TableCell>
                      <TableCell className="text-text-muted">
                        {order.assignedTechnician?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={order.priority} />
                      </TableCell>
                      <TableCell className={overdue ? 'font-medium text-danger' : undefined}>
                        {order.promisedAt ? formatDate(order.promisedAt) : '—'}
                        {overdue && ' ⚠'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span data-numeric>
              {orders.data.meta.total} OS · página {orders.data.meta.page} de{' '}
              {orders.data.meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setParam('page', String(page - 1));
                }}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= orders.data.meta.totalPages}
                onClick={() => {
                  setParam('page', String(page + 1));
                }}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <OrdersContent />
    </Suspense>
  );
}
