import { Injectable } from '@nestjs/common';
import { OrderStatus, Priority, Role } from '@ofix/shared';
import type Anthropic from '@anthropic-ai/sdk';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../../common/authenticated-user';
import { branchScopeWhere } from '../../common/branch-scope';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ORDER_LIST_INCLUDE } from '../orders/orders.repository';

/**
 * Read-only tools of the Fia assistant (spec 010). Every query runs through
 * the tenant-scoped client and mirrors the RN-12/RN-14 scoping rules — the
 * model can never see another tenant, branch or technician's data.
 */

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_order_by_code',
    description:
      'Busca uma ordem de serviço pelo código (ex.: OS-2026-0042). Retorna status, cliente, equipamento, técnico e prazos.',
    input_schema: {
      type: 'object',
      properties: { code: { type: 'string', description: 'Código completo da OS' } },
      required: ['code'],
    },
  },
  {
    name: 'search_orders',
    description: 'Lista resumida de OS filtrando por status e/ou prioridade (máx. 10).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(OrderStatus) },
        priority: { type: 'string', enum: Object.values(Priority) },
      },
    },
  },
  {
    name: 'search_customer',
    description: 'Busca clientes pelo nome e devolve contato e últimas OS de cada um.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'get_dashboard_summary',
    description:
      'Métricas do período atual: OS abertas, atrasadas, receita, ticket médio, taxa de aprovação e tempo médio de reparo.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_overdue_orders',
    description: 'OS com prazo prometido vencido e ainda em andamento.',
    input_schema: { type: 'object', properties: {} },
  },
];

const TERMINAL: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELED];

@Injectable()
export class AssistantToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Mirrors the dashboard scope: branch pin + technician sees only their own. */
  private scope(user: AuthenticatedUser): Prisma.ServiceOrderWhereInput {
    const where: Prisma.ServiceOrderWhereInput = { ...branchScopeWhere(user) };
    if (user.role === Role.TECHNICIAN) {
      where.assignedTechnicianId = user.id;
    }
    return where;
  }

  private orderSummary(order: {
    code: string;
    status: string;
    priority: string;
    promisedAt: Date | null;
    customer: { name: string };
    equipment: { type: string; brand: string; model: string };
    branch: { name: string };
    assignedTechnician: { name: string } | null;
  }) {
    return {
      code: order.code,
      status: order.status,
      prioridade: order.priority,
      cliente: order.customer.name,
      equipamento: `${order.equipment.type} ${order.equipment.brand} ${order.equipment.model}`,
      filial: order.branch.name,
      tecnico: order.assignedTechnician?.name ?? null,
      prazo: order.promisedAt?.toISOString().slice(0, 10) ?? null,
    };
  }

  async execute(name: string, input: Record<string, unknown>, user: AuthenticatedUser): Promise<string> {
    const str = (value: unknown): string => (typeof value === 'string' ? value : '');
    try {
      switch (name) {
        case 'get_order_by_code': {
          const order = await this.prisma.client.serviceOrder.findFirst({
            where: { ...this.scope(user), code: str(input.code).toUpperCase() },
            include: ORDER_LIST_INCLUDE,
          });
          return order
            ? JSON.stringify(this.orderSummary(order))
            : 'Nenhuma OS encontrada com esse código (no seu escopo de acesso).';
        }
        case 'search_orders': {
          const where: Prisma.ServiceOrderWhereInput = { ...this.scope(user) };
          if (typeof input.status === 'string') {
            where.status = input.status as OrderStatus;
          }
          if (typeof input.priority === 'string') {
            where.priority = input.priority as Priority;
          }
          const orders = await this.prisma.client.serviceOrder.findMany({
            where,
            include: ORDER_LIST_INCLUDE,
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          return JSON.stringify(orders.map((order) => this.orderSummary(order)));
        }
        case 'search_customer': {
          const customers = await this.prisma.client.customer.findMany({
            where: { name: { contains: str(input.name), mode: 'insensitive' } },
            take: 3,
            include: {
              orders: {
                where: this.scope(user),
                orderBy: { createdAt: 'desc' },
                take: 3,
                select: { code: true, status: true },
              },
            },
          });
          return JSON.stringify(
            customers.map((customer) => ({
              nome: customer.name,
              telefone: customer.phone,
              email: customer.email,
              ultimasOS: customer.orders,
            })),
          );
        }
        case 'get_dashboard_summary': {
          const summary = await this.dashboard.summary(user, {});
          return JSON.stringify(summary);
        }
        case 'get_overdue_orders': {
          const orders = await this.prisma.client.serviceOrder.findMany({
            where: {
              ...this.scope(user),
              status: { notIn: TERMINAL },
              promisedAt: { lt: new Date() },
            },
            include: ORDER_LIST_INCLUDE,
            orderBy: { promisedAt: 'asc' },
            take: 10,
          });
          return JSON.stringify(orders.map((order) => this.orderSummary(order)));
        }
        default:
          return `Ferramenta desconhecida: ${name}`;
      }
    } catch {
      // Never leak stack traces into the conversation (spec 010).
      return 'Não consegui consultar esse dado agora. Tente novamente.';
    }
  }
}
