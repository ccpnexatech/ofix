import { z } from 'zod';

import { OrderStatus, Priority } from '../enums';
import { OrderAction } from '../order-state-machine';
import { paginationQuerySchema } from './pagination';

export const createOrderBodySchema = z.object({
  branchId: z.uuid(),
  customerId: z.uuid(),
  equipmentId: z.uuid(),
  reportedIssue: z.string().trim().min(5, 'Descreva o defeito relatado (mínimo 5 caracteres)'),
  priority: z.enum(Priority).default(Priority.NORMAL),
  promisedAt: z.coerce.date().optional(),
});
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;

/** Editable fields; which ones apply in each status is enforced by the service. */
export const updateOrderBodySchema = z
  .object({
    reportedIssue: z.string().trim().min(5),
    technicalDiagnosis: z.string().trim().min(1).nullable(),
    priority: z.enum(Priority),
    promisedAt: z.coerce.date().nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nenhum campo para atualizar');
export type UpdateOrderBody = z.infer<typeof updateOrderBodySchema>;

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(OrderStatus).optional(),
  branchId: z.uuid().optional(),
  technicianId: z.uuid().optional(),
  priority: z.enum(Priority).optional(),
  /** Searches order code, customer name and equipment brand/model (spec 005). */
  search: z.string().trim().min(1).optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const assignTechnicianBodySchema = z.object({
  technicianId: z.uuid(),
});
export type AssignTechnicianBody = z.infer<typeof assignTechnicianBodySchema>;

/**
 * Single transition endpoint (ADR-006). Payload contents per action (reason
 * minimums etc.) are validated by the state machine preconditions, so the
 * error carries the RN code.
 */
export const transitionBodySchema = z.object({
  action: z.enum(OrderAction),
  payload: z
    .object({
      reason: z.string().trim().optional(),
    })
    .optional(),
});
export type TransitionBody = z.infer<typeof transitionBodySchema>;
