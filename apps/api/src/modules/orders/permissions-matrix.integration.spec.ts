import type { INestApplication } from '@nestjs/common';
import { OrderAction, OrderStatus, QuoteStatus, Role } from '@ofix/shared';
import type { App } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { asUser } from '../../../test/api';
import { createTestApp } from '../../../test/app';
import {
  createBranch,
  createCustomer,
  createEquipment,
  createOrder,
  createQuote,
  createTenant,
  createUser,
} from '../../../test/factories';

/**
 * Spec 004 permission matrix, tested as a table. Each row: action, role,
 * whether the actor is the assigned technician, expected allowance.
 * "allowed: true" means anything but 401/403 (the action may still 422).
 */
const MATRIX: {
  scenario: string;
  role: Role;
  own?: boolean;
  allowed: boolean;
}[] = [
  // Criar OS / cliente / equipamento
  { scenario: 'create-order', role: Role.ADMIN, allowed: true },
  { scenario: 'create-order', role: Role.TECHNICIAN, allowed: false },
  { scenario: 'create-order', role: Role.ATTENDANT, allowed: true },
  { scenario: 'create-customer', role: Role.ADMIN, allowed: true },
  { scenario: 'create-customer', role: Role.TECHNICIAN, allowed: false },
  { scenario: 'create-customer', role: Role.ATTENDANT, allowed: true },
  // Atribuir técnico
  { scenario: 'assign', role: Role.ADMIN, allowed: true },
  { scenario: 'assign', role: Role.TECHNICIAN, allowed: false },
  { scenario: 'assign', role: Role.ATTENDANT, allowed: true },
  // START_DIAGNOSIS / quote / START_REPAIR / MARK_READY (technician: own only)
  { scenario: 'transition:START_DIAGNOSIS', role: Role.ADMIN, allowed: true },
  { scenario: 'transition:START_DIAGNOSIS', role: Role.TECHNICIAN, own: true, allowed: true },
  { scenario: 'transition:START_DIAGNOSIS', role: Role.TECHNICIAN, own: false, allowed: false },
  { scenario: 'transition:START_DIAGNOSIS', role: Role.ATTENDANT, allowed: false },
  { scenario: 'transition:START_REPAIR', role: Role.TECHNICIAN, own: true, allowed: true },
  { scenario: 'transition:START_REPAIR', role: Role.ATTENDANT, allowed: false },
  { scenario: 'transition:MARK_READY', role: Role.TECHNICIAN, own: true, allowed: true },
  { scenario: 'transition:MARK_READY', role: Role.ATTENDANT, allowed: false },
  // APPROVE/REJECT presencial
  { scenario: 'transition:APPROVE_QUOTE', role: Role.ADMIN, allowed: true },
  { scenario: 'transition:APPROVE_QUOTE', role: Role.TECHNICIAN, own: true, allowed: false },
  { scenario: 'transition:APPROVE_QUOTE', role: Role.ATTENDANT, allowed: false },
  // DELIVER
  { scenario: 'transition:DELIVER', role: Role.ADMIN, allowed: true },
  { scenario: 'transition:DELIVER', role: Role.TECHNICIAN, own: true, allowed: false },
  { scenario: 'transition:DELIVER', role: Role.ATTENDANT, allowed: true },
  // CANCEL
  { scenario: 'transition:CANCEL', role: Role.ADMIN, allowed: true },
  { scenario: 'transition:CANCEL', role: Role.TECHNICIAN, own: true, allowed: false },
  { scenario: 'transition:CANCEL', role: Role.ATTENDANT, allowed: false },
  // REOPEN_WARRANTY
  { scenario: 'warranty-reopen', role: Role.ADMIN, allowed: true },
  { scenario: 'warranty-reopen', role: Role.TECHNICIAN, allowed: false },
  { scenario: 'warranty-reopen', role: Role.ATTENDANT, allowed: true },
  // Gerenciar usuários do tenant
  { scenario: 'manage-users', role: Role.ADMIN, allowed: true },
  { scenario: 'manage-users', role: Role.TECHNICIAN, allowed: false },
  { scenario: 'manage-users', role: Role.ATTENDANT, allowed: false },
];

