import { z } from 'zod';

// GET /branches (spec 005): active branches of the tenant, for selectors and
// the internal map. Coordinates are serialized as strings (Prisma Decimal).
export const branchSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string().nullable(),
  latitude: z.string().nullable(),
  longitude: z.string().nullable(),
});
export type BranchSummary = z.infer<typeof branchSummarySchema>;

export const listBranchesResponseSchema = z.array(branchSummarySchema);
export type ListBranchesResponse = z.infer<typeof listBranchesResponseSchema>;

// POST/PATCH /branches (ADR-013): branch create/edit is ADMIN self-service.
// The same schema validates the web form, so optional inputs arrive as ''.

/** Forms send '' for empty optional fields; the API contract is null. */
const emptyToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/** Accepts number (API) or numeric string (form input); '' never becomes 0. */
const coordinateSchema = (kind: 'latitude' | 'longitude') => {
  const limit = kind === 'latitude' ? 90 : 180;
  return z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(-limit, `${kind} fora do intervalo ±${String(limit)}`)
      .max(limit, `${kind} fora do intervalo ±${String(limit)}`)
      .nullable()
      .default(null),
  );
};

export const createBranchBodySchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter no mínimo 2 caracteres').max(80),
  address: z.string().trim().min(4, 'Endereço muito curto').max(120),
  city: z.string().trim().min(2, 'Cidade muito curta').max(60),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'UF inválida (sigla de 2 letras, ex.: CE)'),
  phone: z.preprocess(emptyToNull, z.string().trim().max(20).nullable().default(null)),
  zipCode: z.preprocess(emptyToNull, z.string().trim().max(10).nullable().default(null)),
  latitude: coordinateSchema('latitude'),
  longitude: coordinateSchema('longitude'),
});
export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;

export const updateBranchBodySchema = createBranchBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nenhum campo para atualizar');
export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>;
