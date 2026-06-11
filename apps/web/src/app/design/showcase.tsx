'use client';

import { OrderStatus, Priority } from '@ofix/shared';
import { ClipboardList, LayoutDashboard, MapPin, Users, Wrench } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  FormField,
  Input,
  Logo,
  PageHeader,
  PriorityBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sidebar,
  SidebarItem,
  Skeleton,
  StatCard,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemeToggle,
  Timeline,
  ToastProvider,
  useToast,
} from '../../design-system';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        onClick={() => {
          toast({ title: 'OS criada com sucesso', tone: 'success' });
        }}
      >
        Toast de sucesso
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          toast({ title: 'Falha ao salvar', description: 'Tente novamente.', tone: 'danger' });
        }}
      >
        Toast de erro
      </Button>
    </div>
  );
}

export function DesignShowcase() {
  const [customer, setCustomer] = useState<string | null>(null);

  return (
    <ToastProvider>
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <PageHeader
          title="Design system OFIX"
          description="Homologação visual — todos os componentes nos 2 temas."
          actions={<ThemeToggle />}
        />

        <Section title="Logo">
          <div className="flex items-center gap-6 text-text">
            <Logo />
            <Logo variant="icon" />
          </div>
        </Section>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Salvando</Button>
            <Button size="sm" variant="secondary">
              Pequeno
            </Button>
            <Button size="lg">Grande</Button>
            <Button disabled>Desabilitado</Button>
          </div>
        </Section>

        <Section title="Badges de status e prioridade">
          <div className="flex flex-wrap gap-2">
            {Object.values(OrderStatus).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.values(Priority).map((priority) => (
              <PriorityBadge key={priority} priority={priority} />
            ))}
            <Badge tone="brand">brand</Badge>
            <Badge tone="info">info</Badge>
            <Badge>neutral</Badge>
          </div>
        </Section>

        <Section title="Formulário">
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Nome do cliente" htmlFor="ds-name" hint="Como aparece na OS">
              <Input id="ds-name" placeholder="Maria Silva" />
            </FormField>
            <FormField label="Telefone" htmlFor="ds-phone" error="Telefone inválido">
              <Input id="ds-phone" invalid defaultValue="123" />
            </FormField>
            <FormField label="Prioridade" htmlFor="ds-priority">
              <Select defaultValue="NORMAL">
                <SelectTrigger id="ds-priority">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Cliente (combobox)" htmlFor="ds-customer">
              <Combobox
                id="ds-customer"
                value={customer}
                onChange={setCustomer}
                placeholder="Buscar cliente…"
                options={[
                  { value: '1', label: 'Maria Silva', description: '(85) 98888-7777' },
                  { value: '2', label: 'João Santos', description: '(85) 97777-1111' },
                  { value: '3', label: 'Zuleide Almeida', description: '(81) 96666-2222' },
                ]}
              />
            </FormField>
            <FormField label="Prazo prometido" htmlFor="ds-date">
              <DatePicker id="ds-date" />
            </FormField>
            <FormField label="Diagnóstico técnico" htmlFor="ds-diag" className="sm:col-span-2">
              <Textarea id="ds-diag" placeholder="Descreva o diagnóstico…" />
            </FormField>
          </div>
        </Section>

        <Section title="StatCard">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="OS abertas" value="38" icon={<ClipboardList />} />
            <StatCard
              label="Receita do mês"
              value="R$ 12.450,00"
              delta={{ value: '+12% vs. mês anterior', trend: 'up' }}
            />
            <StatCard
              label="Tempo médio de reparo"
              value="3,4 dias"
              delta={{ value: '-8%', trend: 'down' }}
            />
            <StatCard label="Atrasadas" value="2" icon={<Wrench />} />
          </div>
        </Section>

        <Section title="Table (densa, header sticky)">
          <div className="max-h-56">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    { code: 'OS-2026-0001', name: 'Maria Silva', status: OrderStatus.APPROVED, total: 'R$ 350,00' },
                    { code: 'OS-2026-0002', name: 'João Santos', status: OrderStatus.IN_REPAIR, total: 'R$ 1.234,50' },
                    { code: 'OS-2026-0003', name: 'Zuleide Almeida', status: OrderStatus.QUOTE_SENT, total: 'R$ 89,90' },
                    { code: 'OS-2026-0004', name: 'Carlos Pereira', status: OrderStatus.DELIVERED, total: 'R$ 2.150,00' },
                  ] as const
                ).map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section title="Dialog · Dropdown · Toast · Tabs">
          <div className="flex flex-wrap items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Abrir dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Cancelar OS-2026-0002?</DialogTitle>
                <DialogDescription>
                  Esta ação é definitiva e exige um motivo com no mínimo 10 caracteres.
                </DialogDescription>
                <DialogFooter>
                  <Button variant="ghost">Voltar</Button>
                  <Button variant="danger">Cancelar OS</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Ações</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>OS-2026-0002</DropdownMenuLabel>
                <DropdownMenuItem>Atribuir técnico</DropdownMenuItem>
                <DropdownMenuItem>Editar prioridade</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>Cancelar OS</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ToastDemo />
          </div>

          <Tabs defaultValue="detalhes" className="max-w-md">
            <TabsList>
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="detalhes" className="text-sm text-text-muted">
              Conteúdo da aba de detalhes.
            </TabsContent>
            <TabsContent value="orcamento" className="text-sm text-text-muted">
              Conteúdo da aba de orçamento.
            </TabsContent>
            <TabsContent value="historico" className="text-sm text-text-muted">
              Conteúdo da aba de histórico.
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Timeline · Skeleton · EmptyState · Card">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Linha do tempo da OS</CardTitle>
                <CardDescription>Trilha de auditoria (ADR-004)</CardDescription>
              </CardHeader>
              <CardContent>
                <Timeline
                  items={[
                    { id: '1', title: 'OS criada', timestamp: '10/06 09:12' },
                    {
                      id: '2',
                      title: 'Técnico atribuído',
                      description: 'Carlos Lima',
                      timestamp: '10/06 09:40',
                    },
                    {
                      id: '3',
                      title: 'Orçamento aprovado pelo cliente',
                      description: 'Via link público',
                      timestamp: '11/06 14:02',
                    },
                  ]}
                />
              </CardContent>
            </Card>
            <div className="flex flex-col gap-4">
              <Card className="p-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </Card>
              <EmptyState
                title="Nenhuma OS por aqui"
                description="Crie a primeira ordem de serviço para começar."
                action={<Button size="sm">Nova OS</Button>}
              />
            </div>
          </div>
        </Section>

        <Section title="Sidebar">
          <div className="h-72 overflow-hidden rounded-lg border border-border">
            <Sidebar footer={<ThemeToggle />}>
              <SidebarItem icon={<LayoutDashboard />} label="Dashboard" href="#" active />
              <SidebarItem icon={<ClipboardList />} label="Ordens de serviço" href="#" />
              <SidebarItem icon={<Users />} label="Clientes" href="#" />
              <SidebarItem icon={<MapPin />} label="Filiais" href="#" />
            </Sidebar>
          </div>
        </Section>
      </div>
    </ToastProvider>
  );
}
