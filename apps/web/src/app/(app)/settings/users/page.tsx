'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Role, createUserBodySchema, type CreateUserBody } from '@ofix/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '../../../../design-system';
import { branchKeys, listBranches } from '../../../../features/orders/queries';
import { ApiError, apiFetch } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  ATTENDANT: 'Atendente',
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  isActive: boolean;
  branch: { id: string; name: string } | null;
}

export default function UsersSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const users = useQuery({
    queryKey: ['users', 'settings'],
    queryFn: () => apiFetch<{ data: UserRow[] }>('/users?perPage=100'),
  });
  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });

  const form = useForm<CreateUserBody>({
    resolver: zodResolver(createUserBodySchema),
    defaultValues: { name: '', email: '', password: '', role: Role.ATTENDANT, branchId: null },
  });

  // RolesGuard already protects the API; this is just polite UX for non-admins.
  useEffect(() => {
    if (me && me.role !== Role.ADMIN) {
      window.location.replace('/orders');
    }
  }, [me]);

  const create = useMutation({
    mutationFn: (body: CreateUserBody) =>
      apiFetch<UserRow>('/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: 'Usuário criado', tone: 'success' });
      setCreateOpen(false);
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível criar',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (target: UserRow) =>
      apiFetch<UserRow>(`/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !target.isActive }),
      }),
    onSuccess: (updated) => {
      toast({
        title: updated.isActive ? 'Usuário reativado' : 'Usuário desativado',
        tone: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => {
      toast({ title: 'Não foi possível atualizar', tone: 'danger' });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Usuários"
        description="Equipe do tenant — papéis e escopo de filial (RN-12)."
        actions={
          <Button
            onClick={() => {
              setCreateOpen(true);
            }}
          >
            <Plus aria-hidden className="h-4 w-4" /> Novo usuário
          </Button>
        }
      />

      {users.isPending && <Skeleton className="h-48 w-full" />}
      {users.isError && (
        <EmptyState
          title="Não foi possível carregar os usuários"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void users.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      )}
      {users.isSuccess && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.data.data.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-text-muted">{row.email}</TableCell>
                <TableCell>{ROLE_LABELS[row.role]}</TableCell>
                <TableCell className="text-text-muted">
                  {row.branch?.name ?? 'Todas as filiais'}
                </TableCell>
                <TableCell>
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? 'ativo' : 'inativo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.id !== me?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        toggleActive.mutate(row);
                      }}
                    >
                      {row.isActive ? 'Desativar' : 'Reativar'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogTitle>Novo usuário</DialogTitle>
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
            <FormField label="Nome" htmlFor="u-name" error={form.formState.errors.name?.message}>
              <Input id="u-name" {...form.register('name')} />
            </FormField>
            <FormField
              label="E-mail"
              htmlFor="u-email"
              error={form.formState.errors.email?.message}
            >
              <Input id="u-email" type="email" {...form.register('email')} />
            </FormField>
            <FormField
              label="Senha inicial"
              htmlFor="u-password"
              hint="Mínimo 8 caracteres"
              error={form.formState.errors.password?.message}
            >
              <Input id="u-password" type="password" {...form.register('password')} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Papel" htmlFor="u-role">
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) => {
                    form.setValue('role', value as Role);
                  }}
                >
                  <SelectTrigger id="u-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Role).map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Filial (vazio = todas)" htmlFor="u-branch">
                <Select
                  value={form.watch('branchId') ?? 'ALL'}
                  onValueChange={(value) => {
                    form.setValue('branchId', value === 'ALL' ? null : value);
                  }}
                >
                  <SelectTrigger id="u-branch">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as filiais</SelectItem>
                    {(branches.data ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
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
                Criar usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
