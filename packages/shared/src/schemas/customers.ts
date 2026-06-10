import { z } from 'zod';

import { paginationQuerySchema } from './pagination';

export const createCustomerBodySchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  phone: z.string().trim().min(8, 'Telefone inválido'),
  email: z.email('E-mail inválido').toLowerCase().optional(),
  document: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CreateCustomerBody = z.infer<typeof createCustomerBodySchema>;

export const updateCustomerBodySchema = createCustomerBodySchema.partial();
export type UpdateCustomerBody = z.infer<typeof updateCustomerBodySchema>;

export const listCustomersQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export const createEquipmentBodySchema = z.object({
  type: z.string().trim().min(2, 'Tipo deve ter no mínimo 2 caracteres'),
  brand: z.string().trim().min(1, 'Marca é obrigatória'),
  model: z.string().trim().min(1, 'Modelo é obrigatório'),
  serialNumber: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
export type CreateEquipmentBody = z.infer<typeof createEquipmentBodySchema>;

export const updateEquipmentBodySchema = createEquipmentBodySchema.partial();
export type UpdateEquipmentBody = z.infer<typeof updateEquipmentBodySchema>;
