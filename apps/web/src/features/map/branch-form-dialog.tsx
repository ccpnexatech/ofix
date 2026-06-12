'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createBranchBodySchema,
  type BranchSummary,
  type CreateBranchBody,
  type CreateBranchFormInput,
} from '@ofix/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  FormField,
  Input,
  useToast,
} from '../../design-system';
import { branchKeys } from '../orders/queries';
import { ApiError, apiFetch } from '../../lib/api';

function toFormValues(branch: BranchSummary | null): CreateBranchFormInput {
  return {
    name: branch?.name ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    state: branch?.state ?? '',
    phone: branch?.phone ?? '',
    zipCode: branch?.zipCode ?? '',
    latitude: branch?.latitude ?? '',
    longitude: branch?.longitude ?? '',
  };
}

/** Create/edit branch dialog (ADR-013) — ADMIN-only, mirrors the users page. */
export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: BranchSummary | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = branch !== null;

  // Input type ≠ output type: the form holds strings, the schema emits the
  // API body (''→null, numeric strings→number) — hence the three generics.
  const form = useForm<CreateBranchFormInput, unknown, CreateBranchBody>({
    resolver: zodResolver(createBranchBodySchema),
    defaultValues: toFormValues(branch),
  });

  // Reopening for another branch (or for creation) starts from its values.
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(branch));
    }
  }, [open, branch, form]);

  const save = useMutation({
    mutationFn: (body: CreateBranchBody) =>
      isEdit
        ? apiFetch<BranchSummary>(`/branches/${branch.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : apiFetch<BranchSummary>('/branches', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: isEdit ? 'Filial atualizada' : 'Filial criada', tone: 'success' });
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: branchKeys.list });
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível salvar',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'danger',
      });
    },
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{isEdit ? 'Editar filial' : 'Nova filial'}</DialogTitle>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit((body) => {
              save.mutate(body);
            })(event);
          }}
          noValidate
        >
          <FormField label="Nome" htmlFor="b-name" error={errors.name?.message}>
            <Input id="b-name" {...form.register('name')} />
          </FormField>
          <FormField label="Endereço" htmlFor="b-address" error={errors.address?.message}>
            <Input id="b-address" {...form.register('address')} />
          </FormField>
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <FormField label="Cidade" htmlFor="b-city" error={errors.city?.message}>
              <Input id="b-city" {...form.register('city')} />
            </FormField>
            <FormField label="UF" htmlFor="b-state" error={errors.state?.message}>
              <Input id="b-state" maxLength={2} {...form.register('state')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Telefone (opcional)" htmlFor="b-phone" error={errors.phone?.message}>
              <Input id="b-phone" {...form.register('phone')} />
            </FormField>
            <FormField label="CEP (opcional)" htmlFor="b-zip" error={errors.zipCode?.message}>
              <Input id="b-zip" {...form.register('zipCode')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Latitude" htmlFor="b-lat" error={errors.latitude?.message}>
              <Input id="b-lat" type="number" step="any" {...form.register('latitude')} />
            </FormField>
            <FormField label="Longitude" htmlFor="b-lng" error={errors.longitude?.message}>
              <Input id="b-lng" type="number" step="any" {...form.register('longitude')} />
            </FormField>
          </div>
          <p className="text-xs text-text-faint">
            Sem latitude/longitude a filial não aparece no mapa — só na lista.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Voltar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {isEdit ? 'Salvar alterações' : 'Criar filial'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
