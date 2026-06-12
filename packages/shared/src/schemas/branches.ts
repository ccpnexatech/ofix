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
// Unions (instead of z.preprocess) keep z.input form-friendly for RHF.

/** Optional text: '' from form inputs normalizes to null. */
const optionalTextSchema = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      const trimmed = typeof value === 'string' ? value.trim() : null;
      return trimmed === null || trimmed === '' ? null : trimmed;
    })
    .pipe(z.string().max(max).nullable());

/** Accepts number (API) or numeric string (form input); '' never becomes 0. */
const coordinateSchema = (kind: 'latitude' | 'longitude') => {
  const limit = kind === 'latitude' ? 90 : 180;
  return z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) =>
      value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
        ? null
        : Number(value),
    )
    .pipe(
      z
        .number(`${kind} deve ser um número`)
        .min(-limit, `${kind} fora do intervalo ±${String(limit)}`)
        .max(limit, `${kind} fora do intervalo ±${String(limit)}`)
        .nullable(),
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
  phone: optionalTextSchema(20),
  zipCode: optionalTextSchema(10),
  latitude: coordinateSchema('latitude'),
  longitude: coordinateSchema('longitude'),
});
export type CreateBranchBody = z.infer<typeof createBranchBodySchema>;
/** What the web form holds before validation (coordinates may be strings). */
export type CreateBranchFormInput = z.input<typeof createBranchBodySchema>;

export const updateBranchBodySchema = createBranchBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nenhum campo para atualizar');
export type UpdateBranchBody = z.infer<typeof updateBranchBodySchema>;
