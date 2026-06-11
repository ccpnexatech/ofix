import { z } from 'zod';

import { Role } from '../enums';
import { passwordSchema } from './auth';
import { paginationQuerySchema } from './pagination';

export const createUserBodySchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.email('E-mail inválido').toLowerCase(),
  password: passwordSchema,
  role: z.enum(Role),
  branchId: z.uuid().nullable().optional(),
});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(2),
    role: z.enum(Role),
    branchId: z.uuid().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nenhum campo para atualizar');
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

/** PATCH /users/me/tours (spec 009): records a completed/skipped tour. */
export const completeTourBodySchema = z.object({
  tourId: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'tourId inválido'),
});
export type CompleteTourBody = z.infer<typeof completeTourBodySchema>;