const STATUS_FOR_ACTION: Record<string, OrderStatus> = {
  START_DIAGNOSIS: OrderStatus.RECEIVED,
  START_REPAIR: OrderStatus.APPROVED,
  MARK_READY: OrderStatus.IN_REPAIR,
  APPROVE_QUOTE: OrderStatus.QUOTE_SENT,
  DELIVER: OrderStatus.READY,
  CANCEL: OrderStatus.RECEIVED,
};

describe('permission matrix (spec 004, tabular)', () => {
  let app: INestApplication<App>;
  let tenantId: string;
  let branchId: string;
  let adminId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const tenant = await createTenant();
    tenantId = tenant.id;
    branchId = (await createBranch(tenantId)).id;
    adminId = (await createUser({ tenantId, role: Role.ADMIN })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(MATRIX)(
    'matrix: $scenario as $role (own=$own) -> allowed=$allowed',
    async ({ scenario, role, own, allowed }) => {
      const actor = await createUser({ tenantId, role });

      let status: number;
      if (scenario === 'create-order') {
        const customer = await createCustomer(tenantId);
        const equipment = await createEquipment(tenantId, customer.id);
        const response = await asUser(app, actor).post('/orders', {
          branchId,
          customerId: customer.id,
          equipmentId: equipment.id,
          reportedIssue: 'Teste da matriz de permissões',
        });
        status = response.status;
      } else if (scenario === 'create-customer') {
        const response = await asUser(app, actor).post('/customers', {
          name: 'Cliente Matriz',
          phone: '85 90000-0000',
        });
        status = response.status;
      } else if (scenario === 'assign') {
        const order = await createOrder({ tenantId, branchId, createdById: adminId });
        const technician = await createUser({ tenantId, role: Role.TECHNICIAN, branchId });
        const response = await asUser(app, actor).post(`/orders/${order.id}/assign`, {
          technicianId: technician.id,
        });
        status = response.status;
      } else if (scenario === 'warranty-reopen') {
        const order = await createOrder({
          tenantId,
          branchId,
          createdById: adminId,
          status: OrderStatus.DELIVERED,
          warrantyUntil: new Date(Date.now() + 86_400_000),
        });
        const response = await asUser(app, actor).post(
          `/orders/${order.id}/warranty-reopen`,
          {},
        );
        status = response.status;
      } else if (scenario === 'manage-users') {
        // Management = create/update (listing is also open to ATTENDANT for
        // the assign-technician flow).
        const response = await asUser(app, actor).post('/users', {
          name: 'Matriz User',
          email: `matriz-${actor.id.slice(0, 8)}@test.dev`,
          password: 'senha-segura-1',
          role: Role.ATTENDANT,
        });
        status = response.status;
      } else {
        const action = scenario.split(':')[1] as OrderAction;
        const order = await createOrder({
          tenantId,
          branchId,
          createdById: adminId,
          status: STATUS_FOR_ACTION[action],
          assignedTechnicianId: own === false ? adminId : actor.id,
          technicalDiagnosis: 'Diagnóstico longo o suficiente para a RN-03.',
        });
        if (action === OrderAction.APPROVE_QUOTE) {
          await createQuote({
            tenantId,
            serviceOrderId: order.id,
            status: QuoteStatus.SENT,
          });
        }
        const response = await asUser(app, actor).post(`/orders/${order.id}/transitions`, {
          action,
          payload: { reason: 'motivo suficientemente longo para regras' },
        });
        status = response.status;
      }

      if (allowed) {
        expect(status).not.toBe(403);
        expect(status).not.toBe(401);
      } else {
        expect(status).toBe(403);
      }
    },
  );
});
