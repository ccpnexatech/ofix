'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Priority,
  createCustomerBodySchema,
  createEquipmentBodySchema,
  type CreateCustomerBody,
  type CreateEquipmentBody,
} from '@ofix/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  DatePicker,
  FormField,
  Input,
  PageHeader,
  PriorityBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
  useToast,
} from '../../../../design-system';
import {
  createCustomer,
  createEquipment,
  customerKeys,
  getCustomer,
  listCustomers,
} from '../../../../features/customers/queries';
import { branchKeys, createOrder, listBranches } from '../../../../features/orders/queries';
import { useAuth } from '../../../../lib/auth';
import { ApiError } from '../../../../lib/api';

const STEPS = ['Cliente', 'Equipamento', 'Detalhes', 'Revisão'] as const;

// Step 3 validation (shared pieces of createOrderBodySchema).
const detailsSchema = z.object({
  reportedIssue: z.string().trim().min(5, 'Descreva o defeito relatado (mínimo 5 caracteres)'),
  priority: z.enum(Priority),
  branchId: z.uuid('Selecione a filial'),
  promisedAt: z.string().optional(),
});
type DetailsForm = z.infer<typeof detailsSchema>;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" data-tour="wizard-steps">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={index === current ? 'step' : undefined}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              index < current && 'bg-success text-white',
              index === current && 'bg-brand-500 text-text-on-brand',
              index > current && 'bg-surface-sunken text-text-faint',
            )}
          >
            {index < current ? <Check aria-hidden className="h-3.5 w-3.5" /> : index + 1}
          </span>
          <span
            className={cn(
              'text-sm',
              index === current ? 'font-medium text-text' : 'text-text-faint',
            )}
          >
            {label}
          </span>
          {index < STEPS.length - 1 && <span aria-hidden className="h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

export default function NewOrderWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState<CreateCustomerBody | null>(null);
  const [equipmentId, setEquipmentId] = useState<string | null>(null);
  const [newEquipment, setNewEquipment] = useState<CreateEquipmentBody | null>(null);
  const [customerSearch] = useState('');

  const customers = useQuery({
    queryKey: customerKeys.list(customerSearch),
    queryFn: () => listCustomers('perPage=100'),
  });
  const branches = useQuery({ queryKey: branchKeys.list, queryFn: listBranches });
  const selectedCustomer = useQuery({
    queryKey: customerKeys.detail(customerId ?? 'none'),
    queryFn: () => getCustomer(customerId ?? ''),
    enabled: customerId !== null,
  });

  const customerForm = useForm<CreateCustomerBody>({
    resolver: zodResolver(createCustomerBodySchema),
    defaultValues: { name: '', phone: '' },
  });
  const equipmentForm = useForm<CreateEquipmentBody>({
    resolver: zodResolver(createEquipmentBodySchema),
    defaultValues: { type: '', brand: '', model: '' },
  });
  const detailsForm = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      reportedIssue: '',
      priority: Priority.NORMAL,
      branchId: user?.branchId ?? '',
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      // Inline creations happen only on final submit (review step is honest).
      let finalCustomerId = customerId;
      if (finalCustomerId === null && newCustomer) {
        finalCustomerId = (await createCustomer(newCustomer)).id;
      }
      if (finalCustomerId === null) {
        throw new Error('Cliente não selecionado');
      }
      let finalEquipmentId = equipmentId;
      if (finalEquipmentId === null && newEquipment) {
        finalEquipmentId = (await createEquipment(finalCustomerId, newEquipment)).id;
      }
      if (finalEquipmentId === null) {
        throw new Error('Equipamento não selecionado');
      }
      const details = detailsForm.getValues();
      return createOrder({
        branchId: details.branchId,
        customerId: finalCustomerId,
        equipmentId: finalEquipmentId,
        reportedIssue: details.reportedIssue,
        priority: details.priority,
        ...(details.promisedAt ? { promisedAt: new Date(details.promisedAt) } : {}),
      });
    },
    onSuccess: (order) => {
      toast({ title: `OS ${order.code} criada`, tone: 'success' });
      router.push(`/orders/${order.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Não foi possível criar a OS',
        description: error instanceof ApiError ? error.message : 'Tente novamente.',
        tone: 'danger',
      });
    },
  });

  async function nextFromCustomer() {
    if (customerId !== null) {
      setNewCustomer(null);
      setStep(1);
      return;
    }
    const valid = await customerForm.trigger();
    if (valid) {
      setNewCustomer(customerForm.getValues());
      setEquipmentId(null);
      setStep(1);
    }
  }

  async function nextFromEquipment() {
    if (equipmentId !== null) {
      setNewEquipment(null);
      setStep(2);
      return;
    }
    const valid = await equipmentForm.trigger();
    if (valid) {
      setNewEquipment(equipmentForm.getValues());
      setStep(2);
    }
  }

  async function nextFromDetails() {
    if (await detailsForm.trigger()) {
      setStep(3);
    }
  }

  const details = detailsForm.getValues();
  const customerLabel =
    newCustomer?.name ??
    customers.data?.data.find((c) => c.id === customerId)?.name ??
    '—';
  const equipmentLabel = newEquipment
    ? `${newEquipment.type} ${newEquipment.brand} ${newEquipment.model}`
    : (() => {
        const eq = selectedCustomer.data?.equipments.find((e) => e.id === equipmentId);
        return eq ? `${eq.type} ${eq.brand} ${eq.model}` : '—';
      })();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5" data-tour="order-wizard">
      <PageHeader title="Nova ordem de serviço" description="Quatro passos e a OS está na fila." />
      <Stepper current={step} />

      {step === 0 && (
        <Card data-tour="wizard-card">
          <CardHeader>
            <CardTitle>Quem é o cliente?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Buscar cliente existente" htmlFor="wizard-customer">
              <Combobox
                id="wizard-customer"
                value={customerId}
                onChange={(value) => {
                  setCustomerId(value);
                  setEquipmentId(null);
                }}
                placeholder="Buscar por nome…"
                options={(customers.data?.data ?? []).map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                  description: customer.phone,
                }))}
              />
            </FormField>
            <div className="flex items-center gap-3 text-xs text-text-faint">
              <span className="h-px flex-1 bg-border" /> ou cadastre agora{' '}
              <span className="h-px flex-1 bg-border" />
            </div>
            <fieldset
              disabled={customerId !== null}
              className="grid grid-cols-1 gap-3 disabled:opacity-50 sm:grid-cols-2"
            >
              <FormField
                label="Nome"
                htmlFor="nc-name"
                error={customerForm.formState.errors.name?.message}
              >
                <Input id="nc-name" {...customerForm.register('name')} />
              </FormField>
              <FormField
                label="Telefone"
                htmlFor="nc-phone"
                error={customerForm.formState.errors.phone?.message}
              >
                <Input id="nc-phone" {...customerForm.register('phone')} />
              </FormField>
              <FormField
                label="E-mail (opcional)"
                htmlFor="nc-email"
                error={customerForm.formState.errors.email?.message}
                className="sm:col-span-2"
              >
                <Input id="nc-email" type="email" {...customerForm.register('email')} />
              </FormField>
            </fieldset>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  void nextFromCustomer();
                }}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Qual equipamento?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {customerId !== null && (selectedCustomer.data?.equipments.length ?? 0) > 0 && (
              <FormField label="Equipamentos do cliente" htmlFor="wizard-equipment">
                <Combobox
                  id="wizard-equipment"
                  value={equipmentId}
                  onChange={setEquipmentId}
                  placeholder="Selecionar equipamento…"
                  options={(selectedCustomer.data?.equipments ?? []).map((equipment) => ({
                    value: equipment.id,
                    label: `${equipment.type} ${equipment.brand} ${equipment.model}`,
                    description: equipment.serialNumber ?? undefined,
                  }))}
                />
              </FormField>
            )}
            <div className="flex items-center gap-3 text-xs text-text-faint">
              <span className="h-px flex-1 bg-border" /> ou cadastre um novo{' '}
              <span className="h-px flex-1 bg-border" />
            </div>
            <fieldset
              disabled={equipmentId !== null}
              className="grid grid-cols-1 gap-3 disabled:opacity-50 sm:grid-cols-3"
            >
              <FormField
                label="Tipo"
                htmlFor="ne-type"
                error={equipmentForm.formState.errors.type?.message}
              >
                <Input id="ne-type" placeholder="Notebook" {...equipmentForm.register('type')} />
              </FormField>
              <FormField
                label="Marca"
                htmlFor="ne-brand"
                error={equipmentForm.formState.errors.brand?.message}
              >
                <Input id="ne-brand" placeholder="Dell" {...equipmentForm.register('brand')} />
              </FormField>
              <FormField
                label="Modelo"
                htmlFor="ne-model"
                error={equipmentForm.formState.errors.model?.message}
              >
                <Input
                  id="ne-model"
                  placeholder="Inspiron 15"
                  {...equipmentForm.register('model')}
                />
              </FormField>
              <FormField
                label="Nº de série (opcional)"
                htmlFor="ne-serial"
                className="sm:col-span-3"
              >
                <Input id="ne-serial" {...equipmentForm.register('serialNumber')} />
              </FormField>
            </fieldset>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep(0);
                }}
              >
                Voltar
              </Button>
              <Button
                onClick={() => {
                  void nextFromEquipment();
                }}
              >
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do atendimento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              label="Defeito relatado"
              htmlFor="d-issue"
              error={detailsForm.formState.errors.reportedIssue?.message}
            >
              <Textarea
                id="d-issue"
                placeholder="Ex.: não liga após queda de energia"
                {...detailsForm.register('reportedIssue')}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField
                label="Prioridade"
                htmlFor="d-priority"
                error={detailsForm.formState.errors.priority?.message}
              >
                <Select
                  value={detailsForm.watch('priority')}
                  onValueChange={(value) => {
                    detailsForm.setValue('priority', value as Priority);
                  }}
                >
                  <SelectTrigger id="d-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Priority).map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority === 'LOW' && 'Baixa'}
                        {priority === 'NORMAL' && 'Normal'}
                        {priority === 'HIGH' && 'Alta'}
                        {priority === 'URGENT' && 'Urgente'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Filial"
                htmlFor="d-branch"
                error={detailsForm.formState.errors.branchId?.message}
              >
                <Select
                  value={detailsForm.watch('branchId')}
                  onValueChange={(value) => {
                    detailsForm.setValue('branchId', value, { shouldValidate: true });
                  }}
                  disabled={user?.branchId != null} // RN-12
                >
                  <SelectTrigger id="d-branch">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches.data ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Prazo prometido (opcional)" htmlFor="d-promised">
                <DatePicker id="d-promised" {...detailsForm.register('promisedAt')} />
              </FormField>
            </div>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep(1);
                }}
              >
                Voltar
              </Button>
              <Button
                onClick={() => {
                  void nextFromDetails();
                }}
              >
                Revisar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Confira antes de criar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-text-faint">Cliente</dt>
                <dd className="font-medium text-text">
                  {customerLabel}
                  {newCustomer && ' (novo)'}
                </dd>
              </div>
              <div>
                <dt className="text-text-faint">Equipamento</dt>
                <dd className="font-medium text-text">
                  {equipmentLabel}
                  {newEquipment && ' (novo)'}
                </dd>
              </div>
              <div>
                <dt className="text-text-faint">Filial</dt>
                <dd className="font-medium text-text">
                  {branches.data?.find((b) => b.id === details.branchId)?.name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-text-faint">Prioridade</dt>
                <dd>
                  <PriorityBadge priority={details.priority} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-text-faint">Defeito relatado</dt>
                <dd className="text-text">{details.reportedIssue}</dd>
              </div>
              {details.promisedAt && (
                <div>
                  <dt className="text-text-faint">Prazo prometido</dt>
                  <dd className="text-text">
                    {new Date(details.promisedAt).toLocaleDateString('pt-BR')}
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep(2);
                }}
              >
                Voltar
              </Button>
              <Button
                loading={submit.isPending}
                onClick={() => {
                  submit.mutate();
                }}
              >
                Criar OS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
