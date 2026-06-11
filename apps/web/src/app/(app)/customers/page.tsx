'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Role, createCustomerBodySchema, type CreateCustomerBody } from '@ofix/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../../../design-system';
import {
  createCustomer,
  customerKeys,
  listCustomers,
} from '../../../features/customers/queries';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { formatDate } from '../../../lib/format';

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const params = new URLSearchParams({ page: String(page), perPage: '20' });
  if (search.trim() !== '') {
    params.set('search', search.trim());
  }
  const queryString = params.toString();

  const customers = useQuery({
    queryKey: customerKeys.list(queryString),
    queryFn: () => listCustomers(queryString),
  });

  const form = useForm<CreateCustomerBody>({
    resolver: zodResolver(createCustomerBodySchema),
    defaultValues: { name: '', phone: '' },
  });

  const create = useMutation({
    mutationFn: (body: CreateCustomerBody) => createCustomer(body),
    onSuccess: (customer) => {
      toast({ title: 'Cliente cadastrado', tone: 'success' });
      setCreateOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      router.push(`/customers/${customer.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível cadastrar',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const canWrite = user?.role !== Role.TECHNICIAN;

  return (
    <div className="flex flex-col gap-4" data-tour="customers-page">
      <PageHeader
        title="Clientes"
        description="Donos dos equipamentos — perfil, aparelhos e histórico de OS."
        actions={
          canWrite && (
            <Button
              data-tour="new-customer"
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden className="h-4 w-4" /> Novo cliente
            </Button>
          )
        }
      />

      <div className="relative max-w-sm" data-tour="customers-search">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-faint"
        />
        <Input
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar por nome, telefone ou e-mail…"
          className="pl-9"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {customers.isPending && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      )}

      {customers.isError && (
        <EmptyState
          title="Não foi possível carregar os clientes"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void customers.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      )}

      {customers.isSuccess && customers.data.data.length === 0 && (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={search !== '' ? 'Tente outra busca.' : 'Cadastre o primeiro cliente.'}
          action={
            canWrite && (
              <Button
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                Novo cliente
              </Button>
            )
          }
        />
      )}

      {customers.isSuccess && customers.data.data.length > 0 && (
        <>
          <Table data-tour="customers-table">
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cliente desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.data.data.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => {
                    router.push(`/customers/${customer.id}`);
                  }}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell data-numeric>{customer.phone}</TableCell>
                  <TableCell className="text-text-muted">{customer.email ?? '—'}</TableCell>
                  <TableCell className="text-text-muted">
                    {formatDate(customer.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span data-numeric>
              {customers.data.meta.total} cliente(s) · página {customers.data.meta.page} de{' '}
              {customers.data.meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((value) => value - 1);
                }}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= customers.data.meta.totalPages}
                onClick={() => {
                  setPage((value) => value + 1);
                }}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>Novo cliente</DialogTitle>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit((body) => {
                create.mutate(body);
              })(event);
            }}
            noValidate
          >
            <FormField label="Nome" htmlFor="c-name" error={form.formState.errors.name?.message}>
              <Input id="c-name" {...form.register('name')} />
            </FormField>
            <FormField
              label="Telefone"
              htmlFor="c-phone"
              error={form.formState.errors.phone?.message}
            >
              <Input id="c-phone" {...form.register('phone')} />
            </FormField>
            <FormField
              label="E-mail (opcional)"
              htmlFor="c-email"
              error={form.formState.errors.email?.message}
            >
              <Input id="c-email" type="email" {...form.register('email')} />
            </FormField>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateOpen(false);
                }}
              >
                Voltar
              </Button>
              <Button type="submit" loading={create.isPending}>
                Cadastrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
