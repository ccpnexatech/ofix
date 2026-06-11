'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../design-system';
import {
  customerKeys,
  getCustomer,
  listCustomerOrders,
} from '../../../../features/customers/queries';
import { formatDate } from '../../../../lib/format';

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const customerId = params.id;

  const customer = useQuery({
    queryKey: customerKeys.detail(customerId),
    queryFn: () => getCustomer(customerId),
  });
  const orders = useQuery({
    queryKey: customerKeys.orders(customerId),
    queryFn: () => listCustomerOrders(customerId),
  });

  if (customer.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (customer.isError) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void customer.refetch();
            }}
          >
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const data = customer.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={data.name} description={`Cliente desde ${formatDate(data.createdAt)}`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p data-numeric className="text-text">
              {data.phone}
            </p>
            <p className="text-text-muted">{data.email ?? 'sem e-mail'}</p>
            {data.address && <p className="text-text-muted">{data.address}</p>}
            {data.notes && <p className="mt-2 text-text-faint">{data.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipamentos ({data.equipments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {data.equipments.length === 0 ? (
              <p className="text-sm text-text-faint">Nenhum equipamento cadastrado.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {data.equipments.map((equipment) => (
                  <li key={equipment.id} className="py-1.5">
                    <span className="font-medium text-text">
                      {equipment.type} {equipment.brand} {equipment.model}
                    </span>
                    {equipment.serialNumber && (
                      <span className="font-mono text-xs text-text-faint">
                        {' '}
                        · {equipment.serialNumber}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de OS</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.isPending && <Skeleton className="h-32 w-full" />}
          {orders.isError && (
            <p className="text-sm text-text-faint">Não foi possível carregar o histórico.</p>
          )}
          {orders.isSuccess && orders.data.data.length === 0 && (
            <p className="text-sm text-text-faint">Nenhuma OS para este cliente ainda.</p>
          )}
          {orders.isSuccess && orders.data.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aberta em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.data.data.map((order) => (
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
                    <TableCell>
                      {order.equipment.brand} {order.equipment.model}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-text-muted">
                      {formatDate(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
