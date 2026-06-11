'use client';

import { Role } from '@ofix/shared';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, Timer, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  PriorityBadge,
  Skeleton,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../design-system';
import { ORDER_STATUS_META } from '../../../design-system/status-badge';
import {
  dashboardKeys,
  getBranchesComparison,
  getOrdersByStatus,
  getRevenueByMonth,
  getSummary,
} from '../../../features/dashboard/queries';
import { listOrders, orderKeys } from '../../../features/orders/queries';
import { useAuth } from '../../../lib/auth';
import { formatCents, formatDate } from '../../../lib/format';

const MONTH_LABELS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(key: string): string {
  const month = Number(key.slice(5)) - 1;
  return `${MONTH_LABELS[month] ?? key}/${key.slice(2, 4)}`;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const branchId = searchParams.get('branchId');

  const summary = useQuery({
    queryKey: dashboardKeys.summary(branchId),
    queryFn: () => getSummary(branchId),
  });
  const byStatus = useQuery({
    queryKey: dashboardKeys.byStatus(branchId),
    queryFn: () => getOrdersByStatus(branchId),
  });
  const revenue = useQuery({
    queryKey: dashboardKeys.revenue(branchId),
    queryFn: () => getRevenueByMonth(branchId),
  });
  const comparison = useQuery({
    queryKey: dashboardKeys.comparison,
    queryFn: getBranchesComparison,
    enabled: user?.role === Role.ADMIN,
  });
  const attention = useQuery({
    queryKey: orderKeys.list(`dashboard-attention-${branchId ?? 'all'}`),
    queryFn: () => listOrders(`perPage=100${branchId === null ? '' : `&branchId=${branchId}`}`),
  });

  if (summary.isError) {
    return (
      <EmptyState
        title="Não foi possível carregar o dashboard"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void summary.refetch();
            }}
          >
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const s = summary.data;
  const attentionRows = (attention.data?.data ?? [])
    .filter(
      (order) =>
        !['DELIVERED', 'CANCELED'].includes(order.status) &&
        (order.priority === 'URGENT' ||
          (order.promisedAt !== null && new Date(order.promisedAt).getTime() < Date.now())),
    )
    .slice(0, 8);

  // One token per status (spec 007) feeds badge AND donut.
  const donutData = (byStatus.data ?? [])
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      ...entry,
      fill: `var(--status-${entry.status.toLowerCase().replaceAll('_', '-')})`,
    }));

  return (
    <div className="flex flex-col gap-4" data-tour="dashboard">
      <PageHeader
        title="Dashboard"
        description={
          user?.role === Role.TECHNICIAN
            ? 'Recorte das OS atribuídas a você.'
            : 'Visão consolidada — use o seletor de filial no topo.'
        }
      />

      {summary.isPending || s === undefined ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6" data-tour="dashboard-stats">
          <StatCard label="OS abertas" value={s.openOrders} icon={<ClipboardList />} />
          <StatCard
            label="Atrasadas"
            value={s.overdueOrders}
            icon={<AlertTriangle className={s.overdueOrders > 0 ? 'text-danger' : undefined} />}
          />
          <StatCard label="Receita do mês" value={formatCents(s.revenueCents)} icon={<Wallet />} />
          <StatCard label="Ticket médio" value={formatCents(s.avgTicketCents)} />
          <StatCard
            label="Taxa de aprovação"
            value={s.quoteApprovalRate === null ? '—' : `${String(Math.round(s.quoteApprovalRate * 100))}%`}
          />
          <StatCard
            label="Tempo médio de reparo"
            value={s.avgRepairTimeHours === null ? '—' : `${(s.avgRepairTimeHours / 24).toFixed(1)} dias`}
            icon={<Timer />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card data-tour="revenue-chart">
          <CardHeader>
            <CardTitle>Receita — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {revenue.isPending && <Skeleton className="h-full w-full" />}
            {revenue.isSuccess && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue.data} margin={{ left: 8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    stroke="var(--text-faint)"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(value: number) => formatCents(value).replace(/,\d+$/, '')}
                    stroke="var(--text-faint)"
                    fontSize={12}
                    width={86}
                  />
                  <Tooltip
                    formatter={(value) => [formatCents(Number(value)), 'Receita']}
                    labelFormatter={(label) => monthLabel(String(label))}
                    contentStyle={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      color: 'var(--text)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenueCents"
                    stroke="var(--color-brand-600)"
                    strokeWidth={2}
                    fill="url(#revenue-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card data-tour="status-donut">
          <CardHeader>
            <CardTitle>OS por status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {byStatus.isPending && <Skeleton className="h-full w-full" />}
            {byStatus.isSuccess && donutData.length === 0 && (
              <p className="pt-10 text-center text-sm text-text-faint">Nenhuma OS ainda.</p>
            )}
            {byStatus.isSuccess && donutData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      String(value),
                      ORDER_STATUS_META[name as keyof typeof ORDER_STATUS_META].label,
                    ]}
                    contentStyle={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      color: 'var(--text)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-tour="attention-table">
        <CardHeader>
          <CardTitle>Atrasadas e urgentes</CardTitle>
        </CardHeader>
        <CardContent>
          {attention.isPending && <Skeleton className="h-24 w-full" />}
          {attention.isSuccess && attentionRows.length === 0 && (
            <p className="text-sm text-text-faint">Nada exigindo atenção. 🎉</p>
          )}
          {attention.isSuccess && attentionRows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attentionRows.map((order) => {
                  const overdue =
                    order.promisedAt !== null &&
                    new Date(order.promisedAt).getTime() < Date.now();
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/orders/${order.id}`} className="hover:underline">
                          {order.code}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customer.name}</TableCell>
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
          )}
        </CardContent>
      </Card>

      {user?.role === Role.ADMIN && (
        <Card data-tour="branches-comparison">
          <CardHeader>
            <CardTitle>Comparativo entre filiais (mês atual)</CardTitle>
          </CardHeader>
          <CardContent>
            {comparison.isPending && <Skeleton className="h-24 w-full" />}
            {comparison.isSuccess && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filial</TableHead>
                    <TableHead className="text-right">Abertas</TableHead>
                    <TableHead className="text-right">Atrasadas</TableHead>
                    <TableHead className="text-right">Entregues</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.data.map((row) => (
                    <TableRow key={row.branchId}>
                      <TableCell className="font-medium">{row.branchName}</TableCell>
                      <TableCell className="text-right">{row.openOrders}</TableCell>
                      <TableCell
                        className={`text-right ${row.overdueOrders > 0 ? 'font-medium text-danger' : ''}`}
                      >
                        {row.overdueOrders}
                      </TableCell>
                      <TableCell className="text-right">{row.deliveredCount}</TableCell>
                      <TableCell className="text-right">{formatCents(row.revenueCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <DashboardContent />
    </Suspense>
  );
}
